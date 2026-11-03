"""AURA Orchestrator: interpreta comandos (texto o voz), valida permisos y ejecuta herramientas permitidas.

Reglas:
- Solo se ejecutan comandos del catalogo `ai_commands`, habilitados y permitidos para los roles del usuario.
- Las acciones que crean datos requieren confirmacion humana con un token de un solo uso (5 minutos).
- Ninguna herramienta mueve, contrata ni rechaza candidatos.
- Cada interaccion queda registrada en `ai_interactions` (sin audio: solo el texto reconocido).
- Si las reglas no reconocen la frase y hay GEMINI_API_KEY + consentimiento `external_ai_processing`,
  Gemini clasifica la intencion dentro de los comandos permitidos para el usuario. La IA externa solo
  ve el texto del comando; la ejecucion pasa por las mismas validaciones de permisos y confirmacion.
"""

import secrets
import time
from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_, select

from app.aura.intents import Intent, detect
from app.career.planner import rank_roles
from app.config import get_settings
from app.core.errors import NotFoundError
from app.core.principal import Principal
from app.core.security import hash_token, utcnow
from app.llm.gemini import GeminiClient
from app.llm.ollama import OllamaClient
from app.models import (
    AiCommand,
    AiInteraction,
    AiPendingAction,
    Application,
    Company,
    Consent,
    JobPosting,
)
from app.schemas.aura import AuraAction, AuraCommandIn, AuraConfirmation, AuraReply
from app.schemas.career import PathCreate
from app.schemas.cv import ResumeCreate
from app.services.analytics_service import AnalyticsService
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService
from app.services.career_service import CareerService
from app.services.cv_service import CvService
from app.services.match_service import MatchService

PENDING_TTL = timedelta(minutes=5)
SECTION_LABELS = {
    "headline": "titular",
    "summary": "resumen (80+ caracteres)",
    "location": "ubicacion",
    "preferences": "disponibilidad y modalidad",
    "desired_roles": "roles deseados",
    "experiences": "experiencia",
    "education": "educacion",
    "skills": "al menos 3 habilidades",
    "languages": "idiomas",
    "links": "enlaces profesionales",
    "projects": "proyectos de portfolio",
}
LATER: dict[str, str] = {}


class Result:
    def __init__(
        self, reply: str, details: list[str] | None = None, path: str | None = None, outcome: str = "ok"
    ) -> None:
        self.reply, self.details, self.path, self.outcome = reply, details or [], path, outcome


class OrchestratorService:
    def __init__(self, session, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    # ------------------------------------------------------------- entrada
    async def handle(self, data: AuraCommandIn) -> AuraReply:
        started = time.perf_counter()
        intent = detect(data.text)
        llm_used = False
        if intent.code == "unknown":
            llm_intent = await self._llm_intent(data.text)
            if llm_intent is not None:
                intent, llm_used = llm_intent, True
        command = await self._command(intent.code) if intent.code != "unknown" else None
        confirmation: AuraConfirmation | None = None

        if intent.code == "unknown":
            result = Result(
                "No reconoci una accion. Puedo abrir modulos, analizar tu perfil, buscar vacantes y mas.",
                outcome="unknown",
            )
        elif command is None or not self._allowed(command):
            result = Result("Esa accion no esta disponible para tu cuenta.", outcome="denied")
        elif command.requires_confirmation and command.code in PENDING_HANDLERS:
            summary = await self._pending_summary(command.code, intent, data)
            result = Result(summary, outcome="needs_confirmation")
        else:
            result = await self._run(command.code, intent, data)

        interaction = AiInteraction(
            user_id=self.principal.id,
            session_id=data.session_id,
            channel=data.channel,
            input_text=data.text[:500],
            detected_intent=intent.code,
            confidence=Decimal(str(intent.confidence)),
            entities=intent.entities,
            command_id=command.id if command else None,
            tool_calls=[{"tool": command.code}] if command and result.outcome == "ok" else [],
            response_summary=result.reply[:500],
            outcome={"unknown": "ok"}.get(result.outcome, result.outcome),
            latency_ms=int((time.perf_counter() - started) * 1000),
            llm_used=llm_used,
        )
        self.session.add(interaction)
        await self.session.flush()
        if result.outcome == "needs_confirmation" and command:
            token = secrets.token_urlsafe(24)
            pending = AiPendingAction(
                user_id=self.principal.id,
                interaction_id=interaction.id,
                command_id=command.id,
                arguments={"text": data.text, "entities": intent.entities},
                summary=result.reply,
                token_hash=hash_token(token),
                expires_at=utcnow() + PENDING_TTL,
            )
            self.session.add(pending)
            confirmation = AuraConfirmation(token=token, summary=result.reply, expires_at=pending.expires_at)
        await self.session.commit()
        return AuraReply(
            interaction_id=interaction.id,
            intent=intent.code,
            confidence=intent.confidence,
            outcome=result.outcome,
            reply=result.reply,
            details=result.details,
            action=AuraAction(type="navigate", path=result.path) if result.path else None,
            confirmation=confirmation,
        )

    async def _command(self, code: str) -> AiCommand | None:
        return await self.session.scalar(
            select(AiCommand).where(AiCommand.code == code, AiCommand.is_enabled)
        )

    def _allowed(self, command: AiCommand) -> bool:
        return bool(
            set(command.allowed_roles) & self.principal.role_codes
        ) and self.principal.has_permissions(command.required_permission)

    # ------------------------------------------------------------ IA Propia (Ollama) / Respaldo
    async def _llm_intent(self, text: str) -> Intent | None:
        """Clasifica con nuestra IA propia local en Ollama o el cliente secundario cuando el usuario
        concedio el consentimiento de procesamiento IA (`external_ai_processing`)."""
        if len(text) > 300:
            return None
        settings = get_settings()
        consent = await self.session.scalar(
            select(Consent)
            .where(
                Consent.user_id == self.principal.id,
                Consent.consent_type == "external_ai_processing",
            )
            .order_by(Consent.created_at.desc())
            .limit(1)
        )
        if consent is None or not consent.granted:
            return None
        commands = (await self.session.scalars(select(AiCommand).where(AiCommand.is_enabled))).all()
        allowed = {c.code: c for c in commands if self._allowed(c) and c.code in SUPPORTED}
        if not allowed:
            return None
        lines = [
            f"- {c.code}: {c.description}"
            + (f" (ejemplos: {'; '.join(c.examples[:2])})" if c.examples else "")
            for c in allowed.values()
        ]

        data: dict | None = None
        ollama_url = getattr(settings, "ollama_base_url", None)
        if ollama_url:
            ollama = OllamaClient(
                base_url=ollama_url,
                model=getattr(settings, "ollama_model", "aura-talent-ai"),
                base_model=getattr(settings, "ollama_base_model", "qwen2.5:3b"),
            )
            data = await ollama.classify(text, lines)

        if not data and getattr(settings, "gemini_api_key", None):
            client = GeminiClient(settings.gemini_api_key.get_secret_value(), settings.gemini_model)
            data = await client.classify(text, lines)

        if not data or data["intent"] not in allowed:
            return None
        intent = Intent(data["intent"], 0.85)
        query = data.get("query")
        if intent.code == "jobs.search" and isinstance(query, str) and query.strip():
            intent.entities["query"] = query.strip()[:80]
        return intent

    # ------------------------------------------------------- confirmacion
    async def _pending(self, token: str) -> tuple[AiPendingAction, AiCommand]:
        pending = await self.session.scalar(
            select(AiPendingAction).where(
                AiPendingAction.token_hash == hash_token(token), AiPendingAction.user_id == self.principal.id
            )
        )
        if (
            pending is None
            or pending.confirmed_at is not None
            or pending.cancelled_at is not None
            or pending.expires_at < utcnow()
        ):
            raise NotFoundError("La confirmacion no existe o ya expiro. Vuelve a pedirlo a AURA.")
        command = await self.session.get(AiCommand, pending.command_id)
        if command is None or not self._allowed(command):
            raise NotFoundError("La confirmacion no existe o ya expiro.")
        return pending, command

    async def confirm(self, token: str) -> AuraReply:
        pending, command = await self._pending(token)
        pending.confirmed_at = utcnow()
        handler = PENDING_HANDLERS[command.code]
        result = await handler(self, pending.arguments)
        self.audit.record(
            module="aura",
            action=f"confirmed:{command.code}",
            result="success",
            actor_user_id=self.principal.id,
            actor_type="human",
            entity_type="ai_pending_action",
            entity_id=pending.id,
        )
        await self.session.commit()
        return AuraReply(
            interaction_id=pending.interaction_id or pending.id,
            intent=command.code,
            confidence=1.0,
            outcome="ok",
            reply=result.reply,
            details=result.details,
            action=AuraAction(type="navigate", path=result.path) if result.path else None,
        )

    async def cancel(self, token: str) -> AuraReply:
        pending, command = await self._pending(token)
        pending.cancelled_at = utcnow()
        await self.session.commit()
        return AuraReply(
            interaction_id=pending.interaction_id or pending.id,
            intent=command.code,
            confidence=1.0,
            outcome="cancelled",
            reply="Accion cancelada. No se modifico nada.",
        )

    async def _pending_summary(self, code: str, intent: Intent, data: AuraCommandIn) -> str:
        if code == "career.generate":
            owned, names = await CareerService(self.session, self.principal, self.audit).owned_and_names(
                (await self._candidates().get_profile()).id
            )
            top = rank_roles(owned, names)[0]
            return (
                f"Generare una ruta profesional hacia {top.title} "
                f"(cobertura actual {round(top.coverage)}%). Confirmas?"
            )
        return "Creare un nuevo CV a partir de tu perfil actual. Podras editarlo despues. Confirmas?"

    # -------------------------------------------------------- herramientas
    def _candidates(self) -> CandidateService:
        return CandidateService(self.session, self.principal, self.audit)

    async def _run(self, code: str, intent: Intent, data: AuraCommandIn) -> Result:
        if code in LATER:
            return Result(LATER[code])
        if code == "aura.help":
            return await self._help()
        if code == "skills.gaps":
            report = await MatchService(self.session, self.principal, self.audit).my_gaps()
            if report.analyzed_jobs == 0:
                return Result(
                    "Aun no hay vacantes publicadas para comparar tu perfil. Revisa tu Career Map.",
                    path="/candidate/career",
                )
            if not report.gaps:
                return Result(
                    "No encontre brechas frente a las vacantes publicadas. Buen trabajo.",
                    path="/candidate/match?tab=gaps",
                )
            top = report.gaps[:3]
            return Result(
                f"Las habilidades que mas te convendria reforzar son: {', '.join(g.name for g in top)}.",
                [g.suggestion for g in top],
                "/candidate/match?tab=gaps",
            )
        if code == "match.compare":
            service = MatchService(self.session, self.principal, self.audit)
            if data.context.job_id:
                m = await service.my_match(data.context.job_id)
                job_id, title, score, low, high = m.job_id, m.job_title, m.score, m.score_low, m.score_high
            else:
                top = await service.my_top(1)
                if not top:
                    return Result("No hay vacantes publicadas para comparar todavia.", path="/candidate/jobs")
                t = top[0]
                job_id, title, score, low, high = t.job_id, t.job_title, t.score, t.score_low, t.score_high
            return Result(
                f"Tu compatibilidad estimada con {title} es de {round(score)}%, "
                f"entre {round(low)} y {round(high)}.",
                ["Es una estimacion explicable, no una decision."],
                f"/candidate/match?job={job_id}",
            )
        if code == "profile.analyze":
            profile = await self._candidates().get_profile()
            completeness = await self._candidates().recompute_completeness(profile)
            checks = await self._candidates().completeness_checks(profile)
            missing = [SECTION_LABELS[k] for k, ok in checks.items() if not ok]
            reply = f"Tu perfil esta completo al {completeness}%."
            reply += f" Te falta: {', '.join(missing[:4])}." if missing else " Esta completo."
            return Result(reply, missing[4:], "/candidate/profile")
        if code == "cv.analyze":
            return Result(
                "Abriendo tus CV. Usa 'Analizar CV existente' para subir un PDF o DOCX y revisarlo.",
                path="/candidate/cv",
            )
        if code == "jobs.search":
            return await self._search(intent.entities.get("query", ""), data.area)
        if code in ("candidates.analyze", "candidates.filter_minimum"):
            return await self._candidates_summary(code, data)
        if code == "report.generate":
            return Result(
                "Tu reporte de perfil esta listo en Mi progreso. Puedes descargarlo en PDF.",
                path="/candidate/insights",
            )
        if code == "vacancy.report":
            job = f"?job={data.context.job_id}" if data.context.job_id else ""
            return Result(
                "Abriendo Reportes: descarga el reporte de la vacante en PDF o Excel.",
                path=f"/company/reports{job}",
            )
        if code == "gaps.aggregate":
            stats = await AnalyticsService(self.session, self.principal, self.audit).company(
                data.context.job_id
            )
            top = stats["top_gaps"][:3]
            if not top:
                return Result(
                    "Todavia no hay suficientes postulaciones para identificar brechas.",
                    path="/company/analytics",
                )
            return Result(
                "Las brechas mas frecuentes entre postulantes son: "
                + ", ".join(f"{g['name']} ({g['count']})" for g in top)
                + ".",
                ["Son habilidades requeridas que los postulantes no declaran."],
                "/company/analytics",
            )
        if code == "job.create":
            return Result(
                "Abriendo tus vacantes. Crea la vacante en borrador y publicala cuando la revises.",
                path="/company/jobs",
            )
        return Result("Esa accion aun no esta implementada.")

    async def _help(self) -> Result:
        commands = (await self.session.scalars(select(AiCommand).where(AiCommand.is_enabled))).all()
        examples = [
            c.examples[0] for c in commands if self._allowed(c) and c.examples and c.code in SUPPORTED
        ]
        return Result("Puedo ayudarte con esto. Tambien puedes pedirme abrir cualquier modulo.", examples[:8])

    async def _search(self, query: str, area: str) -> Result:
        stmt = (
            select(func.count())
            .select_from(JobPosting)
            .join(Company, Company.id == JobPosting.company_id)
            .where(JobPosting.status == "PUBLISHED", JobPosting.deleted_at.is_(None))
        )
        if query:
            pattern = f"%{query}%"
            stmt = stmt.where(or_(JobPosting.title.ilike(pattern), JobPosting.description.ilike(pattern)))
        total = await self.session.scalar(stmt) or 0
        label = f" de {query}" if query else ""
        base = "/candidate/jobs" if area == "candidate" else "/company/jobs"
        path = f"{base}?q={query}" if query and area == "candidate" else base
        return Result(f"Encontre {total} vacante(s) publicada(s){label}.", path=path)

    async def _candidates_summary(self, code: str, data: AuraCommandIn) -> Result:
        job: JobPosting | None = None
        if data.context.job_id:
            job = await self.session.get(JobPosting, data.context.job_id)
        if job is None:
            job = await self.session.scalar(
                select(JobPosting)
                .join(Application, Application.job_id == JobPosting.id)
                .where(JobPosting.company_id.in_(self.principal.company_ids), JobPosting.deleted_at.is_(None))
                .order_by(Application.applied_at.desc())
                .limit(1)
            )
        if job is None or not self.principal.belongs_to_company(job.company_id):
            return Result("Aun no hay postulaciones en tus vacantes.", path="/company/jobs")
        stages = (
            await self.session.execute(
                select(Application.current_stage, func.count())
                .where(Application.job_id == job.id, Application.status == "active")
                .group_by(Application.current_stage)
            )
        ).all()
        matches = await MatchService(self.session, self.principal, self.audit).job_applicants(job.id)
        total = len(matches)
        if code == "candidates.filter_minimum":
            ok = sum(1 for m in matches if m.required_met == m.required_total)
            return Result(
                f"En {job.title}, {ok} de {total} candidato(s) cumplen todos los requisitos obligatorios.",
                ["Es un filtro visible para revisar: nadie es descartado automaticamente."],
                "/company/match",
            )
        avg = round(sum(m.score for m in matches) / total) if total else 0
        details = [f"{stage}: {count}" for stage, count in stages]
        return Result(
            f"{job.title}: {total} postulacion(es), compatibilidad promedio estimada {avg}%.",
            details + ["Cada decision de avance la toma una persona del equipo."],
            f"/company/candidates?job={job.id}",
        )


async def _confirm_career(service: OrchestratorService, args: dict[str, Any]) -> Result:
    career = CareerService(service.session, service.principal, service.audit)
    owned, names = await career.owned_and_names((await service._candidates().get_profile()).id)
    top = rank_roles(owned, names)[0]
    path = await career.create_path(PathCreate(role_code=top.code), generated_by="aura")
    return Result(f"Listo. Cree tu ruta hacia {top.title}.", path=f"/candidate/career?path={path.id}")


async def _confirm_cv(service: OrchestratorService, args: dict[str, Any]) -> Result:
    resume = await CvService(service.session, service.principal, service.audit).create(
        ResumeCreate(name="CV generado con AURA")
    )
    return Result(f"Listo. Cree el CV '{resume.name}' a partir de tu perfil.", path="/candidate/cv")


PENDING_HANDLERS = {"career.generate": _confirm_career, "cv.create": _confirm_cv}
SUPPORTED = {
    "aura.help",
    "skills.gaps",
    "match.compare",
    "profile.analyze",
    "cv.analyze",
    "cv.create",
    "career.generate",
    "jobs.search",
    "candidates.analyze",
    "candidates.filter_minimum",
    "job.create",
    "report.generate",
    "vacancy.report",
    "gaps.aggregate",
}
