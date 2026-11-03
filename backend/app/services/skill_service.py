from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ValidationFailedError
from app.core.principal import Principal
from app.models import Skill, SkillAlias
from app.repositories.company_repository import slugify
from app.repositories.skill_repository import SkillRepository
from app.schemas.skills import SkillCreate, SkillRead
from app.services.audit_service import AuditService


class SkillCatalogService:
    def __init__(self, session: AsyncSession, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit
        self.skills = SkillRepository(session)

    async def create(self, data: SkillCreate) -> SkillRead:
        name = data.name.strip()
        category = await self.skills.category_by_code(data.category_code)
        if category is None:
            raise ValidationFailedError("La categoria no existe.")
        aliases = list(
            dict.fromkeys(a.strip() for a in data.aliases if a.strip() and a.strip().lower() != name.lower())
        )
        for candidate in [name, *aliases]:
            if await self.skills.name_or_alias_exists(candidate):
                raise ConflictError(f'"{candidate}" ya existe en el catalogo.', code="skill_exists")

        skill = self.skills.add(
            Skill(name=name, slug=slugify(name)[:120], category_id=category.id, skill_type=data.skill_type)
        )
        await self.session.flush()
        for alias in aliases:
            self.session.add(SkillAlias(skill_id=skill.id, alias=alias))
        self.audit.record(
            module="catalogs",
            action="skills.create",
            result="success",
            actor_user_id=self.principal.id,
            entity_type="skill",
            entity_id=skill.id,
            changes={"name": name, "aliases": aliases},
        )
        await self.session.commit()
        await self.session.refresh(skill, ["category"])
        return SkillRead.model_validate(skill)
