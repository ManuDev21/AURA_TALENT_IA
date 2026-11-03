import uuid

from sqlalchemy import func, or_, select

from app.models import Skill, SkillAlias, SkillCategory
from app.repositories.base import BaseRepository


class SkillRepository(BaseRepository[Skill]):
    model = Skill

    async def search(self, query: str | None, category: str | None, limit: int) -> list[Skill]:
        stmt = select(Skill).where(Skill.is_active.is_(True))
        if category:
            stmt = stmt.join(SkillCategory, Skill.category_id == SkillCategory.id).where(
                SkillCategory.code == category
            )
        if query:
            pattern = f"%{query}%"
            alias_match = select(SkillAlias.skill_id).where(SkillAlias.alias.ilike(pattern))
            stmt = stmt.where(or_(Skill.name.ilike(pattern), Skill.id.in_(alias_match))).order_by(
                func.similarity(func.lower(Skill.name), query.lower()).desc(), Skill.name
            )
        else:
            stmt = stmt.order_by(Skill.name)
        result = await self.session.execute(stmt.limit(limit))
        return list(result.scalars().unique().all())

    async def get_many(self, ids: list[uuid.UUID]) -> list[Skill]:
        if not ids:
            return []
        result = await self.session.execute(select(Skill).where(Skill.id.in_(ids)))
        return list(result.scalars().unique().all())

    async def name_or_alias_exists(self, name: str) -> bool:
        stmt = select(
            or_(
                select(Skill.id).where(Skill.name == name).exists(),
                select(SkillAlias.id).where(SkillAlias.alias == name).exists(),
            )
        )
        return bool(await self.session.scalar(stmt))

    async def categories(self) -> list[SkillCategory]:
        result = await self.session.execute(select(SkillCategory).order_by(SkillCategory.name))
        return list(result.scalars().all())

    async def category_by_code(self, code: str) -> SkillCategory | None:
        return await self.session.scalar(select(SkillCategory).where(SkillCategory.code == code))
