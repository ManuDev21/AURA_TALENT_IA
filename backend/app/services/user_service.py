from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.principal import Principal
from app.models import User
from app.repositories.token_repository import RefreshTokenRepository
from app.schemas.user import RoleAssignment, UserMe, UserUpdate
from app.services.audit_service import AuditService


def to_user_me(user: User) -> UserMe:
    principal = Principal.from_user(user)
    return UserMe(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        locale=user.locale,
        status=user.status,
        roles=[RoleAssignment(code=ur.role.code, company_id=ur.company_id) for ur in user.roles],
        permissions=sorted(principal.permissions),
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


class UserService:
    def __init__(self, session: AsyncSession, audit: AuditService) -> None:
        self.session = session
        self.audit = audit

    async def update_me(self, principal: Principal, data: UserUpdate) -> User:
        user = principal.user
        changes = data.model_dump(exclude_unset=True, exclude_none=True)
        for field, value in changes.items():
            setattr(user, field, value.strip() if isinstance(value, str) else value)
        if changes:
            self.audit.record(
                module="users",
                action="users.update_me",
                result="success",
                actor_user_id=user.id,
                entity_type="user",
                entity_id=user.id,
                changes={"fields": sorted(changes)},
            )
            await self.session.commit()
            await self.session.refresh(user, ["updated_at"])
        return user

    async def delete_me(self, principal: Principal) -> None:
        """Borra la cuenta del usuario autenticado (borrado logico).

        Marca status=deleted + deleted_at, revoca todas las sesiones y lo
        audita. La informacion se conserva por integridad referencial, pero
        el usuario ya no puede autenticarse (status != active bloquea login,
        refresh y cualquier peticion con su token).
        """
        user = principal.user
        now = datetime.now(UTC)
        user.status = "suspended"
        user.deleted_at = now
        await RefreshTokenRepository(self.session).revoke_all_for_user(user.id, now)
        self.audit.record(
            module="users",
            action="users.delete_me",
            result="success",
            actor_user_id=user.id,
            entity_type="user",
            entity_id=user.id,
            changes={"status": ["active", "suspended"], "deleted_at": now.isoformat()},
        )
        await self.session.commit()
