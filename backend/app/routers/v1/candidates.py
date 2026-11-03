import uuid

from fastapi import APIRouter, status
from pydantic import BaseModel

from app.core.deps import Audit, Authorized, DbSession
from app.schemas.candidate import (
    CandidateOverview,
    CertificationIn,
    EducationIn,
    ExperienceIn,
    LanguageIn,
    LinkIn,
    ProfileRead,
    ProfileUpdate,
)
from app.schemas.skills import CandidateSkillRead, CandidateSkillUpsert, IndicatorsRead
from app.services.candidate_service import ITEM_KINDS, CandidateService

router = APIRouter(prefix="/candidates/me", tags=["candidates"])

Reader = Authorized("profile:read_own")
Writer = Authorized("profile:write_own")


@router.get("", response_model=CandidateOverview)
async def overview(db: DbSession, principal: Reader, audit: Audit) -> CandidateOverview:
    return await CandidateService(db, principal, audit).overview()


@router.patch("/profile", response_model=ProfileRead)
async def update_profile(data: ProfileUpdate, db: DbSession, principal: Writer, audit: Audit) -> ProfileRead:
    profile = await CandidateService(db, principal, audit).update_profile(data)
    return ProfileRead.model_validate(profile)


@router.get("/indicators", response_model=IndicatorsRead)
async def indicators(db: DbSession, principal: Reader, audit: Audit) -> IndicatorsRead:
    return await CandidateService(db, principal, audit).indicators()


@router.put("/skills/{skill_id}", response_model=CandidateSkillRead)
async def upsert_skill(
    skill_id: uuid.UUID, data: CandidateSkillUpsert, db: DbSession, principal: Writer, audit: Audit
) -> CandidateSkillRead:
    entry = await CandidateService(db, principal, audit).upsert_skill(skill_id, data)
    return CandidateSkillRead.model_validate(entry)


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(skill_id: uuid.UUID, db: DbSession, principal: Writer, audit: Audit) -> None:
    await CandidateService(db, principal, audit).delete_skill(skill_id)


def _register_item_routes(kind: str, schema_in: type[BaseModel]) -> None:
    read = ITEM_KINDS[kind].read

    async def create(data: schema_in, db: DbSession, principal: Writer, audit: Audit):  # type: ignore[valid-type]
        item = await CandidateService(db, principal, audit).create_item(kind, data)
        return read.model_validate(item)

    async def update(item_id: uuid.UUID, data: schema_in, db: DbSession, principal: Writer, audit: Audit):  # type: ignore[valid-type]
        item = await CandidateService(db, principal, audit).update_item(kind, item_id, data)
        return read.model_validate(item)

    async def remove(item_id: uuid.UUID, db: DbSession, principal: Writer, audit: Audit) -> None:
        await CandidateService(db, principal, audit).delete_item(kind, item_id)

    router.add_api_route(
        f"/{kind}", create, methods=["POST"], response_model=read, status_code=201, name=f"create_{kind}"
    )
    router.add_api_route(
        f"/{kind}/{{item_id}}", update, methods=["PUT"], response_model=read, name=f"update_{kind}"
    )
    router.add_api_route(
        f"/{kind}/{{item_id}}", remove, methods=["DELETE"], status_code=204, name=f"delete_{kind}"
    )


for _kind, _schema in (
    ("education", EducationIn),
    ("experiences", ExperienceIn),
    ("certifications", CertificationIn),
    ("languages", LanguageIn),
    ("links", LinkIn),
):
    _register_item_routes(_kind, _schema)
