import uuid
from typing import Literal

from fastapi import APIRouter, Response

from app.core.deps import Audit, Authorized, DbSession
from app.services.analytics_service import AnalyticsService
from app.services.report_service import ReportService

router = APIRouter(tags=["analytics"])

MEDIA = {
    "pdf": "application/pdf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _file(content: bytes, name: str, fmt: str) -> Response:
    return Response(
        content,
        media_type=MEDIA[fmt],
        headers={"Content-Disposition": f'attachment; filename="{name}"', "Cache-Control": "no-store"},
    )


@router.get("/analytics/company")
async def company_analytics(
    db: DbSession,
    principal: Authorized("analytics:read_company"),
    audit: Audit,
    job_id: uuid.UUID | None = None,
) -> dict:
    return await AnalyticsService(db, principal, audit).company(job_id)


@router.get("/analytics/me")
async def my_analytics(db: DbSession, principal: Authorized("analytics:read_own"), audit: Audit) -> dict:
    return await AnalyticsService(db, principal, audit).personal()


@router.get("/reports/jobs/{job_id}.{fmt}", response_class=Response, tags=["reports"])
async def vacancy_report(
    job_id: uuid.UUID,
    fmt: Literal["pdf", "xlsx"],
    db: DbSession,
    principal: Authorized("reports:generate_company"),
    audit: Audit,
) -> Response:
    content, name = await ReportService(db, principal, audit).vacancy(job_id, fmt)
    return _file(content, name, fmt)


@router.get("/reports/me.pdf", response_class=Response, tags=["reports"])
async def personal_report(
    db: DbSession, principal: Authorized("reports:generate_own"), audit: Audit
) -> Response:
    content, name = await ReportService(db, principal, audit).personal()
    return _file(content, name, "pdf")
