import uuid
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.errors import NotFoundError, ValidationFailedError
from app.core.principal import Principal
from app.core.security import utcnow
from app.models import CandidateProfile, Portfolio, Project, Resume, ResumeSection, ResumeVersion
from app.reports.cv_pdf import render_cv_pdf
from app.repositories.candidate_repository import ORDERING, OwnedItemRepository
from app.schemas.cv import (
    ResumeCreate,
    ResumeDetail,
    ResumeDuplicate,
    ResumeSummary,
    ResumeUpdate,
    SectionIn,
    SectionRead,
    VersionRead,
)
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService
from app.services.cv_builder import TITLES, build_content, build_sections

MAX_RESUMES = 15


class CvService:
    def __init__(self, session: AsyncSession, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit
        self.candidates = CandidateService(session, principal, audit)

    # ------------------------------------------------------------- lectura
    async def list_resumes(self) -> list[ResumeSummary]:
        profile = await self.candidates.get_profile()
        resumes = await self._resumes(profile).list(Resume.is_default.desc(), Resume.updated_at.desc())
        return [await self._summary(r) for r in resumes]

    async def detail(self, resume_id: uuid.UUID) -> ResumeDetail:
        resume = await self._owned(resume_id)
        version = await self._current_version(resume)
        summary = await self._summary(resume, version)
        return ResumeDetail(
            **summary.model_dump(), sections=[SectionRead.model_validate(s) for s in version.sections]
        )

    # ------------------------------------------------------------ creacion
    async def create(self, data: ResumeCreate) -> ResumeDetail:
        profile = await self.candidates.get_profile()
        await self._check_limit(profile)
        overview = await self.candidates.overview()
        projects = await OwnedItemRepository(self.session, Project, profile.id).list(*ORDERING[Project])
        sections = build_sections(overview, projects, data.target, await self._portfolio_url(profile))
        resume = await self._new_resume(
            profile, data.name, data.target, data.template, sections, "Creado desde el perfil"
        )
        self._audit("cv.create", resume.id, {"target": data.target})
        await self.session.commit()
        return await self.detail(resume.id)

    async def duplicate(self, resume_id: uuid.UUID, data: ResumeDuplicate) -> ResumeDetail:
        source = await self._owned(resume_id)
        profile = await self.candidates.get_profile()
        await self._check_limit(profile)
        version = await self._current_version(source)
        sections = [self._section_dict(s) for s in version.sections]
        resume = await self._new_resume(
            profile,
            data.name or f"{source.name} (copia)",
            data.target or source.target,
            source.template,
            sections,
            f"Duplicado de {source.name}",
        )
        self._audit("cv.duplicate", resume.id, {"source": str(source.id)})
        await self.session.commit()
        return await self.detail(resume.id)

    # ------------------------------------------------------------- edicion
    async def update(self, resume_id: uuid.UUID, data: ResumeUpdate) -> ResumeDetail:
        resume = await self._owned(resume_id)
        changes = data.model_dump(exclude_unset=True, exclude_none=True)
        if changes.get("is_default"):
            await self._clear_default(resume.candidate_id)
        for field, value in changes.items():
            setattr(resume, field, value)
        self._audit("cv.update", resume.id, {"fields": sorted(changes)})
        await self.session.commit()
        return await self.detail(resume.id)

    async def delete(self, resume_id: uuid.UUID) -> None:
        resume = await self._owned(resume_id)
        resume.deleted_at = utcnow()
        resume.is_default = False
        self._audit("cv.delete", resume.id, None)
        await self.session.commit()

    async def replace_sections(self, resume_id: uuid.UUID, sections: list[SectionIn]) -> ResumeDetail:
        resume = await self._owned(resume_id)
        version = await self._current_version(resume)
        version.sections = self._build_sections(sections)
        resume.updated_at = utcnow()
        self._audit("cv.sections_update", resume.id, {"sections": len(sections)})
        await self.session.commit()
        return await self.detail(resume.id)

    async def sync_section(self, resume_id: uuid.UUID, section_id: uuid.UUID) -> ResumeDetail:
        """Vuelve a generar el contenido de una seccion con los datos actuales del perfil."""
        resume = await self._owned(resume_id)
        version = await self._current_version(resume)
        section = next((s for s in version.sections if s.id == section_id), None)
        if section is None:
            raise NotFoundError("Seccion no encontrada.")
        if section.section_type == "custom":
            raise ValidationFailedError("Las secciones personalizadas no se sincronizan con el perfil.")
        profile = await self.candidates.get_profile()
        overview = await self.candidates.overview()
        projects = await OwnedItemRepository(self.session, Project, profile.id).list(*ORDERING[Project])
        section.content = build_content(
            section.section_type, overview, projects, resume.target, await self._portfolio_url(profile)
        )
        resume.updated_at = utcnow()
        self._audit("cv.section_sync", resume.id, {"section": section.section_type})
        await self.session.commit()
        return await self.detail(resume.id)

    # ----------------------------------------------------------- versiones
    async def versions(self, resume_id: uuid.UUID) -> list[VersionRead]:
        resume = await self._owned(resume_id)
        rows = (
            await self.session.scalars(
                select(ResumeVersion)
                .where(ResumeVersion.resume_id == resume.id)
                .order_by(ResumeVersion.version_no.desc())
            )
        ).all()
        return [
            VersionRead(
                id=v.id,
                version_no=v.version_no,
                note=v.note,
                created_at=v.created_at,
                is_current=v.id == resume.current_version_id,
                sections_count=len(v.sections),
            )
            for v in rows
        ]

    async def save_version(self, resume_id: uuid.UUID, note: str | None) -> ResumeDetail:
        """Congela la version actual y abre una nueva version de trabajo con el mismo contenido."""
        resume = await self._owned(resume_id)
        current = await self._current_version(resume)
        current.snapshot = {
            "sections": [self._section_dict(s) for s in current.sections],
            "template": resume.template,
        }
        current.note = note or current.note
        await self._open_version(resume, [self._section_dict(s) for s in current.sections], None)
        self._audit("cv.version_save", resume.id, {"version": current.version_no})
        await self.session.commit()
        return await self.detail(resume.id)

    async def restore(self, resume_id: uuid.UUID, version_id: uuid.UUID) -> ResumeDetail:
        resume = await self._owned(resume_id)
        source = await self.session.scalar(
            select(ResumeVersion).where(ResumeVersion.id == version_id, ResumeVersion.resume_id == resume.id)
        )
        if source is None:
            raise NotFoundError("Version no encontrada.")
        await self._open_version(
            resume, [self._section_dict(s) for s in source.sections], f"Restaurada desde v{source.version_no}"
        )
        self._audit("cv.version_restore", resume.id, {"from_version": source.version_no})
        await self.session.commit()
        return await self.detail(resume.id)

    async def export_pdf(self, resume_id: uuid.UUID) -> tuple[bytes, str]:
        resume = await self._owned(resume_id)
        version = await self._current_version(resume)
        pdf = render_cv_pdf([self._section_dict(s) for s in version.sections], resume.template, resume.name)
        self._audit("cv.export_pdf", resume.id, None)
        await self.session.commit()
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in resume.name)[:60] or "cv"
        return pdf, f"{safe}.pdf"

    # ------------------------------------------------------------- helpers
    def _resumes(self, profile: CandidateProfile) -> OwnedItemRepository:
        return OwnedItemRepository(self.session, Resume, profile.id)

    async def _owned(self, resume_id: uuid.UUID) -> Resume:
        profile = await self.candidates.get_profile()
        resume = await self._resumes(profile).get(resume_id)
        if resume is None:
            raise NotFoundError("CV no encontrado.")
        return resume

    async def _check_limit(self, profile: CandidateProfile) -> None:
        if await self._resumes(profile).count() >= MAX_RESUMES:
            raise ValidationFailedError(
                f"Puedes tener hasta {MAX_RESUMES} CV. Elimina alguno para crear otro."
            )

    async def _new_resume(
        self,
        profile: CandidateProfile,
        name: str,
        target: str,
        template: str,
        sections: list[dict[str, Any]],
        note: str,
    ) -> Resume:
        is_first = await self._resumes(profile).count() == 0
        resume = Resume(
            candidate_id=profile.id, name=name, target=target, template=template, is_default=is_first
        )
        self.session.add(resume)
        await self.session.flush()
        await self._open_version(resume, sections, note)
        return resume

    async def _open_version(
        self, resume: Resume, sections: list[dict[str, Any]], note: str | None
    ) -> ResumeVersion:
        last = await self.session.scalar(
            select(func.coalesce(func.max(ResumeVersion.version_no), 0)).where(
                ResumeVersion.resume_id == resume.id
            )
        )
        version = ResumeVersion(
            resume_id=resume.id,
            version_no=int(last or 0) + 1,
            template=resume.template,
            note=note,
            created_by=self.principal.id,
            snapshot={},
        )
        version.sections = self._build_sections([SectionIn.model_validate(s) for s in sections])
        self.session.add(version)
        await self.session.flush()
        resume.current_version_id = version.id
        resume.updated_at = utcnow()
        return version

    async def _current_version(self, resume: Resume) -> ResumeVersion:
        version = None
        if resume.current_version_id:
            version = await self.session.get(ResumeVersion, resume.current_version_id)
        if version is None:
            version = await self._open_version(resume, [], None)
        return version

    @staticmethod
    def _build_sections(sections: list[SectionIn]) -> list[ResumeSection]:
        return [
            ResumeSection(
                section_type=s.section_type,
                title=s.title if s.title is not None else TITLES.get(s.section_type),
                display_order=i,
                is_visible=s.is_visible,
                content=s.content,
            )
            for i, s in enumerate(sections)
        ]

    @staticmethod
    def _section_dict(section: ResumeSection) -> dict[str, Any]:
        return {
            "section_type": section.section_type,
            "title": section.title,
            "is_visible": section.is_visible,
            "content": section.content,
        }

    async def _summary(self, resume: Resume, version: ResumeVersion | None = None) -> ResumeSummary:
        version = version or await self._current_version(resume)
        return ResumeSummary(
            id=resume.id,
            name=resume.name,
            target=resume.target,
            template=resume.template,
            is_default=resume.is_default,
            version_no=version.version_no,
            sections_count=len(version.sections),
            updated_at=resume.updated_at,
        )

    async def _clear_default(self, candidate_id: uuid.UUID) -> None:
        await self.session.execute(
            update(Resume)
            .where(Resume.candidate_id == candidate_id, Resume.is_default.is_(True))
            .values(is_default=False)
        )
        await self.session.flush()

    async def _portfolio_url(self, profile: CandidateProfile) -> str | None:
        portfolio = await self.session.scalar(select(Portfolio).where(Portfolio.candidate_id == profile.id))
        if portfolio and portfolio.visibility in ("public", "link"):
            return f"{get_settings().frontend_url}/p/{portfolio.slug}"
        return None

    def _audit(self, action: str, resume_id: uuid.UUID, changes: dict[str, Any] | None) -> None:
        self.audit.record(
            module="cv",
            action=action,
            result="success",
            actor_user_id=self.principal.id,
            entity_type="resume",
            entity_id=resume_id,
            changes=changes,
        )
