import uuid
from dataclasses import dataclass

from app.models import User


@dataclass(frozen=True, slots=True)
class Principal:
    """Usuario autenticado con sus roles y permisos resueltos para la peticion actual."""

    user: User
    role_codes: frozenset[str]
    permissions: frozenset[str]
    company_ids: frozenset[uuid.UUID]

    @property
    def id(self) -> uuid.UUID:
        return self.user.id

    @classmethod
    def from_user(cls, user: User) -> "Principal":
        return cls(
            user=user,
            role_codes=frozenset(ur.role.code for ur in user.roles),
            permissions=frozenset(p.code for ur in user.roles for p in ur.role.permissions),
            company_ids=frozenset(ur.company_id for ur in user.roles if ur.company_id is not None),
        )

    def has_permissions(self, *codes: str) -> bool:
        return all(code in self.permissions for code in codes)

    def belongs_to_company(self, company_id: uuid.UUID) -> bool:
        return company_id in self.company_ids
