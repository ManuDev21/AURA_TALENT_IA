import uuid
from typing import Any

from sqlalchemy import func, select

from app.database.base import Base
from app.models import (
    CandidateLanguage,
    CandidateProfile,
    CandidateSkill,
    Certification,
    Education,
    Experience,
    ProfileLink,
    Project,
)
from app.repositories.base import BaseRepository


class CandidateProfileRepository(BaseRepository[CandidateProfile]):
    model = CandidateProfile

    async def get_by_user(self, user_id: uuid.UUID) -> CandidateProfile | None:
        result = await self.session.execute(self._active().where(CandidateProfile.user_id == user_id))
        return result.scalar_one_or_none()


class OwnedItemRepository:
    """Acceso a entidades que pertenecen a un candidato. Siempre filtra por propietario."""

    def __init__(self, session: Any, model: type[Base], candidate_id: uuid.UUID) -> None:
        self.session = session
        self.model = model
        self.candidate_id = candidate_id

    def _scoped(self) -> Any:
        stmt = select(self.model).where(self.model.candidate_id == self.candidate_id)  # type: ignore[attr-defined]
        deleted_at = getattr(self.model, "deleted_at", None)
        if deleted_at is not None:
            stmt = stmt.where(deleted_at.is_(None))
        return stmt

    async def list(self, *order_by: Any) -> list[Any]:
        result = await self.session.execute(self._scoped().order_by(*order_by))
        return list(result.scalars().unique().all())

    async def get(self, item_id: uuid.UUID) -> Any | None:
        result = await self.session.execute(self._scoped().where(self.model.id == item_id))  # type: ignore[attr-defined]
        return result.scalars().unique().one_or_none()

    async def count(self) -> int:
        stmt = select(func.count()).select_from(self._scoped().subquery())
        return int(await self.session.scalar(stmt) or 0)


class CandidateSkillRepository:
    def __init__(self, session: Any, candidate_id: uuid.UUID) -> None:
        self.session = session
        self.candidate_id = candidate_id

    async def list(self) -> list[CandidateSkill]:
        stmt = (
            select(CandidateSkill)
            .where(CandidateSkill.candidate_id == self.candidate_id)
            .order_by(CandidateSkill.proficiency.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get(self, skill_id: uuid.UUID) -> CandidateSkill | None:
        return await self.session.get(CandidateSkill, (self.candidate_id, skill_id))


ORDERING: dict[type[Base], tuple[Any, ...]] = {
    Education: (Education.is_current.desc(), Education.end_date.desc().nulls_first(), Education.created_at),
    Experience: (Experience.is_current.desc(), Experience.start_date.desc()),
    Certification: (Certification.issued_at.desc().nulls_last(), Certification.created_at),
    CandidateLanguage: (CandidateLanguage.created_at,),
    ProfileLink: (ProfileLink.display_order, ProfileLink.created_at),
    Project: (Project.is_featured.desc(), Project.display_order, Project.created_at.desc()),
}
