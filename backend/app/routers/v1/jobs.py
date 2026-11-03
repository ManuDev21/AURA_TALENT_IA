import csv
import io
import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status
from fastapi.responses import Response

from app.core.deps import Audit, Authorized, CurrentPrincipal, DbSession
from app.core.principal import Principal
from app.repositories.candidate_repository import CandidateProfileRepository
from app.schemas.jobs import (
    ApplicantBrief,
    JobCompanyItem,
    JobImportBatch,
    JobImportResult,
    JobIn,
    JobPage,
    JobPublic,
    JobStatus,
    JobStatusChange,
)
from app.services.application_service import ApplicationService
from app.services.job_service import JobService

router = APIRouter(prefix="/jobs", tags=["jobs"])

Reader = Authorized("jobs:read")
Writer = Authorized("jobs:write")


async def _candidate_id(db: DbSession, principal: Principal) -> uuid.UUID | None:
    profile = await CandidateProfileRepository(db).get_by_user(principal.id)
    return profile.id if profile else None


# ------------------------------------------------------ busqueda (candidatos)
@router.get("", response_model=JobPage)
async def search_jobs(
    db: DbSession,
    principal: Reader,
    audit: Audit,
    q: Annotated[str | None, Query(max_length=100)] = None,
    modality: Annotated[str | None, Query(pattern="^(remote|hybrid|onsite)$")] = None,
    skill_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobPage:
    service = JobService(db, principal, audit)
    return await service.search(
        q.strip() if q else None, modality, skill_id, limit, offset, await _candidate_id(db, principal)
    )


# -------------------------------------------------------------- empresa
@router.get("/company", response_model=list[JobCompanyItem])
async def company_jobs(
    db: DbSession,
    principal: Authorized("applications:read_company"),
    audit: Audit,
    status: JobStatus | None = None,
) -> list[JobCompanyItem]:
    return await JobService(db, principal, audit).company_jobs(status)


@router.post("", response_model=JobCompanyItem, status_code=status.HTTP_201_CREATED)
async def create_job(data: JobIn, db: DbSession, principal: Writer, audit: Audit) -> JobCompanyItem:
    return await JobService(db, principal, audit).create(data)


@router.get("/company/export.csv", response_class=Response)
async def export_company_jobs_csv(
    db: DbSession, principal: Authorized("applications:read_company"), audit: Audit
) -> Response:
    jobs = await JobService(db, principal, audit).company_jobs()
    output = io.StringIO(newline="")
    columns = [
        "title",
        "description",
        "location",
        "modality",
        "employment_type",
        "salary_min",
        "salary_max",
        "salary_currency",
        "show_salary",
        "experience_min_years",
        "education_level",
        "responsibilities",
        "benefits",
        "schedule_description",
        "response_sla_days",
        "process_estimate_days",
        "closes_at",
        "skills_json",
        "languages_json",
        "requirements_json",
    ]
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for job in jobs:
        row = job.model_dump(mode="json")
        row["responsibilities"] = " | ".join(row["responsibilities"])
        row["benefits"] = " | ".join(row["benefits"])
        row["skills_json"] = json.dumps(
            [
                {
                    "name": skill["skill"]["name"],
                    "importance": skill["importance"],
                    "min_proficiency": skill["min_proficiency"],
                }
                for skill in row["skills"]
            ]
        )
        row["languages_json"] = json.dumps(row["languages"])
        row["requirements_json"] = json.dumps(
            [
                {
                    "requirement_type": item["requirement_type"],
                    "description": item["description"],
                    "is_required": item["is_required"],
                }
                for item in row["requirements"]
            ]
        )
        for key, value in row.items():
            if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t"):
                row[key] = "'" + value
        writer.writerow(row)
    return Response(
        output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="aura-vacantes.csv"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/company/import", response_model=JobImportResult, status_code=status.HTTP_201_CREATED)
async def import_company_jobs(
    data: JobImportBatch, db: DbSession, principal: Writer, audit: Audit
) -> JobImportResult:
    created = await JobService(db, principal, audit).import_drafts(data.items)
    return JobImportResult(created=len(created), job_ids=[job.id for job in created])


@router.post("/company/{job_id}/confirm-active", response_model=JobCompanyItem)
async def confirm_job_active(
    job_id: uuid.UUID,
    db: DbSession,
    principal: Authorized("jobs:publish"),
    audit: Audit,
) -> JobCompanyItem:
    return await JobService(db, principal, audit).confirm_active(job_id)


@router.get("/company/{job_id}", response_model=JobCompanyItem)
async def company_job(
    job_id: uuid.UUID, db: DbSession, principal: Authorized("applications:read_company"), audit: Audit
) -> JobCompanyItem:
    return await JobService(db, principal, audit).company_item(job_id)


@router.put("/{job_id}", response_model=JobCompanyItem)
async def update_job(
    job_id: uuid.UUID, data: JobIn, db: DbSession, principal: Writer, audit: Audit
) -> JobCompanyItem:
    return await JobService(db, principal, audit).update(job_id, data)


@router.post("/{job_id}/status", response_model=JobCompanyItem)
async def change_status(
    job_id: uuid.UUID,
    data: JobStatusChange,
    db: DbSession,
    principal: Authorized("jobs:publish"),
    audit: Audit,
) -> JobCompanyItem:
    return await JobService(db, principal, audit).change_status(job_id, data.status)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: uuid.UUID, db: DbSession, principal: Writer, audit: Audit) -> None:
    await JobService(db, principal, audit).delete(job_id)


@router.get("/{job_id}/applications", response_model=list[ApplicantBrief])
async def job_applications(
    job_id: uuid.UUID, db: DbSession, principal: Authorized("applications:read_company"), audit: Audit
) -> list[ApplicantBrief]:
    return await ApplicationService(db, principal, audit).job_applicants(job_id)


# --------------------------------------------------------------- detalle
@router.get("/{job_id}", response_model=JobPublic)
async def get_job(job_id: uuid.UUID, db: DbSession, principal: CurrentPrincipal, audit: Audit) -> JobPublic:
    return await JobService(db, principal, audit).public_job(job_id, await _candidate_id(db, principal))
