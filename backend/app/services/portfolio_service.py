import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.core.principal import Principal
from app.core.security import utcnow
from app.models import CandidateProfile, Portfolio, ProfileLink, Project, User
from app.repositories.candidate_repository import ORDERING, CandidateSkillRepository, OwnedItemRepository
from app.repositories.company_repository import slugify
from app.repositories.skill_repository import SkillRepository
from app.schemas.candidate import LinkRead
from app.schemas.portfolio import (
    PortfolioMe,
    PortfolioSettings,
    PortfolioUpdate,
    ProjectIn,
    ProjectRead,
    PublicPortfolio,
    PublicSkill,
)
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService


class PortfolioService:
    def __init__(self, session: AsyncSession, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit
        self.candidates = CandidateService(session, principal, audit)

    async def _portfolio(self, profile: CandidateProfile) -> Portfolio:
        portfolio = await self.session.scalar(select(Portfolio).where(Portfolio.candidate_id == profile.id))
        if portfolio is None:
            base = slugify(self.principal.user.full_name)[:50] or "portfolio"
            slug = base
            while await self.session.scalar(select(Portfolio.id).where(Portfolio.slug == slug)):
                slug = f"{base}-{secrets.token_hex(2)}"
            portfolio = Portfolio(candidate_id=profile.id, slug=slug, title=self.principal.user.full_name)
            self.session.add(portfolio)
            await self.session.commit()
        return portfolio

    async def me(self) -> PortfolioMe:
        profile = await self.candidates.get_profile()
        portfolio = await self._portfolio(profile)
        projects = await OwnedItemRepository(self.session, Project, profile.id).list(*ORDERING[Project])
        return PortfolioMe(
            settings=PortfolioSettings.model_validate(portfolio),
            projects=[ProjectRead.model_validate(p) for p in projects],
        )

    async def update_settings(self, data: PortfolioUpdate) -> PortfolioSettings:
        profile = await self.candidates.get_profile()
        portfolio = await self._portfolio(profile)
        changes = data.model_dump(exclude_unset=True, exclude_none=True)
        for field, value in changes.items():
            setattr(portfolio, field, value)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError("Esa direccion ya esta en uso. Elige otra.", code="slug_taken") from exc
        self._audit("portfolio.settings_update", portfolio.id, sorted(changes))
        await self.session.commit()
        return PortfolioSettings.model_validate(portfolio)

    # ------------------------------------------------------------ proyectos
    async def create_project(self, data: ProjectIn) -> ProjectRead:
        profile = await self.candidates.get_profile()
        project = Project(candidate_id=profile.id, **data.model_dump(exclude={"skill_ids"}))
        project.skills = await self._skills(data.skill_ids)
        self.session.add(project)
        await self.session.flush()
        return await self._save(profile, project, "portfolio.project_create")

    async def update_project(self, project_id: uuid.UUID, data: ProjectIn) -> ProjectRead:
        profile = await self.candidates.get_profile()
        project = await self._owned(profile, project_id)
        for field, value in data.model_dump(exclude={"skill_ids"}).items():
            setattr(project, field, value)
        project.skills = await self._skills(data.skill_ids)
        return await self._save(profile, project, "portfolio.project_update")

    async def delete_project(self, project_id: uuid.UUID) -> None:
        profile = await self.candidates.get_profile()
        project = await self._owned(profile, project_id)
        project.deleted_at = utcnow()
        await self.session.flush()
        await self.candidates.recompute_completeness(profile)
        self._audit("portfolio.project_delete", project.id)
        await self.session.commit()

    async def _owned(self, profile: CandidateProfile, project_id: uuid.UUID) -> Project:
        project = await OwnedItemRepository(self.session, Project, profile.id).get(project_id)
        if project is None:
            raise NotFoundError("No se encontro el proyecto.")
        return project

    async def _skills(self, ids: list[uuid.UUID]) -> list:
        unique = list(dict.fromkeys(ids))
        skills = await SkillRepository(self.session).get_many(unique)
        if len(skills) != len(unique):
            raise ValidationFailedError("Alguna habilidad seleccionada no existe en el catalogo.")
        return skills

    async def _save(self, profile: CandidateProfile, project: Project, action: str) -> ProjectRead:
        await self.session.flush()
        await self.candidates.recompute_completeness(profile)
        self._audit(action, project.id)
        await self.session.commit()
        await self.session.refresh(project)
        return ProjectRead.model_validate(project)

    def _audit(self, action: str, entity_id: uuid.UUID, fields: list[str] | None = None) -> None:
        self.audit.record(
            module="portfolio",
            action=action,
            result="success",
            actor_user_id=self.principal.id,
            entity_type="portfolio",
            entity_id=entity_id,
            changes={"fields": fields} if fields else None,
        )


async def public_portfolio(session: AsyncSession, slug: str) -> PublicPortfolio:
    """Vista publica minimizada: sin correo, telefono ni datos sensibles."""
    row = (
        await session.execute(
            select(Portfolio, CandidateProfile, User)
            .join(CandidateProfile, CandidateProfile.id == Portfolio.candidate_id)
            .join(User, User.id == CandidateProfile.user_id)
            .where(
                Portfolio.slug == slug,
                Portfolio.visibility.in_(("public", "link")),
                CandidateProfile.deleted_at.is_(None),
                User.deleted_at.is_(None),
                User.status == "active",
            )
        )
    ).one_or_none()
    if row is None:
        raise NotFoundError("Este portfolio no existe o no es publico.")
    portfolio, profile, user = row
    projects = await OwnedItemRepository(session, Project, profile.id).list(*ORDERING[Project])
    links = await OwnedItemRepository(session, ProfileLink, profile.id).list(*ORDERING[ProfileLink])
    skills = await CandidateSkillRepository(session, profile.id).list()
    location = ", ".join(p for p in (profile.location_city, profile.location_country) if p) or None
    return PublicPortfolio(
        full_name=user.full_name,
        title=portfolio.title,
        headline=profile.headline,
        summary=profile.summary,
        location=location,
        projects=[ProjectRead.model_validate(p) for p in projects],
        skills=[
            PublicSkill(
                name=s.skill.name,
                category=s.skill.category.name if s.skill.category else None,
                proficiency=s.proficiency,
            )
            for s in skills
        ],
        links=[LinkRead.model_validate(link) for link in links],
    )
