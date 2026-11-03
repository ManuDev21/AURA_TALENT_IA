from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import ClientInfo
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.principal import Principal
from app.core.security import decode_access_token
from app.database.session import get_db
from app.repositories.user_repository import UserRepository
from app.services.audit_service import AuditService

DbSession = Annotated[AsyncSession, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False)


async def get_current_principal(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Principal:
    if credentials is None:
        raise UnauthorizedError("Se requiere autenticacion.", code="not_authenticated")
    user_id = decode_access_token(credentials.credentials)
    user = await UserRepository(db).get_with_roles(user_id)
    if user is None or user.status != "active":
        raise UnauthorizedError("La cuenta no esta disponible.", code="account_unavailable")
    return Principal.from_user(user)


CurrentPrincipal = Annotated[Principal, Depends(get_current_principal)]


def require_permissions(*codes: str) -> Callable[[Principal], Awaitable[Principal]]:
    async def _checker(principal: CurrentPrincipal) -> Principal:
        if not principal.has_permissions(*codes):
            raise ForbiddenError("No tienes permiso para realizar esta accion.", code="missing_permission")
        return principal

    return _checker


def Authorized(*codes: str) -> type[Principal]:  # noqa: N802
    """Anotacion de dependencia: principal autenticado que posee todos los permisos indicados."""
    return Annotated[Principal, Depends(require_permissions(*codes))]  # type: ignore[return-value]


def get_audit(request: Request, db: DbSession) -> AuditService:
    return AuditService(db, ClientInfo.from_request(request))


Audit = Annotated[AuditService, Depends(get_audit)]
