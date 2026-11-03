import uuid

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.core.deps import Audit, Authorized, DbSession
from app.schemas.skills import OpenBadgeImportIn, SkillEvidenceIn, SkillEvidenceRead, SkillEvidenceShare
from app.services.skill_passport_service import SkillPassportService

router = APIRouter(prefix="/candidates/me", tags=["skills-passport"])
Reader = Authorized("profile:read_own")
Writer = Authorized("profile:write_own")


@router.get("/skill-evidence", response_model=list[SkillEvidenceRead])
async def list_evidence(db: DbSession, principal: Reader, audit: Audit) -> list[SkillEvidenceRead]:
    return await SkillPassportService(db, principal, audit).list_evidence()


@router.post("/skill-evidence", response_model=SkillEvidenceRead, status_code=status.HTTP_201_CREATED)
async def add_evidence(
    data: SkillEvidenceIn, db: DbSession, principal: Writer, audit: Audit
) -> SkillEvidenceRead:
    return await SkillPassportService(db, principal, audit).add(data)


@router.post(
    "/skill-evidence/open-badge", response_model=SkillEvidenceRead, status_code=status.HTTP_201_CREATED
)
async def import_open_badge(
    data: OpenBadgeImportIn, db: DbSession, principal: Writer, audit: Audit
) -> SkillEvidenceRead:
    return await SkillPassportService(db, principal, audit).import_open_badge(data)


@router.patch("/skill-evidence/{evidence_id}", response_model=SkillEvidenceRead)
async def set_evidence_sharing(
    evidence_id: uuid.UUID,
    data: SkillEvidenceShare,
    db: DbSession,
    principal: Writer,
    audit: Audit,
) -> SkillEvidenceRead:
    return await SkillPassportService(db, principal, audit).set_sharing(
        evidence_id, data.share_with_companies
    )


@router.delete("/skill-evidence/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evidence(evidence_id: uuid.UUID, db: DbSession, principal: Writer, audit: Audit) -> None:
    await SkillPassportService(db, principal, audit).remove(evidence_id)


@router.get("/skills-passport")
async def export_passport(db: DbSession, principal: Reader, audit: Audit) -> JSONResponse:
    payload = await SkillPassportService(db, principal, audit).export()
    audit.record(
        module="skills_passport",
        action="passport_exported",
        result="success",
        actor_user_id=principal.id,
    )
    await db.commit()
    return JSONResponse(
        payload,
        headers={
            "Content-Disposition": 'attachment; filename="aura-skills-passport.json"',
            "Cache-Control": "no-store",
        },
    )
