from fastapi import APIRouter, Request

from app.core.context import ClientInfo
from app.core.deps import CurrentPrincipal, DbSession
from app.repositories.consent_repository import ConsentRepository
from app.schemas.user import ConsentRead, UserMe, UserUpdate
from app.services.audit_service import AuditService
from app.services.user_service import UserService, to_user_me

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMe)
async def get_me(principal: CurrentPrincipal) -> UserMe:
    return to_user_me(principal.user)


@router.patch("/me", response_model=UserMe)
async def update_me(request: Request, data: UserUpdate, principal: CurrentPrincipal, db: DbSession) -> UserMe:
    service = UserService(db, AuditService(db, ClientInfo.from_request(request)))
    user = await service.update_me(principal, data)
    return to_user_me(user)


@router.get("/me/consents", response_model=list[ConsentRead])
async def my_consents(principal: CurrentPrincipal, db: DbSession) -> list[ConsentRead]:
    consents = await ConsentRepository(db).list_for_user(principal.id)
    return [ConsentRead.model_validate(c) for c in consents]
