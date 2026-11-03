import uuid

from fastapi import APIRouter, Query

from app.core.deps import Audit, Authorized, DbSession
from app.schemas.match import ApplicantMatch, GapReport, MatchBrief, MatchRead
from app.services.match_service import MatchService

router = APIRouter(prefix="/match", tags=["match"])

Own = Authorized("match:read_own")
CompanyMatch = Authorized("match:read_company")


@router.get("/me/top", response_model=list[MatchBrief])
async def my_top(
    db: DbSession, principal: Own, audit: Audit, limit: int = Query(10, ge=1, le=30)
) -> list[MatchBrief]:
    return await MatchService(db, principal, audit).my_top(limit)


@router.get("/me/gaps", response_model=GapReport)
async def my_gaps(db: DbSession, principal: Own, audit: Audit) -> GapReport:
    return await MatchService(db, principal, audit).my_gaps()


@router.get("/me/jobs/{job_id}", response_model=MatchRead)
async def my_match(job_id: uuid.UUID, db: DbSession, principal: Own, audit: Audit) -> MatchRead:
    return await MatchService(db, principal, audit).my_match(job_id)


@router.get("/applications/{application_id}", response_model=MatchRead)
async def application_match(
    application_id: uuid.UUID, db: DbSession, principal: CompanyMatch, audit: Audit
) -> MatchRead:
    return await MatchService(db, principal, audit).application_match(application_id)


@router.get("/jobs/{job_id}/applicants", response_model=list[ApplicantMatch])
async def job_applicants(
    job_id: uuid.UUID, db: DbSession, principal: CompanyMatch, audit: Audit
) -> list[ApplicantMatch]:
    return await MatchService(db, principal, audit).job_applicants(job_id)
