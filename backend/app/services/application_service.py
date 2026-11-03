"""Postulaciones y pipeline de reclutamiento.

Principio: AURA asiste, pero TODA transicion de etapa la realiza una persona autorizada.
No existe ningun camino que mueva, contrate o rechace candidatos de forma automatica.
"""

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.core.principal import Principal
from app.core.security import utcnow
from app.models import (
    Application,
    ApplicationHistory,
    ApplicationNote,
    CandidateLanguage,
    CandidateProfile,
    Certification,
    Education,
    Experience,
    JobPosting,
    ProfileLink,
    Resume,
    ResumeVersion,
    User,
)
from app.repositories.candidate_repository import ORDERING, CandidateSkillRepository, OwnedItemRepository
from app.schemas.candidate import CertificationRead, EducationRead, ExperienceRead, LanguageRead, LinkRead
from app.schemas.cv import SectionRead
from app.schemas.jobs import (
    ApplicantBrief,
    ApplicantProfile,
    ApplicationCreate,
    ApplicationDetail,
    CandidateTimelineEntry,
    HistoryEntry,
    MyApplication,
    NoteIn,
    NoteRead,
    StageTransition,
)
from app.schemas.skills import CandidateSkillRead
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService
from app.services.cv_service import CvService
from app.services.job_service import public_job_view
from app.services.notification_service import notify
from app.services.skill_passport_service import SkillPassportService

STAGE_TRANSITIONS: dict[str, list[str]] = {
    "APPLIED": ["SCREENING", "CLOSED"],
    "SCREENING": ["ASSESSMENT", "INTERVIEW", "CLOSED"],
    "ASSESSMENT": ["INTERVIEW", "SCREENING", "CLOSED"],
    "INTERVIEW": ["FINAL_REVIEW", "ASSESSMENT", "CLOSED"],
    "FINAL_REVIEW": ["HIRED", "INTERVIEW", "CLOSED"],
    "HIRED": [],
    "CLOSED": [],
}
DECISION_STAGES = {"HIRED", "CLOSED"}
STAGE_NAMES = {
    "APPLIED": "Postulado",
    "SCREENING": "Revision de perfil",
    "ASSESSMENT": "Evaluacion",
    "INTERVIEW": "Entrevista",
    "FINAL_REVIEW": "Revision final",
    "HIRED": "Seleccionado",
    "CLOSED": "Proceso concluido",
}


class ApplicationService:
    def __init__(self, session: AsyncSession, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    # ============================================================ candidato
    async def apply(self, data: ApplicationCreate) -> MyApplication:
        candidates = CandidateService(self.session, self.principal, self.audit)
        profile = await candidates.get_profile()
        job = await self.session.get(JobPosting, data.job_id)
        if job is None or job.deleted_at is not None or job.status != "PUBLISHED":
            raise NotFoundError("La vacante no esta disponible.")
        if job.closes_at and job.closes_at <= utcnow():
            raise ValidationFailedError("La vacante ya cerro su periodo de postulacion.")
        existing = await self.session.scalar(
            select(Application.id).where(Application.job_id == job.id, Application.candidate_id == profile.id)
        )
        if existing:
            raise ConflictError("Ya te postulaste a esta vacante.", code="already_applied")

        resume_version_id = await self._freeze_resume(profile, data.resume_id, job.title)
        application = Application(
            job_id=job.id,
            candidate_id=profile.id,
            company_id=job.company_id,
            resume_version_id=resume_version_id,
            cover_letter=data.cover_letter,
            current_stage="APPLIED",
            status="active",
        )
        self.session.add(application)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError("Ya te postulaste a esta vacante.", code="already_applied") from exc
        self._history(application, None, "APPLIED", None)
        notify(
            self.session,
            job.created_by,
            "application_received",
            f"Nueva postulacion: {job.title}",
            f"{self.principal.user.full_name} se postulo a la vacante.",
            "/company/candidates",
            {"job_id": str(job.id), "application_id": str(application.id)},
        )
        self._audit(application, "applications.create", {"job_id": str(job.id)})
        await self.session.commit()
        return await self._my_view(application)

    async def my_applications(self) -> list[MyApplication]:
        profile = await CandidateService(self.session, self.principal, self.audit).get_profile()
        rows = (
            (
                await self.session.scalars(
                    select(Application)
                    .where(Application.candidate_id == profile.id)
                    .order_by(Application.applied_at.desc())
                )
            )
            .unique()
            .all()
        )
        return [await self._my_view(a) for a in rows]

    async def withdraw(self, application_id: uuid.UUID) -> MyApplication:
        profile = await CandidateService(self.session, self.principal, self.audit).get_profile()
        application = await self.session.get(Application, application_id)
        if application is None or application.candidate_id != profile.id:
            raise NotFoundError("Postulacion no encontrada.")
        if application.status != "active":
            raise ValidationFailedError("Esta postulacion ya no esta activa.")
        application.status = "withdrawn"
        application.withdrawn_at = utcnow()
        self._history(
            application,
            application.current_stage,
            application.current_stage,
            "Retirada por la persona candidata",
            "withdrawn",
        )
        notify(
            self.session,
            application.job.created_by,
            "application_withdrawn",
            f"Postulacion retirada: {application.job.title}",
            None,
            "/company/candidates",
            {"application_id": str(application.id)},
        )
        self._audit(application, "applications.withdraw", None)
        await self.session.commit()
        return await self._my_view(application)

    # ============================================================== empresa
    async def job_applicants(self, job_id: uuid.UUID) -> list[ApplicantBrief]:
        job = await self.session.get(JobPosting, job_id)
        if job is None or job.deleted_at is not None or not self.principal.belongs_to_company(job.company_id):
            raise NotFoundError("Vacante no encontrada.")
        rows = (
            (
                await self.session.execute(
                    select(Application, CandidateProfile, User)
                    .join(CandidateProfile, CandidateProfile.id == Application.candidate_id)
                    .join(User, User.id == CandidateProfile.user_id)
                    .where(Application.job_id == job.id, Application.company_id == job.company_id)
                    .order_by(Application.applied_at)
                )
            )
            .unique()
            .all()
        )
        result = []
        for application, profile, user in rows:
            skills = await CandidateSkillRepository(self.session, profile.id).list()
            result.append(
                ApplicantBrief(
                    application_id=application.id,
                    candidate_id=profile.id,
                    full_name=user.full_name,
                    headline=profile.headline,
                    location=", ".join(p for p in (profile.location_city, profile.location_country) if p)
                    or None,
                    completeness=profile.completeness,
                    top_skills=[s.skill.name for s in skills[:6]],
                    current_stage=application.current_stage,
                    status=application.status,
                    applied_at=application.applied_at,
                )
            )
        return result

    async def detail(self, application_id: uuid.UUID) -> ApplicationDetail:
        application = await self._company_application(application_id)
        profile = await self.session.get(CandidateProfile, application.candidate_id)
        assert profile is not None
        user = await self.session.get(User, profile.user_id)
        assert user is not None

        async def owned(model: Any) -> list[Any]:
            return await OwnedItemRepository(self.session, model, profile.id).list(*ORDERING[model])

        sections: list[SectionRead] = []
        if application.resume_version_id:
            version = await self.session.get(ResumeVersion, application.resume_version_id)
            if version is not None:
                sections = [SectionRead.model_validate(s) for s in version.sections]

        history = (
            await self.session.scalars(
                select(ApplicationHistory)
                .where(ApplicationHistory.application_id == application.id)
                .order_by(ApplicationHistory.created_at)
            )
        ).all()
        return ApplicationDetail(
            id=application.id,
            job_id=application.job_id,
            job_title=application.job.title,
            current_stage=application.current_stage,
            status=application.status,
            applied_at=application.applied_at,
            cover_letter=application.cover_letter,
            allowed_transitions=STAGE_TRANSITIONS[application.current_stage]
            if application.status == "active"
            else [],
            candidate=ApplicantProfile(
                full_name=user.full_name,
                email=user.email,
                headline=profile.headline,
                summary=profile.summary,
                location=", ".join(p for p in (profile.location_city, profile.location_country) if p) or None,
                availability=profile.availability,
                work_modality=profile.work_modality,
                experiences=[ExperienceRead.model_validate(e) for e in await owned(Experience)],
                education=[EducationRead.model_validate(e) for e in await owned(Education)],
                certifications=[CertificationRead.model_validate(c) for c in await owned(Certification)],
                languages=[LanguageRead.model_validate(lang) for lang in await owned(CandidateLanguage)],
                links=[LinkRead.model_validate(link) for link in await owned(ProfileLink)],
                skills=[
                    CandidateSkillRead.model_validate(s)
                    for s in await CandidateSkillRepository(self.session, profile.id).list()
                ],
                shared_skill_evidence=await SkillPassportService(
                    self.session, self.principal, self.audit
                ).shared_for_candidate(profile.id),
            ),
            resume_sections=sections,
            history=[HistoryEntry.model_validate(h) for h in history],
            notes=await self._notes(application.id),
        )

    async def transition(self, application_id: uuid.UUID, data: StageTransition) -> ApplicationDetail:
        application = await self._company_application(application_id)
        if application.status != "active":
            raise ValidationFailedError("La postulacion ya no esta activa.", code="application_inactive")
        allowed = STAGE_TRANSITIONS[application.current_stage]
        if data.to_stage not in allowed:
            raise ValidationFailedError(
                f"No se puede pasar de {application.current_stage} a {data.to_stage}.",
                code="invalid_transition",
                details={"allowed": allowed},
            )
        if data.to_stage in DECISION_STAGES:
            if not data.confirm:
                raise ValidationFailedError(
                    "Esta es una decision final: confirma explicitamente que la tomas tu.",
                    code="confirmation_required",
                )
            if not (data.comment and data.comment.strip()):
                raise ValidationFailedError("Registra el motivo de la decision.", code="comment_required")

        previous = application.current_stage
        application.current_stage = data.to_stage
        if data.to_stage == "HIRED":
            application.status, application.closed_at = "hired", utcnow()
        elif data.to_stage == "CLOSED":
            application.status, application.closed_at = "closed", utcnow()
        self._history(application, previous, data.to_stage, data.comment, data.reason_code)

        profile = await self.session.get(CandidateProfile, application.candidate_id)
        title = {
            "HIRED": f"Has sido seleccionado para {application.job.title}",
            "CLOSED": f"Actualizacion de tu proceso en {application.job.title}",
        }.get(data.to_stage, f"Tu postulacion a {application.job.title} avanzo")
        body = (
            "El proceso de seleccion para esta vacante concluyo. Gracias por tu interes."
            if data.to_stage == "CLOSED"
            else f"Nueva etapa: {STAGE_NAMES[data.to_stage]}."
        )
        notify(
            self.session,
            profile.user_id if profile else None,
            "application_stage",
            title,
            body,
            "/candidate/applications",
            {"application_id": str(application.id), "stage": data.to_stage},
        )
        self._audit(application, "applications.transition", {"from": previous, "to": data.to_stage})
        await self.session.commit()
        return await self.detail(application.id)

    async def add_note(self, application_id: uuid.UUID, data: NoteIn) -> NoteRead:
        application = await self._company_application(application_id)
        note = ApplicationNote(
            application_id=application.id,
            author_id=self.principal.id,
            body=data.body.strip(),
            visibility=data.visibility,
        )
        self.session.add(note)
        self._audit(application, "applications.note_add", {"visibility": data.visibility})
        await self.session.commit()
        await self.session.refresh(note)
        return NoteRead(
            **NoteRead.model_validate(note).model_dump(exclude={"author_name"}),
            author_name=self.principal.user.full_name,
        )

    # ============================================================= helpers
    async def _company_application(self, application_id: uuid.UUID) -> Application:
        application = await self.session.get(Application, application_id)
        if application is None or not self.principal.belongs_to_company(application.company_id):
            raise NotFoundError("Postulacion no encontrada.")
        return application

    async def _notes(self, application_id: uuid.UUID) -> list[NoteRead]:
        rows = (
            await self.session.execute(
                select(ApplicationNote, User.full_name)
                .outerjoin(User, User.id == ApplicationNote.author_id)
                .where(ApplicationNote.application_id == application_id, ApplicationNote.deleted_at.is_(None))
                .order_by(ApplicationNote.created_at)
            )
        ).all()
        return [
            NoteRead(**NoteRead.model_validate(n).model_dump(exclude={"author_name"}), author_name=name)
            for n, name in rows
            if n.visibility == "team" or n.author_id == self.principal.id
        ]

    async def _freeze_resume(
        self, profile: CandidateProfile, resume_id: uuid.UUID | None, job_title: str
    ) -> uuid.UUID | None:
        """Congela la version del CV enviada: lo que ve la empresa no cambia si el CV se edita despues."""
        stmt = select(Resume).where(Resume.candidate_id == profile.id, Resume.deleted_at.is_(None))
        stmt = stmt.where(Resume.id == resume_id) if resume_id else stmt.where(Resume.is_default.is_(True))
        resume = await self.session.scalar(stmt)
        if resume is None:
            if resume_id:
                raise NotFoundError("CV no encontrado.")
            return None
        cv = CvService(self.session, self.principal, self.audit)
        frozen = (await cv._current_version(resume)).id
        await cv.save_version(resume.id, f"Enviado a: {job_title}"[:300])
        return frozen

    def _history(
        self,
        application: Application,
        from_stage: str | None,
        to_stage: str,
        comment: str | None,
        reason: str | None = None,
    ) -> None:
        self.session.add(
            ApplicationHistory(
                application_id=application.id,
                from_stage=from_stage,
                to_stage=to_stage,
                actor_user_id=self.principal.id,
                actor_type="human",
                comment=comment,
                reason_code=reason,
            )
        )

    async def _my_view(self, application: Application) -> MyApplication:
        history = (
            await self.session.scalars(
                select(ApplicationHistory)
                .where(ApplicationHistory.application_id == application.id)
                .order_by(ApplicationHistory.created_at)
            )
        ).all()
        # El candidato ve etapas y fechas; los comentarios internos del equipo no se exponen
        timeline = [CandidateTimelineEntry(to_stage=h.to_stage, created_at=h.created_at) for h in history]
        last_update = history[-1].created_at if history else application.applied_at
        next_update = (
            last_update + timedelta(days=application.job.response_sla_days)
            if application.status == "active" and application.job.response_sla_days
            else None
        )
        return MyApplication(
            id=application.id,
            job=public_job_view(application.job),
            current_stage=application.current_stage,
            status=application.status,
            applied_at=application.applied_at,
            withdrawn_at=application.withdrawn_at,
            last_update_at=last_update,
            estimated_next_update_at=next_update,
            timeline=timeline,
        )

    def _audit(self, application: Application, action: str, changes: dict[str, Any] | None) -> None:
        self.audit.record(
            module="applications",
            action=action,
            result="success",
            actor_user_id=self.principal.id,
            company_id=application.company_id,
            entity_type="application",
            entity_id=application.id,
            changes=changes,
        )
