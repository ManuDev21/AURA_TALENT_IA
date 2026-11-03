import uuid
from typing import Any

from fastapi import APIRouter, status

from app.core.deps import Audit, Authorized, DbSession
from app.schemas.assessments import (
    AnswerIn,
    AssignableVersion,
    AssignmentCreate,
    AttemptResult,
    AttemptSession,
    AttemptStart,
    AttemptSummary,
    CatalogItem,
    CompanyAssessmentView,
    InstrumentImport,
    InstrumentSummary,
    ShareUpdate,
    VersionIntro,
)
from app.services.assessment_service import AssessmentService
from app.services.instrument_service import InstrumentService

router = APIRouter(tags=["assessments"])

Taker = Authorized("assessments:take")
Results = Authorized("assessments:read_own_results")
Admin = Authorized("psychometrics:manage")


# ------------------------------------------------------------------ candidato
@router.get("/assessments/catalog", response_model=list[CatalogItem])
async def catalog(db: DbSession, principal: Taker, audit: Audit) -> list[CatalogItem]:
    return await AssessmentService(db, principal, audit).catalog()


@router.get("/assessments/versions/{version_id}", response_model=VersionIntro)
async def intro(version_id: uuid.UUID, db: DbSession, principal: Taker, audit: Audit) -> VersionIntro:
    return await AssessmentService(db, principal, audit).intro(version_id)


@router.post("/assessments/attempts", response_model=AttemptSession, status_code=status.HTTP_201_CREATED)
async def start(data: AttemptStart, db: DbSession, principal: Taker, audit: Audit) -> AttemptSession:
    return await AssessmentService(db, principal, audit).start(data)


@router.get("/assessments/attempts/me", response_model=list[AttemptSummary])
async def history(db: DbSession, principal: Results, audit: Audit) -> list[AttemptSummary]:
    return await AssessmentService(db, principal, audit).history()


@router.get("/assessments/attempts/{attempt_id}", response_model=AttemptSession)
async def attempt_session(
    attempt_id: uuid.UUID, db: DbSession, principal: Taker, audit: Audit
) -> AttemptSession:
    return await AssessmentService(db, principal, audit).session_view(attempt_id)


@router.put("/assessments/attempts/{attempt_id}/answers", status_code=status.HTTP_204_NO_CONTENT)
async def answer(
    attempt_id: uuid.UUID, data: AnswerIn, db: DbSession, principal: Taker, audit: Audit
) -> None:
    await AssessmentService(db, principal, audit).answer(attempt_id, data)


@router.post("/assessments/attempts/{attempt_id}/submit", response_model=AttemptResult)
async def submit(attempt_id: uuid.UUID, db: DbSession, principal: Taker, audit: Audit) -> AttemptResult:
    return await AssessmentService(db, principal, audit).submit(attempt_id)


@router.get("/assessments/attempts/{attempt_id}/result", response_model=AttemptResult)
async def result(attempt_id: uuid.UUID, db: DbSession, principal: Results, audit: Audit) -> AttemptResult:
    return await AssessmentService(db, principal, audit).result(attempt_id)


@router.patch("/assessments/attempts/{attempt_id}/sharing", response_model=AttemptResult)
async def sharing(
    attempt_id: uuid.UUID, data: ShareUpdate, db: DbSession, principal: Results, audit: Audit
) -> AttemptResult:
    return await AssessmentService(db, principal, audit).set_sharing(attempt_id, data.share_with_company)


# -------------------------------------------------------------------- empresa
@router.get("/assessments/assignable", response_model=list[AssignableVersion])
async def assignable(
    db: DbSession, principal: Authorized("assessments:assign"), audit: Audit
) -> list[AssignableVersion]:
    return await AssessmentService(db, principal, audit).assignable()


@router.post(
    "/assessments/assignments", response_model=CompanyAssessmentView, status_code=status.HTTP_201_CREATED
)
async def assign(
    data: AssignmentCreate, db: DbSession, principal: Authorized("assessments:assign"), audit: Audit
) -> CompanyAssessmentView:
    return await AssessmentService(db, principal, audit).assign(data)


@router.get("/applications/{application_id}/assessments", response_model=list[CompanyAssessmentView])
async def application_assessments(
    application_id: uuid.UUID,
    db: DbSession,
    principal: Authorized("assessments:read_company_results"),
    audit: Audit,
) -> list[CompanyAssessmentView]:
    return await AssessmentService(db, principal, audit).application_assessments(application_id)


# ------------------------------------------------------------ administracion
@router.get("/psychometrics/instruments", response_model=list[InstrumentSummary], tags=["psychometrics"])
async def instruments(db: DbSession, principal: Admin, audit: Audit) -> list[InstrumentSummary]:
    return await InstrumentService(db, principal, audit).list_instruments()


@router.post("/psychometrics/instruments", status_code=status.HTTP_201_CREATED, tags=["psychometrics"])
async def import_instrument(
    data: InstrumentImport, db: DbSession, principal: Admin, audit: Audit
) -> dict[str, Any]:
    return await InstrumentService(db, principal, audit).import_instrument(data)


@router.get("/psychometrics/versions/{version_id}", tags=["psychometrics"])
async def version_detail(
    version_id: uuid.UUID, db: DbSession, principal: Admin, audit: Audit
) -> dict[str, Any]:
    return await InstrumentService(db, principal, audit).version_detail(version_id)


@router.post("/psychometrics/versions/{version_id}/publish", tags=["psychometrics"])
async def publish(version_id: uuid.UUID, db: DbSession, principal: Admin, audit: Audit) -> dict[str, Any]:
    return await InstrumentService(db, principal, audit).publish(version_id)


@router.post("/psychometrics/versions/{version_id}/retire", tags=["psychometrics"])
async def retire(version_id: uuid.UUID, db: DbSession, principal: Admin, audit: Audit) -> dict[str, Any]:
    return await InstrumentService(db, principal, audit).retire(version_id)


@router.post(
    "/psychometrics/versions/{version_id}/clone", status_code=status.HTTP_201_CREATED, tags=["psychometrics"]
)
async def clone(version_id: uuid.UUID, db: DbSession, principal: Admin, audit: Audit) -> dict[str, Any]:
    return await InstrumentService(db, principal, audit).clone(version_id)
