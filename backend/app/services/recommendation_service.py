"""Motor de recomendaciones hibrido (reglas + contenido) con explicacion por item.

Tipos: vacantes, habilidades, cursos, proyectos y rutas profesionales. Cada recomendacion guarda su
razon (factores y datos usados). Lo que la persona descarta no se vuelve a sugerir.
"""

import uuid
from collections import Counter

from sqlalchemy import select, update

from app.career.planner import rank_roles
from app.career.roles import ROLES
from app.core.errors import NotFoundError
from app.core.principal import Principal
from app.core.security import utcnow
from app.models import LearningResource, Recommendation, RecommendationFeedback, Skill
from app.schemas.career import FeedbackIn, RecommendationRead, RecommendationSet
from app.services.audit_service import AuditService
from app.services.career_service import CareerService
from app.services.match_service import MatchService

MODEL_VERSION = "recs-hybrid-v1"
EXPLANATION = {
    "method": (
        "Combinacion de reglas y similitud de contenido: vacantes por compatibilidad (AURA Match), "
        "habilidades por frecuencia en vacantes y en tu rol objetivo, cursos enlazados a esas habilidades "
        "y rutas por cobertura."
    ),
    "data_used": [
        "Tu perfil (habilidades, experiencia, idiomas, preferencias)",
        "Vacantes publicadas",
        "Catalogo de roles y recursos de aprendizaje",
        "Lo que descartaste antes (para no repetirlo)",
    ],
    "limitations": [
        "Aun no aprende de otras personas (no hay filtrado colaborativo): se basa solo en tu perfil.",
        "Los recursos sugeridos son un catalogo inicial y gratuito; no son los unicos validos.",
        "Las recomendaciones son sugerencias: tu decides que seguir.",
    ],
}
PROJECT_IDEAS = {
    "react": "Un tablero de tareas con filtros, estado global y pruebas",
    "typescript": "Migrar un proyecto propio de JavaScript a TypeScript estricto",
    "python": "Un script que automatice una tarea real y la documente",
    "fastapi": "Una API REST con autenticacion, validacion y documentacion OpenAPI",
    "sql": "Un analisis de un dataset publico con consultas SQL explicadas",
    "postgresql": "Modelar y optimizar una base de datos con indices y restricciones",
    "data-analysis": "Un informe con hallazgos accionables sobre datos abiertos",
    "pandas": "Limpieza y analisis exploratorio de un dataset publico",
    "machine-learning": "Un modelo predictivo con validacion cruzada y explicacion de variables",
    "docker": "Contenerizar una aplicacion con base de datos usando docker compose",
    "automated-testing": "Agregar pruebas automatizadas a un proyecto existente con CI",
    "figma": "Rediseno de una pantalla real con investigacion y prototipo",
    "power-bi": "Un dashboard interactivo con indicadores de negocio",
}


class RecommendationService:
    def __init__(self, session, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    async def _dismissed(self) -> set[tuple[str, str]]:
        rows = await self.session.execute(
            select(Recommendation.rec_type, Recommendation.target_label).where(
                Recommendation.user_id == self.principal.id, Recommendation.status == "dismissed"
            )
        )
        return {(t, label or "") for t, label in rows.all()}

    async def generate(self) -> RecommendationSet:
        match = MatchService(self.session, self.principal, self.audit)
        career = CareerService(self.session, self.principal, self.audit)
        profile = await match.my_profile()
        results = await match.all_for_me()
        owned, names = await career.owned_and_names(profile.id)
        slug_by_name = {v: k for k, v in names.items()}
        dismissed = await self._dismissed()
        items: list[dict] = []

        def add(
            rec_type: str, label: str, score: float, reason: dict, target_id: uuid.UUID | None = None
        ) -> None:
            if (rec_type, label) not in dismissed and not any(
                i["rec_type"] == rec_type and i["target_label"] == label for i in items
            ):
                items.append(
                    {
                        "rec_type": rec_type,
                        "target_label": label[:250],
                        "score": round(min(1.0, score), 4),
                        "reason": reason,
                        "target_id": target_id,
                    }
                )

        # 1. Vacantes: compatibilidad estimada
        for job, o in sorted(results, key=lambda t: -t[1].score)[:6]:
            if o.score >= 45:
                top = sorted(o.factors, key=lambda f: -f.weight * f.score)[:3]
                add(
                    "job",
                    f"{job.title} - {job.company.name}",
                    o.score / 100,
                    {
                        "summary": (
                            f"Compatibilidad estimada {round(o.score)}% "
                            f"(rango {round(o.score_low)}-{round(o.score_high)})."
                        ),
                        "factors": [f"{f.label}: {f.detail}" for f in top],
                        "gaps": [str(g["name"]) for g in o.gaps[:3]],
                    },
                    job.id,
                )

        # 2. Rutas: cobertura del catalogo de roles
        roles = rank_roles(owned, names)
        for rc in roles[:3]:
            add(
                "career_path",
                rc.title,
                rc.coverage / 100,
                {
                    "summary": f"Tu perfil cubre {round(rc.coverage)}% de la referencia de este rol.",
                    "factors": [f"Ya tienes: {', '.join(rc.met[:4]) or 'aun ninguna'}"],
                    "gaps": rc.missing[:4],
                    "role_code": rc.code,
                },
            )

        # 3. Habilidades: frecuencia en vacantes + brechas del rol mas cercano
        freq: Counter[str] = Counter()
        for _, o in results:
            for g in o.gaps:
                if g["kind"] == "skill":
                    freq[str(g["name"])] += 2 if g["required"] else 1
        best_role = ROLES[roles[0].code] if roles else None
        for name in (roles[0].missing if roles else [])[:3]:
            freq[name] += 2
        total = max(1, max(freq.values(), default=1))
        skill_rows = {
            s.name: s
            for s in (await self.session.scalars(select(Skill).where(Skill.name.in_(list(freq))))).all()
        }
        top_skills = [n for n, _ in freq.most_common(6) if n in skill_rows]
        for name in top_skills:
            in_jobs = sum(1 for _, o in results if any(g["name"] == name for g in o.gaps))
            add(
                "skill",
                name,
                freq[name] / total,
                {
                    "summary": f"Aparece como brecha en {in_jobs} vacante(s)"
                    + (
                        f" y en la referencia de {best_role.title}"
                        if best_role and name in roles[0].missing
                        else ""
                    )
                    + ".",
                    "factors": [f"Frecuencia ponderada {freq[name]}"],
                },
                skill_rows[name].id,
            )

        # 4. Cursos: recursos enlazados a esas habilidades
        if top_skills:
            resources = (
                await self.session.scalars(
                    select(LearningResource).where(LearningResource.is_active.is_(True))
                )
            ).all()
            for n in top_skills:
                for r in [r for r in resources if any(s.id == skill_rows[n].id for s in r.skills)][:1]:
                    add(
                        "course",
                        r.title,
                        freq[n] / total * 0.9,
                        {
                            "summary": f"Recurso gratuito para desarrollar {n}.",
                            "factors": [
                                f"Proveedor: {r.provider}",
                                f"Nivel: {r.level or 'general'}",
                                f"Duracion aprox.: {r.duration_hours or '?'} h",
                            ],
                            "url": r.url,
                            "skill": n,
                        },
                        r.id,
                    )

        # 5. Proyectos: evidencia concreta para el portfolio
        for n in top_skills[:3]:
            idea = PROJECT_IDEAS.get(slug_by_name.get(n, ""))
            if idea:
                add(
                    "project",
                    idea,
                    freq[n] / total * 0.8,
                    {
                        "summary": f"Demuestra {n} con evidencia visible para las empresas.",
                        "skill": n,
                        "factors": ["Los proyectos publicados en tu portfolio son la evidencia mas fuerte."],
                    },
                )

        await self.session.execute(
            update(Recommendation)
            .where(Recommendation.user_id == self.principal.id, Recommendation.status == "active")
            .values(status="expired")
        )
        for i in items:
            self.session.add(
                Recommendation(user_id=self.principal.id, strategy="hybrid", model_version=MODEL_VERSION, **i)
            )
        await self.session.commit()
        return await self.current()

    async def current(self) -> RecommendationSet:
        rows = (
            await self.session.scalars(
                select(Recommendation)
                .where(
                    Recommendation.user_id == self.principal.id,
                    Recommendation.status.in_(("active", "acted")),
                )
                .order_by(Recommendation.score.desc())
            )
        ).all()
        rows = [r for r in rows if r.status == "active" or r.reason.get("saved")]
        return RecommendationSet(
            generated_at=max((r.created_at for r in rows), default=None),
            items=[
                RecommendationRead(
                    id=r.id,
                    rec_type=r.rec_type,
                    target_id=r.target_id,
                    target_label=r.target_label,
                    score=float(r.score),
                    reason=r.reason,
                    strategy=r.strategy,
                    model_version=r.model_version,
                    status=r.status,
                    created_at=r.created_at,
                )
                for r in rows
            ],
            explanation=EXPLANATION,
        )

    async def feedback(self, rec_id: uuid.UUID, data: FeedbackIn) -> None:
        rec = await self.session.get(Recommendation, rec_id)
        if rec is None or rec.user_id != self.principal.id:
            raise NotFoundError("Recomendacion no encontrada.")
        self.session.add(
            RecommendationFeedback(recommendation_id=rec.id, user_id=self.principal.id, action=data.action)
        )
        if data.action == "dismiss":
            rec.status = "dismissed"
        elif data.action == "save":
            rec.reason = {**rec.reason, "saved": True}
        elif data.action == "apply":
            rec.status = "acted"
        rec.updated_at = utcnow()
        await self.session.commit()
