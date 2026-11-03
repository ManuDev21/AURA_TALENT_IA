import uuid

from sqlalchemy import select

from app.models import Role, User, UserRole
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(self._active().where(User.email == email))
        return result.scalar_one_or_none()

    async def get_with_roles(self, user_id: uuid.UUID) -> User | None:
        # populate_existing refresca roles/permisos aunque el objeto ya este en la sesion
        stmt = self._active().where(User.id == user_id).execution_options(populate_existing=True)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


class RoleRepository(BaseRepository[Role]):
    model = Role

    async def get_by_code(self, code: str) -> Role:
        result = await self.session.execute(select(Role).where(Role.code == code))
        return result.scalar_one()

    async def list_all(self) -> list[Role]:
        result = await self.session.execute(select(Role).order_by(Role.code))
        return list(result.scalars().all())

    def assign(self, user_id: uuid.UUID, role: Role, company_id: uuid.UUID | None = None) -> UserRole:
        user_role = UserRole(user_id=user_id, role_id=role.id, company_id=company_id)
        self.session.add(user_role)
        return user_role
