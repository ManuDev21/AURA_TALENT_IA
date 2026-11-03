import uuid
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, NotFoundError, ValidationFailedError
from app.core.principal import Principal
from app.core.security import utcnow
from app.models import Application, Company, JobLanguage, JobPosting, JobRequirement, JobSkill, Skill
from app.schemas.jobs import JobCompanyItem, JobIn, JobPage, JobPublic, JobRead, MyApplicationBrief
from app.services.audit_service import AuditService

JOB_TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"PUBLISHED", "CLOSED"},
    "PUBLISHED": {"PAUSED", "CLOSED"},
    "PAUSED": {"PUBLISHED", "CLOSED"},
    "CLOSED": set(),
}


def _transparency(job: JobPosting) -> tuple[int, list[str], list[str]]:
    checks = {
        "Rango salarial publicado": bool(job.show_salary and job.salary_min is not None),
        "Beneficios": bool(job.benefits),
        "Horario": bool(job.schedule_description),
        "Plazo de respuesta": job.response_sla_days is not None,
        "Duración estimada del proceso": job.process_estimate_days is not None,
    }
    complete = [label for label, present in checks.items() if present]
    missing = [label for label, present in checks.items() if not present]
    return round(len(complete) / len(checks) * 100), complete, missing


def _apply_transparency(target: JobRead, job: JobPosting) -> None:
    target.transparency_score, target.transparent_fields, target.missing_transparency_fields = _transparency(
        job
    )


def public_job_view(job: JobPosting, application: Application | None = None) -> JobPublic:
    data = JobPublic.model_validate(job)
    if not job.show_salary:
        data.salary_min = data.salary_max = data.salary_currency = None
    _apply_transparency(data, job)
    if application is not None:
        data.my_application = MyApplicationBrief(
            id=application.id,
            current_stage=application.current_stage,
            status=application.status,
            applied_at=application.applied_at,
        )
    return data


class JobService:
    def __init__(self, session: AsyncSession, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    # ------------------------------------------------------- lado empresa
    def _company_id(self) -> uuid.UUID:
        if not self.principal.company_ids:
            raise ForbiddenError("Tu cuenta no pertenece a ninguna empresa.", code="no_company")
        return sorted(self.principal.company_ids)[0]

    async def company_job(self, job_id: uuid.UUID) -> JobPosting:
        job = await self.session.get(JobPosting, job_id)
        # 404 (no 403) para no revelar vacantes de otras empresas
        if job is None or job.deleted_at is not None or not self.principal.belongs_to_company(job.company_id):
            raise NotFoundError("Vacante no encontrada.")
        return job

    async def create(self, data: JobIn) -> JobCompanyItem:
        job = JobPosting(company_id=self._company_id(), created_by=self.principal.id, status="DRAFT")
        await self._apply(job, data)
        self.session.add(job)
        await self.session.flush()
        self._audit(job, "jobs.create", {"title": job.title})
        await self.session.commit()
        return await self.company_item(job.id)

    async def update(self, job_id: uuid.UUID, data: JobIn) -> JobCompanyItem:
        job = await self.company_job(job_id)
        if job.status == "CLOSED":
            raise ValidationFailedError("Una vacante cerrada no puede editarse.", code="job_closed")
        await self._apply(job, data)
        self._audit(job, "jobs.update", None)
        await self.session.commit()
        return await self.company_item(job.id)

    async def change_status(self, job_id: uuid.UUID, status: str) -> JobCompanyItem:
        job = await self.company_job(job_id)
        if status == job.status:
            return await self.company_item(job.id)
        if status not in JOB_TRANSITIONS[job.status]:
            raise ValidationFailedError(
                f"No se puede pasar de {job.status} a {status}.", code="invalid_job_transition"
            )
        if status == "PUBLISHED":
            if job.closes_at and job.closes_at <= utcnow():
                raise ValidationFailedError("La fecha de cierre ya paso. Actualizala antes de publicar.")
            job.published_at = job.published_at or utcnow()
            job.last_confirmed_at = utcnow()
            job.last_confirmed_by = self.principal.id
        previous, job.status = job.status, status
        self._audit(job, "jobs.status_change", {"from": previous, "to": status})
        await self.session.commit()
        return await self.company_item(job.id)

    async def confirm_active(self, job_id: uuid.UUID) -> JobCompanyItem:
        job = await self.company_job(job_id)
        if job.status != "PUBLISHED":
            raise ValidationFailedError("Solo puedes confirmar una vacante publicada.")
        job.last_confirmed_at = utcnow()
        job.last_confirmed_by = self.principal.id
        self._audit(job, "jobs.active_confirmed", {"last_confirmed_at": job.last_confirmed_at.isoformat()})
        await self.session.commit()
        return await self.company_item(job.id)

    async def import_drafts(self, items: list[JobIn]) -> list[JobCompanyItem]:
        all_skill_ids = {skill.skill_id for item in items for skill in item.skills}
        if all_skill_ids:
            found = set(
                (await self.session.scalars(select(Skill.id).where(Skill.id.in_(all_skill_ids)))).all()
            )
            if found != all_skill_ids:
                raise ValidationFailedError("La importacion contiene habilidades inexistentes.")
        company_id = self._company_id()
        jobs = []
        for item in items:
            job = JobPosting(company_id=company_id, created_by=self.principal.id, status="DRAFT")
            await self._apply(job, item)
            self.session.add(job)
            await self.session.flush()
            self._audit(job, "jobs.import_draft", {"title": job.title})
            jobs.append(job)
        await self.session.commit()
        return [await self.company_item(job.id) for job in jobs]

    async def delete(self, job_id: uuid.UUID) -> None:
        job = await self.company_job(job_id)
        has_applications = await self.session.scalar(select(func.count()).where(Application.job_id == job.id))
        if job.status != "DRAFT" or has_applications:
            raise ValidationFailedError(
                "Solo se eliminan borradores sin postulaciones. Cierra la vacante en su lugar.",
                code="job_not_draft",
            )
        job.deleted_at = utcnow()
        self._audit(job, "jobs.delete", None)
        await self.session.commit()

    async def company_jobs(self, status: str | None = None) -> list[JobCompanyItem]:
        stmt = select(JobPosting).where(
            JobPosting.company_id.in_(self.principal.company_ids), JobPosting.deleted_at.is_(None)
        )
        if status:
            stmt = stmt.where(JobPosting.status == status)
        jobs = (await self.session.scalars(stmt.order_by(JobPosting.updated_at.desc()))).unique().all()
        counts = await self._stage_counts([j.id for j in jobs])
        return [self._company_view(j, counts.get(j.id, {})) for j in jobs]

    async def company_item(self, job_id: uuid.UUID) -> JobCompanyItem:
        job = await self.company_job(job_id)
        await self.session.refresh(job)
        return self._company_view(job, (await self._stage_counts([job.id])).get(job.id, {}))

    # ------------------------------------------------------ lado candidato
    async def search(
        self,
        q: str | None,
        modality: str | None,
        skill_id: uuid.UUID | None,
        limit: int,
        offset: int,
        candidate_id: uuid.UUID | None,
    ) -> JobPage:
        stmt = (
            select(JobPosting)
            .join(Company, Company.id == JobPosting.company_id)
            .where(
                JobPosting.status == "PUBLISHED",
                JobPosting.deleted_at.is_(None),
                Company.deleted_at.is_(None),
                Company.status == "active",
                or_(JobPosting.closes_at.is_(None), JobPosting.closes_at > utcnow()),
            )
        )
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(
                or_(
                    JobPosting.title.ilike(pattern),
                    JobPosting.description.ilike(pattern),
                    Company.name.ilike(pattern),
                )
            )
        if modality:
            stmt = stmt.where(JobPosting.modality == modality)
        if skill_id:
            stmt = stmt.where(JobPosting.id.in_(select(JobSkill.job_id).where(JobSkill.skill_id == skill_id)))
        total = await self.session.scalar(select(func.count()).select_from(stmt.subquery()))
        jobs = (
            (
                await self.session.scalars(
                    stmt.order_by(JobPosting.published_at.desc()).limit(limit).offset(offset)
                )
            )
            .unique()
            .all()
        )
        mine = await self._my_applications(candidate_id, [j.id for j in jobs])
        return JobPage(
            items=[public_job_view(j, mine.get(j.id)) for j in jobs],
            total=int(total or 0),
            limit=limit,
            offset=offset,
        )

    async def public_job(self, job_id: uuid.UUID, candidate_id: uuid.UUID | None) -> JobPublic:
        job = await self.session.get(JobPosting, job_id)
        mine = (await self._my_applications(candidate_id, [job_id])).get(job_id) if job else None
        # Una vacante no publicada solo es visible para quien ya se postulo
        if job is None or job.deleted_at is not None or (job.status != "PUBLISHED" and mine is None):
            raise NotFoundError("Vacante no encontrada.")
        return public_job_view(job, mine)

    # ------------------------------------------------------------ helpers
    async def _apply(self, job: JobPosting, data: JobIn) -> None:
        skill_ids = [s.skill_id for s in data.skills]
        if skill_ids:
            found = set((await self.session.scalars(select(Skill.id).where(Skill.id.in_(skill_ids)))).all())
            if len(found) != len(set(skill_ids)):
                raise ValidationFailedError("Alguna habilidad seleccionada no existe en el catalogo.")
        for field, value in data.model_dump(exclude={"skills", "languages", "requirements"}).items():
            setattr(job, field, value)
        job.skills = [JobSkill(**s.model_dump()) for s in data.skills]
        job.languages = [JobLanguage(**lang.model_dump()) for lang in data.languages]
        job.requirements = [
            JobRequirement(display_order=i, **r.model_dump()) for i, r in enumerate(data.requirements)
        ]

    async def _stage_counts(self, job_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict[str, int]]:
        if not job_ids:
            return {}
        rows = (
            await self.session.execute(
                select(Application.job_id, Application.current_stage, func.count())
                .where(Application.job_id.in_(job_ids), Application.status != "withdrawn")
                .group_by(Application.job_id, Application.current_stage)
            )
        ).all()
        counts: dict[uuid.UUID, dict[str, int]] = {}
        for job_id, stage, n in rows:
            counts.setdefault(job_id, {})[stage] = n
        return counts

    async def _my_applications(
        self, candidate_id: uuid.UUID | None, job_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, Application]:
        if candidate_id is None or not job_ids:
            return {}
        rows = (
            (
                await self.session.scalars(
                    select(Application).where(
                        Application.candidate_id == candidate_id, Application.job_id.in_(job_ids)
                    )
                )
            )
            .unique()
            .all()
        )
        return {a.job_id: a for a in rows}

    @staticmethod
    def _company_view(job: JobPosting, counts: dict[str, int]) -> JobCompanyItem:
        item = JobCompanyItem.model_validate(job)
        item.stage_counts = counts
        item.applications_count = sum(counts.values())
        _apply_transparency(item, job)
        return item

    def _audit(self, job: JobPosting, action: str, changes: dict[str, Any] | None) -> None:
        self.audit.record(
            module="jobs",
            action=action,
            result="success",
            actor_user_id=self.principal.id,
            company_id=job.company_id,
            entity_type="job_posting",
            entity_id=job.id,
            changes=changes,
        )


def read(job: JobPosting) -> JobRead:
    return JobRead.model_validate(job)
