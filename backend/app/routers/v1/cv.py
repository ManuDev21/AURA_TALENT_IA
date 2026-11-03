import uuid

from fastapi import APIRouter, BackgroundTasks, File, Request, Response, UploadFile, status

from app.core.deps import Audit, Authorized, DbSession
from app.core.rate_limit import limiter
from app.schemas.cv import (
    ConfirmResult,
    CvConfirm,
    DocumentRead,
    ResumeCreate,
    ResumeDetail,
    ResumeDuplicate,
    ResumeSummary,
    ResumeUpdate,
    SectionsReplace,
    VersionCreate,
    VersionRead,
)
from app.services.cv_document_service import CvDocumentService, process_document, to_read
from app.services.cv_service import CvService
from app.services.storage import MAX_UPLOAD_BYTES

router = APIRouter(prefix="/cv", tags=["cv"])

Reader = Authorized("cv:read_own")
Writer = Authorized("cv:write_own")


# ------------------------------------------------------------------ CV Builder
@router.get("/resumes", response_model=list[ResumeSummary])
async def list_resumes(db: DbSession, principal: Reader, audit: Audit) -> list[ResumeSummary]:
    return await CvService(db, principal, audit).list_resumes()


@router.post("/resumes", response_model=ResumeDetail, status_code=status.HTTP_201_CREATED)
async def create_resume(data: ResumeCreate, db: DbSession, principal: Writer, audit: Audit) -> ResumeDetail:
    return await CvService(db, principal, audit).create(data)


@router.get("/resumes/{resume_id}", response_model=ResumeDetail)
async def get_resume(resume_id: uuid.UUID, db: DbSession, principal: Reader, audit: Audit) -> ResumeDetail:
    return await CvService(db, principal, audit).detail(resume_id)


@router.patch("/resumes/{resume_id}", response_model=ResumeDetail)
async def update_resume(
    resume_id: uuid.UUID, data: ResumeUpdate, db: DbSession, principal: Writer, audit: Audit
) -> ResumeDetail:
    return await CvService(db, principal, audit).update(resume_id, data)


@router.delete("/resumes/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(resume_id: uuid.UUID, db: DbSession, principal: Writer, audit: Audit) -> None:
    await CvService(db, principal, audit).delete(resume_id)


@router.post(
    "/resumes/{resume_id}/duplicate", response_model=ResumeDetail, status_code=status.HTTP_201_CREATED
)
async def duplicate_resume(
    resume_id: uuid.UUID, data: ResumeDuplicate, db: DbSession, principal: Writer, audit: Audit
) -> ResumeDetail:
    return await CvService(db, principal, audit).duplicate(resume_id, data)


@router.put("/resumes/{resume_id}/sections", response_model=ResumeDetail)
async def replace_sections(
    resume_id: uuid.UUID, data: SectionsReplace, db: DbSession, principal: Writer, audit: Audit
) -> ResumeDetail:
    return await CvService(db, principal, audit).replace_sections(resume_id, data.sections)


@router.post("/resumes/{resume_id}/sections/{section_id}/sync", response_model=ResumeDetail)
async def sync_section(
    resume_id: uuid.UUID, section_id: uuid.UUID, db: DbSession, principal: Writer, audit: Audit
) -> ResumeDetail:
    return await CvService(db, principal, audit).sync_section(resume_id, section_id)


@router.get("/resumes/{resume_id}/versions", response_model=list[VersionRead])
async def list_versions(
    resume_id: uuid.UUID, db: DbSession, principal: Reader, audit: Audit
) -> list[VersionRead]:
    return await CvService(db, principal, audit).versions(resume_id)


@router.post(
    "/resumes/{resume_id}/versions", response_model=ResumeDetail, status_code=status.HTTP_201_CREATED
)
async def save_version(
    resume_id: uuid.UUID, data: VersionCreate, db: DbSession, principal: Writer, audit: Audit
) -> ResumeDetail:
    return await CvService(db, principal, audit).save_version(resume_id, data.note)


@router.post("/resumes/{resume_id}/versions/{version_id}/restore", response_model=ResumeDetail)
async def restore_version(
    resume_id: uuid.UUID, version_id: uuid.UUID, db: DbSession, principal: Writer, audit: Audit
) -> ResumeDetail:
    return await CvService(db, principal, audit).restore(resume_id, version_id)


@router.get("/resumes/{resume_id}/export.pdf", response_class=Response)
async def export_pdf(resume_id: uuid.UUID, db: DbSession, principal: Reader, audit: Audit) -> Response:
    pdf, filename = await CvService(db, principal, audit).export_pdf(resume_id)
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


# ----------------------------------------------------------------- CV Analyzer
@router.post("/documents", response_model=DocumentRead, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
async def upload_document(
    request: Request,
    background: BackgroundTasks,
    db: DbSession,
    principal: Writer,
    audit: Audit,
    file: UploadFile = File(...),
) -> DocumentRead:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    document = await CvDocumentService(db, principal, audit).upload(file.filename or "cv", data)
    background.add_task(process_document, document.id)
    return to_read(document)


@router.get("/documents", response_model=list[DocumentRead])
async def list_documents(db: DbSession, principal: Reader, audit: Audit) -> list[DocumentRead]:
    return [to_read(d) for d in await CvDocumentService(db, principal, audit).list_documents()]


@router.get("/documents/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: uuid.UUID, db: DbSession, principal: Reader, audit: Audit
) -> DocumentRead:
    return to_read(await CvDocumentService(db, principal, audit).get(document_id))


@router.post("/documents/{document_id}/confirm", response_model=ConfirmResult)
async def confirm_document(
    document_id: uuid.UUID, data: CvConfirm, db: DbSession, principal: Writer, audit: Audit
) -> ConfirmResult:
    return await CvDocumentService(db, principal, audit).confirm(document_id, data)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: uuid.UUID, db: DbSession, principal: Writer, audit: Audit) -> None:
    await CvDocumentService(db, principal, audit).delete(document_id)
