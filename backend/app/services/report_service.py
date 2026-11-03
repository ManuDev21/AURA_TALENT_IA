"""Reportes descargables: vacante (PDF/Excel) y perfil personal (PDF). Cada generacion queda registrada."""

import re
import uuid

from sqlalchemy import select

from app.core.errors import NotFoundError
from app.core.principal import Principal
from app.core.security import utcnow
from app.models import Application, CandidateProfile, JobPosting, Report, User
from app.reports.documents import ReportDoc, Section, render_pdf, render_xlsx
from app.services.analytics_service import AnalyticsService
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService
from app.services.match_service import MatchService

STAGE = {
    "APPLIED": "Postulado",
    "SCREENING": "Revision de perfil",
    "ASSESSMENT": "Evaluacion",
    "INTERVIEW": "Entrevista",
    "FINAL_REVIEW": "Revision final",
    "HIRED": "Seleccionado",
    "CLOSED": "Proceso concluido",
}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "reporte"


class ReportService:
    def __init__(self, session, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    def _log(self, report_type: str, fmt: str, subject: uuid.UUID | None, company: uuid.UUID | None) -> None:
        now = utcnow()
        self.session.add(
            Report(
                owner_user_id=self.principal.id,
                company_id=company,
                report_type=report_type,
                subject_id=subject,
                format=fmt,
                status="ready",
                generated_at=now,
            )
        )
        self.audit.record(
            module="reports",
            action=f"generate:{report_type}:{fmt}",
            result="success",
            actor_user_id=self.principal.id,
            company_id=company,
            entity_type="job_posting" if report_type == "vacancy" else None,
            entity_id=subject,
        )

    async def vacancy(self, job_id: uuid.UUID, fmt: str) -> tuple[bytes, str]:
        job = await self.session.get(JobPosting, job_id)
        if job is None or job.deleted_at is not None or not self.principal.belongs_to_company(job.company_id):
            raise NotFoundError("Vacante no encontrada.")
        data = await AnalyticsService(self.session, self.principal, self.audit).company(job_id)
        matches = {
            m.application_id: m
            for m in await MatchService(self.session, self.principal, self.audit).job_applicants(job_id)
        }
        rows = (
            await self.session.execute(
                select(Application, User.full_name)
                .join(CandidateProfile, CandidateProfile.id == Application.candidate_id)
                .join(User, User.id == CandidateProfile.user_id)
                .where(Application.job_id == job.id)
                .order_by(Application.applied_at)
            )
        ).all()
        applicants = []
        for app, name in rows:
            m = matches.get(app.id)
            applicants.append(
                [
                    name,
                    STAGE.get(app.current_stage, app.current_stage),
                    "Retirada"
                    if app.status == "withdrawn"
                    else "Activa"
                    if app.status == "active"
                    else "Cerrada",
                    app.applied_at.strftime("%Y-%m-%d"),
                    f"{round(m.score)}% ({round(m.score_low)}-{round(m.score_high)})" if m else "-",
                    f"{m.required_met}/{m.required_total}" if m else "-",
                ]
            )
        k = data["kpis"]
        doc = ReportDoc(
            title=f"Reporte de vacante: {job.title}",
            subtitle=f"{job.company.name} / estado {job.status} / {len(applicants)} postulacion(es)",
            kpis=[
                ("Postulaciones", str(k["applications"])),
                ("Activas", str(k["active"])),
                ("Seleccionadas", str(k["hired"])),
                ("Match promedio", f"{k['avg_match']}%" if k["avg_match"] is not None else "-"),
            ],
            sections=[
                Section(
                    "Embudo de seleccion",
                    ["Etapa", "Alcanzaron", "% del total", "% de la etapa previa"],
                    [
                        [f["label"], f["count"], f"{f['rate_from_start']}%", f"{f['rate_from_previous']}%"]
                        for f in data["funnel"]
                    ],
                    note="Muestra pequena: interpreta las proporciones con cautela."
                    if data["small_sample"]
                    else None,
                ),
                Section(
                    "Tiempo promedio por etapa",
                    ["Etapa", "Dias promedio", "Postulaciones medidas"],
                    [[d["label"], d["avg_days"], d["samples"]] for d in data["stage_durations"]],
                ),
                Section(
                    "Postulantes",
                    ["Nombre", "Etapa", "Estado", "Fecha", "Compatibilidad (rango)", "Requisitos"],
                    applicants,
                    note="La compatibilidad es una estimacion explicable; no ordena ni descarta a nadie.",
                ),
                Section(
                    "Brechas mas frecuentes",
                    ["Habilidad requerida", "Postulantes sin ella"],
                    [[g["name"], g["count"]] for g in data["top_gaps"]],
                ),
            ],
        )
        self._log("vacancy", fmt, job.id, job.company_id)
        await self.session.commit()
        name = f"reporte-{_slug(job.title)}.{fmt}"
        return (render_pdf(doc) if fmt == "pdf" else render_xlsx(doc)), name

    async def personal(self) -> tuple[bytes, str]:
        data = await AnalyticsService(self.session, self.principal, self.audit).personal()
        overview = await CandidateService(self.session, self.principal, self.audit).overview()
        k = data["kpis"]
        doc = ReportDoc(
            title=f"Reporte de perfil: {overview.full_name}",
            subtitle=overview.profile.headline or "Perfil profesional",
            kpis=[
                ("Perfil completo", f"{k['completeness']}%"),
                ("Habilidades", str(k["skills"])),
                ("Postulaciones", str(k["applications"])),
                ("Mejor compatibilidad", f"{k['best_match']}%" if k["best_match"] is not None else "-"),
            ],
            sections=[
                Section(
                    "Habilidades",
                    ["Habilidad", "Nivel (1-5)", "Area"],
                    [
                        [s.skill.name, s.proficiency, s.skill.category.name if s.skill.category else "-"]
                        for s in overview.skills
                    ],
                ),
                Section(
                    "Experiencia",
                    ["Puesto", "Empresa", "Desde", "Hasta"],
                    [
                        [
                            e.title,
                            e.company_name,
                            str(e.start_date)[:7],
                            "Actual" if e.is_current else str(e.end_date or "")[:7],
                        ]
                        for e in overview.experiences
                    ],
                ),
                Section(
                    "Postulaciones activas por etapa",
                    ["Etapa", "Cantidad"],
                    [[a["label"], a["count"]] for a in data["applications_by_stage"]],
                ),
                Section(
                    "Rutas profesionales",
                    ["Ruta", "Avance"],
                    [[p["title"], f"{p['progress']}%"] for p in data["career_paths"]],
                ),
            ],
            footer="Generado por AURA TALENT AI para uso personal, solo con informacion registrada por ti.",
        )
        self._log("candidate", "pdf", None, None)
        await self.session.commit()
        return render_pdf(doc), f"reporte-{_slug(overview.full_name)}.pdf"
