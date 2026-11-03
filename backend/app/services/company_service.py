import uuid
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationFailedError
from app.core.principal import Principal
from app.core.roles import RoleCode
from app.core.security import generate_opaque_token, hash_password, hash_token, utcnow
from app.models import Company, CompanyUser, Role, User, UserRole, UserToken
from app.repositories.company_repository import CompanyRepository
from app.repositories.user_repository import RoleRepository, UserRepository
from app.schemas.company import CompanyRead, CompanyUpdate, CompanyWorkspace, MemberInvite, MemberRead
from app.services.audit_service import AuditService
from app.services.mail_service import MailService

INVITATION_HOURS = 72


class CompanyService:
    def __init__(self, session: AsyncSession, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit
        self.companies = CompanyRepository(session)

    async def current(self, company_id: uuid.UUID | None = None) -> Company:
        """Empresa activa del usuario. Nunca devuelve una empresa a la que no pertenece."""
        if company_id is None:
            if not self.principal.company_ids:
                raise ForbiddenError("Tu cuenta no pertenece a ninguna empresa.", code="no_company")
            company_id = sorted(self.principal.company_ids)[0]
        if not self.principal.belongs_to_company(company_id):
            raise NotFoundError("Empresa no encontrada.")
        company = await self.companies.get(company_id)
        if company is None:
            raise NotFoundError("Empresa no encontrada.")
        return company

    async def workspace(self, company_id: uuid.UUID | None = None) -> CompanyWorkspace:
        company = await self.current(company_id)
        return CompanyWorkspace(
            company=CompanyRead.model_validate(company),
            can_edit=self.principal.has_permissions("companies:write"),
            can_manage_members=self.principal.has_permissions("companies:manage_members"),
        )

    async def update(self, data: CompanyUpdate, company_id: uuid.UUID | None = None) -> CompanyRead:
        company = await self.current(company_id)
        changes = data.model_dump(exclude_unset=True)
        if "name" in changes and not changes["name"]:
            raise ValidationFailedError("El nombre de la empresa es obligatorio.")
        for field, value in changes.items():
            if field == "benefits" and value is None:
                value = []
            setattr(company, field, value)
        self._audit(company, "companies.update", company.id, {"fields": sorted(changes)})
        await self.session.commit()
        await self.session.refresh(company)
        return CompanyRead.model_validate(company)

    # ------------------------------------------------------------ miembros
    async def members(self, company_id: uuid.UUID | None = None) -> list[MemberRead]:
        company = await self.current(company_id)
        rows = (
            await self.session.execute(
                select(CompanyUser, User)
                .join(User, User.id == CompanyUser.user_id)
                .where(CompanyUser.company_id == company.id, CompanyUser.status != "removed")
                .order_by(CompanyUser.joined_at)
            )
        ).all()
        role_rows = (
            await self.session.execute(
                select(UserRole.user_id, Role.code)
                .join(Role, Role.id == UserRole.role_id)
                .where(UserRole.company_id == company.id)
            )
        ).all()
        roles: dict[uuid.UUID, list[str]] = {}
        for user_id, code in role_rows:
            roles.setdefault(user_id, []).append(code)
        return [
            MemberRead(
                user_id=user.id,
                full_name=user.full_name,
                email=user.email,
                position=member.position,
                status=member.status,
                roles=sorted(roles.get(user.id, [])),
                joined_at=member.joined_at,
            )
            for member, user in rows
        ]

    async def invite(
        self, data: MemberInvite, mail: MailService, company_id: uuid.UUID | None = None
    ) -> MemberRead:
        company = await self.current(company_id)
        users = UserRepository(self.session)
        role = await RoleRepository(self.session).get_by_code(data.role)
        user = await users.get_by_email(data.email)
        token: str | None = None

        if user is None:
            user = users.add(
                User(
                    email=data.email,
                    # Contrasena inutilizable: la persona define la suya con el enlace de invitacion
                    password_hash=hash_password(generate_opaque_token()),
                    full_name=data.full_name,
                    status="active",
                )
            )
            await self.session.flush()
            token = generate_opaque_token()
            self.session.add(
                UserToken(
                    user_id=user.id,
                    purpose="password_reset",
                    token_hash=hash_token(token),
                    expires_at=utcnow() + timedelta(hours=INVITATION_HOURS),
                )
            )
        else:
            member = await self.session.get(CompanyUser, (company.id, user.id))
            if member is not None and member.status != "removed":
                raise ConflictError("Esta persona ya es miembro de la empresa.", code="already_member")

        member = await self.session.get(CompanyUser, (company.id, user.id))
        if member is None:
            member = CompanyUser(
                company_id=company.id, user_id=user.id, position=data.position, status="active"
            )
            self.session.add(member)
        else:
            member.status = "active"
            member.position = data.position
        self.session.add(UserRole(user_id=user.id, role_id=role.id, company_id=company.id))
        self._audit(
            company, "companies.member_invite", user.id, {"role": data.role, "new_account": token is not None}
        )
        await self.session.commit()
        mail.send_invitation(user.email, token, company.name)
        await self.session.refresh(member)
        return MemberRead(
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
            position=member.position,
            status=member.status,
            roles=[data.role],
            joined_at=member.joined_at,
        )

    async def remove_member(self, user_id: uuid.UUID, company_id: uuid.UUID | None = None) -> None:
        company = await self.current(company_id)
        if user_id == self.principal.id:
            raise ValidationFailedError("No puedes quitarte a ti mismo de la empresa.", code="self_removal")
        member = await self.session.get(CompanyUser, (company.id, user_id))
        if member is None or member.status == "removed":
            raise NotFoundError("Miembro no encontrado.")
        await self._ensure_other_admin_remains(company, user_id)
        member.status = "removed"
        await self.session.execute(
            delete(UserRole).where(UserRole.user_id == user_id, UserRole.company_id == company.id)
        )
        self._audit(company, "companies.member_remove", user_id, None)
        await self.session.commit()

    async def _ensure_other_admin_remains(self, company: Company, leaving_user: uuid.UUID) -> None:
        admins = (
            await self.session.scalars(
                select(UserRole.user_id)
                .join(Role, Role.id == UserRole.role_id)
                .where(UserRole.company_id == company.id, Role.code == RoleCode.COMPANY_ADMIN)
            )
        ).all()
        if set(admins) == {leaving_user}:
            raise ValidationFailedError(
                "La empresa debe conservar al menos un administrador.", code="last_admin"
            )

    def _audit(self, company: Company, action: str, entity_id: uuid.UUID, changes: dict | None) -> None:
        self.audit.record(
            module="companies",
            action=action,
            result="success",
            actor_user_id=self.principal.id,
            company_id=company.id,
            entity_type="company" if entity_id == company.id else "user",
            entity_id=entity_id,
            changes=changes,
        )
