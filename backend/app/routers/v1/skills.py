from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import Audit, Authorized, CurrentPrincipal, DbSession
from app.repositories.skill_repository import SkillRepository
from app.schemas.skills import SkillCategoryRead, SkillCreate, SkillRead
from app.services.skill_service import SkillCatalogService

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("", response_model=list[SkillRead])
async def search_skills(
    db: DbSession,
    _: CurrentPrincipal,
    q: Annotated[str | None, Query(max_length=60)] = None,
    category: Annotated[str | None, Query(max_length=50)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[SkillRead]:
    skills = await SkillRepository(db).search(q.strip() if q else None, category, limit)
    return [SkillRead.model_validate(s) for s in skills]


@router.get("/categories", response_model=list[SkillCategoryRead])
async def categories(db: DbSession, _: CurrentPrincipal) -> list[SkillCategoryRead]:
    return [SkillCategoryRead.model_validate(c) for c in await SkillRepository(db).categories()]


@router.post("", response_model=SkillRead, status_code=status.HTTP_201_CREATED)
async def create_skill(
    data: SkillCreate, db: DbSession, principal: Authorized("admin:catalogs"), audit: Audit
) -> SkillRead:
    return await SkillCatalogService(db, principal, audit).create(data)
