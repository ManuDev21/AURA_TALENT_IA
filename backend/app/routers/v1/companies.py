import uuid

from fastapi import APIRouter, status

from app.core.deps import Audit, Authorized, DbSession
from app.schemas.company import CompanyRead, CompanyUpdate, CompanyWorkspace, MemberInvite, MemberRead
from app.services.company_service import CompanyService
from app.services.mail_service import MailService

router = APIRouter(prefix="/companies/current", tags=["companies"])


@router.get("", response_model=CompanyWorkspace)
async def current_company(
    db: DbSession, principal: Authorized("companies:read"), audit: Audit
) -> CompanyWorkspace:
    return await CompanyService(db, principal, audit).workspace()


@router.patch("", response_model=CompanyRead)
async def update_company(
    data: CompanyUpdate, db: DbSession, principal: Authorized("companies:write"), audit: Audit
) -> CompanyRead:
    return await CompanyService(db, principal, audit).update(data)


@router.get("/members", response_model=list[MemberRead])
async def list_members(
    db: DbSession, principal: Authorized("companies:read"), audit: Audit
) -> list[MemberRead]:
    return await CompanyService(db, principal, audit).members()


@router.post("/members", response_model=MemberRead, status_code=status.HTTP_201_CREATED)
async def invite_member(
    data: MemberInvite, db: DbSession, principal: Authorized("companies:manage_members"), audit: Audit
) -> MemberRead:
    return await CompanyService(db, principal, audit).invite(data, MailService())


@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: uuid.UUID, db: DbSession, principal: Authorized("companies:manage_members"), audit: Audit
) -> None:
    await CompanyService(db, principal, audit).remove_member(user_id)
