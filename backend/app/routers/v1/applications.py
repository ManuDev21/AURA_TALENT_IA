import uuid

from fastapi import APIRouter, status

from app.core.deps import Audit, Authorized, CurrentPrincipal, DbSession
from app.schemas.jobs import (
    ApplicationCreate,
    ApplicationDetail,
    MyApplication,
    NoteIn,
    NoteRead,
    NotificationList,
    StageTransition,
)
from app.services.application_service import ApplicationService
from app.services.notification_service import NotificationService

router = APIRouter(tags=["applications"])

Company = Authorized("applications:read_company")


@router.post("/applications", response_model=MyApplication, status_code=status.HTTP_201_CREATED)
async def apply(
    data: ApplicationCreate, db: DbSession, principal: Authorized("applications:create"), audit: Audit
) -> MyApplication:
    return await ApplicationService(db, principal, audit).apply(data)


@router.get("/applications/me", response_model=list[MyApplication])
async def my_applications(
    db: DbSession, principal: Authorized("applications:read_own"), audit: Audit
) -> list[MyApplication]:
    return await ApplicationService(db, principal, audit).my_applications()


@router.post("/applications/{application_id}/withdraw", response_model=MyApplication)
async def withdraw(
    application_id: uuid.UUID, db: DbSession, principal: Authorized("applications:read_own"), audit: Audit
) -> MyApplication:
    return await ApplicationService(db, principal, audit).withdraw(application_id)


@router.get("/applications/{application_id}", response_model=ApplicationDetail)
async def application_detail(
    application_id: uuid.UUID, db: DbSession, principal: Company, audit: Audit
) -> ApplicationDetail:
    return await ApplicationService(db, principal, audit).detail(application_id)


@router.post("/applications/{application_id}/transition", response_model=ApplicationDetail)
async def transition(
    application_id: uuid.UUID,
    data: StageTransition,
    db: DbSession,
    principal: Authorized("applications:advance"),
    audit: Audit,
) -> ApplicationDetail:
    return await ApplicationService(db, principal, audit).transition(application_id, data)


@router.post(
    "/applications/{application_id}/notes", response_model=NoteRead, status_code=status.HTTP_201_CREATED
)
async def add_note(
    application_id: uuid.UUID,
    data: NoteIn,
    db: DbSession,
    principal: Authorized("applications:notes"),
    audit: Audit,
) -> NoteRead:
    return await ApplicationService(db, principal, audit).add_note(application_id, data)


# ------------------------------------------------------------ notificaciones
@router.get("/notifications/me", response_model=NotificationList, tags=["notifications"])
async def my_notifications(db: DbSession, principal: CurrentPrincipal) -> NotificationList:
    return await NotificationService(db, principal.id).list_notifications()


@router.post("/notifications/me/read-all", status_code=status.HTTP_204_NO_CONTENT, tags=["notifications"])
async def read_all(db: DbSession, principal: CurrentPrincipal) -> None:
    await NotificationService(db, principal.id).mark_all_read()


@router.post(
    "/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT, tags=["notifications"]
)
async def read_one(notification_id: uuid.UUID, db: DbSession, principal: CurrentPrincipal) -> None:
    await NotificationService(db, principal.id).mark_read(notification_id)
