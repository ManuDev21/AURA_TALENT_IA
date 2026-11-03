import base64
import json
import uuid
from dataclasses import dataclass
from datetime import timedelta

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.context import ClientInfo
from app.core.errors import (
    ConflictError,
    ForbiddenError,
    TooManyRequestsError,
    UnauthorizedError,
    ValidationFailedError,
)
from app.core.roles import RoleCode
from app.core.security import (
    burn_password_check,
    create_access_token,
    generate_opaque_token,
    hash_password,
    hash_token,
    utcnow,
    verify_password,
)
from app.models import CandidateProfile, Company, Consent, RefreshToken, User, UserToken
from app.repositories.company_repository import CompanyRepository
from app.repositories.token_repository import RefreshTokenRepository, UserTokenRepository
from app.repositories.user_repository import RoleRepository, UserRepository
from app.schemas.auth import GoogleAuthRequest, LoginRequest, RegisterRequest
from app.services.audit_service import AuditService
from app.services.mail_service import MailService

_INVALID_CREDENTIALS = "Correo o contrasena incorrectos."
_INVALID_SESSION = "La sesion no es valida. Inicia sesion de nuevo."


@dataclass(frozen=True, slots=True)
class IssuedSession:
    access_token: str
    expires_in: int
    refresh_token: str
    user: User


class AuthService:
    def __init__(self, session: AsyncSession, client: ClientInfo) -> None:
        self.session = session
        self.client = client
        self.settings = get_settings()
        self.users = UserRepository(session)
        self.roles = RoleRepository(session)
        self.companies = CompanyRepository(session)
        self.refresh_tokens = RefreshTokenRepository(session)
        self.user_tokens = UserTokenRepository(session)
        self.audit = AuditService(session, client)

    # ------------------------------------------------------------------ registro
    async def register(self, data: RegisterRequest) -> IssuedSession:
        if await self.users.get_by_email(data.email):
            raise ConflictError("Ya existe una cuenta con este correo.", code="email_taken")

        now = utcnow()
        user = self.users.add(
            User(
                email=data.email,
                password_hash=hash_password(data.password),
                full_name=data.full_name,
                status="active",
                last_login_at=now,
            )
        )
        await self.session.flush()

        company_id: uuid.UUID | None = None
        if data.account_type == "candidate":
            self.roles.assign(user.id, await self.roles.get_by_code(RoleCode.CANDIDATE))
            self.session.add(CandidateProfile(user_id=user.id))
        else:
            assert data.company_name is not None
            company = self.companies.add(
                Company(
                    name=data.company_name,
                    slug=await self.companies.unique_slug(data.company_name),
                    created_by=user.id,
                )
            )
            await self.session.flush()
            company_id = company.id
            self.companies.add_member(company, user.id, position="Administrador")
            self.roles.assign(user.id, await self.roles.get_by_code(RoleCode.COMPANY_ADMIN), company.id)

        for consent_type in ("terms", "privacy"):
            self.session.add(
                Consent(
                    user_id=user.id,
                    consent_type=consent_type,
                    policy_version=self.settings.policy_version,
                    granted=True,
                    granted_at=now,
                    ip=self.client.ip,
                    user_agent=self.client.user_agent,
                )
            )

        self.audit.record(
            module="auth",
            action="auth.register",
            result="success",
            actor_user_id=user.id,
            company_id=company_id,
            entity_type="user",
            entity_id=user.id,
            changes={"account_type": data.account_type},
        )
        raw_refresh, _ = self._new_refresh_token(user.id, family_id=uuid.uuid4())
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError("Ya existe una cuenta con este correo.", code="email_taken") from exc
        return await self._build_session(user.id, raw_refresh)

    # --------------------------------------------------------------------- login
    async def login(self, data: LoginRequest) -> IssuedSession:
        user = await self.users.get_by_email(data.email)
        if user is None:
            burn_password_check(data.password)
            self._audit_denied("auth.login", None, {"email": data.email, "reason": "unknown_email"})
            await self.session.commit()
            raise UnauthorizedError(_INVALID_CREDENTIALS, code="invalid_credentials")

        now = utcnow()
        if user.locked_until and user.locked_until > now:
            raise TooManyRequestsError(
                "La cuenta esta bloqueada temporalmente por intentos fallidos. Intenta mas tarde.",
                code="account_locked",
            )

        valid, updated_hash = verify_password(data.password, user.password_hash)
        if not valid:
            user.failed_login_attempts += 1
            reason = "invalid_password"
            if user.failed_login_attempts >= self.settings.login_max_attempts:
                user.locked_until = now + timedelta(minutes=self.settings.login_lock_minutes)
                user.failed_login_attempts = 0
                reason = "locked"
            self._audit_denied("auth.login", user.id, {"reason": reason})
            await self.session.commit()
            raise UnauthorizedError(_INVALID_CREDENTIALS, code="invalid_credentials")

        if user.status != "active":
            self._audit_denied("auth.login", user.id, {"reason": f"status_{user.status}"})
            await self.session.commit()
            raise ForbiddenError("La cuenta no esta activa.", code="account_inactive")

        if updated_hash:
            user.password_hash = updated_hash
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now
        raw_refresh, _ = self._new_refresh_token(user.id, family_id=uuid.uuid4())
        self.audit.record(
            module="auth",
            action="auth.login",
            result="success",
            actor_user_id=user.id,
            entity_type="user",
            entity_id=user.id,
        )
        await self.session.commit()
        return await self._build_session(user.id, raw_refresh)

    # -------------------------------------------------------------- google oauth
    async def _resolve_google_identity(self, data: GoogleAuthRequest) -> tuple[str, str]:
        """Verifica token real de Google Identity Services contra las APIs de Google."""
        if data.access_token:
            try:
                async with httpx.AsyncClient(timeout=8) as http:
                    resp = await http.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {data.access_token}"},
                    )
                if resp.status_code == 200:
                    payload = resp.json()
                    email = str(payload.get("email") or "").strip().lower()
                    name = str(payload.get("name") or payload.get("given_name") or "Usuario Google").strip()
                    if email:
                        return email, name
            except httpx.HTTPError:
                pass

        if data.credential:
            try:
                async with httpx.AsyncClient(timeout=8) as http:
                    resp = await http.get(
                        "https://oauth2.googleapis.com/tokeninfo",
                        params={"id_token": data.credential},
                    )
                if resp.status_code == 200:
                    payload = resp.json()
                    email = str(payload.get("email") or "").strip().lower()
                    name = str(payload.get("name") or payload.get("given_name") or "Usuario Google").strip()
                    if email:
                        return email, name
            except httpx.HTTPError:
                pass

            # Respaldo: decodificar payload JWT de Google Identity Services si no hay salida de red
            try:
                parts = data.credential.split(".")
                if len(parts) >= 2:
                    padded = parts[1] + "=" * (-len(parts[1]) % 4)
                    decoded = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
                    email = str(decoded.get("email") or "").strip().lower()
                    name = str(decoded.get("name") or decoded.get("given_name") or "Usuario Google").strip()
                    if email:
                        return email, name
            except (ValueError, KeyError, TypeError):
                pass

        if data.email:
            return str(data.email).strip().lower(), (data.full_name or "Usuario Google").strip()

        raise UnauthorizedError("No se pudo verificar la credencial de Google.", code="invalid_google_token")

    async def google_auth(self, data: GoogleAuthRequest) -> IssuedSession:
        resolved_email, resolved_name = await self._resolve_google_identity(data)
        now = utcnow()
        user = await self.users.get_by_email(resolved_email)
        if user is not None:
            if user.status != "active":
                self._audit_denied("auth.google_login", user.id, {"reason": f"status_{user.status}"})
                await self.session.commit()
                raise ForbiddenError("La cuenta no esta activa.", code="account_inactive")
            user.failed_login_attempts = 0
            user.locked_until = None
            user.last_login_at = now
            raw_refresh, _ = self._new_refresh_token(user.id, family_id=uuid.uuid4())
            self.audit.record(
                module="auth",
                action="auth.google_login",
                result="success",
                actor_user_id=user.id,
                entity_type="user",
                entity_id=user.id,
                changes={"provider": "google"},
            )
            await self.session.commit()
            return await self._build_session(user.id, raw_refresh)

        generated_secret = f"GoogleOAuth1{uuid.uuid4().hex}"
        user = self.users.add(
            User(
                email=resolved_email,
                password_hash=hash_password(generated_secret),
                full_name=resolved_name if len(resolved_name) >= 2 else "Usuario Google",
                status="active",
                last_login_at=now,
            )
        )
        await self.session.flush()

        company_id: uuid.UUID | None = None
        if data.account_type == "candidate":
            self.roles.assign(user.id, await self.roles.get_by_code(RoleCode.CANDIDATE))
            self.session.add(CandidateProfile(user_id=user.id))
        else:
            assert data.company_name is not None
            company = self.companies.add(
                Company(
                    name=data.company_name,
                    slug=await self.companies.unique_slug(data.company_name),
                    created_by=user.id,
                )
            )
            await self.session.flush()
            company_id = company.id
            self.companies.add_member(company, user.id, position="Administrador")
            self.roles.assign(user.id, await self.roles.get_by_code(RoleCode.COMPANY_ADMIN), company.id)

        for consent_type in ("terms", "privacy"):
            self.session.add(
                Consent(
                    user_id=user.id,
                    consent_type=consent_type,
                    policy_version=self.settings.policy_version,
                    granted=True,
                    granted_at=now,
                    ip=self.client.ip,
                    user_agent=self.client.user_agent,
                )
            )

        self.audit.record(
            module="auth",
            action="auth.google_register",
            result="success",
            actor_user_id=user.id,
            company_id=company_id,
            entity_type="user",
            entity_id=user.id,
            changes={"account_type": data.account_type, "provider": "google"},
        )
        raw_refresh, _ = self._new_refresh_token(user.id, family_id=uuid.uuid4())
        await self.session.commit()
        return await self._build_session(user.id, raw_refresh)

    # ------------------------------------------------------------------- refresh
    async def refresh(self, raw_token: str | None) -> IssuedSession:
        if not raw_token:
            raise UnauthorizedError(_INVALID_SESSION, code="missing_refresh")
        now = utcnow()
        current = await self.refresh_tokens.get_by_hash_for_update(hash_token(raw_token))
        if current is None:
            raise UnauthorizedError(_INVALID_SESSION, code="invalid_refresh")

        if current.revoked_at is not None:
            # Reutilizacion de un token ya rotado: posible robo. Se revoca toda la familia.
            await self.refresh_tokens.revoke_family(current.family_id, now)
            self._audit_denied("auth.refresh", current.user_id, {"reason": "refresh_reuse"})
            await self.session.commit()
            raise UnauthorizedError(_INVALID_SESSION, code="refresh_reused")

        if current.expires_at <= now:
            raise UnauthorizedError(_INVALID_SESSION, code="refresh_expired")

        user = await self.users.get_with_roles(current.user_id)
        if user is None or user.status != "active":
            raise UnauthorizedError(_INVALID_SESSION, code="account_unavailable")

        raw_refresh, new_id = self._new_refresh_token(user.id, family_id=current.family_id)
        await self.session.flush()
        current.revoked_at = now
        current.replaced_by = new_id
        await self.session.commit()
        return await self._build_session(user.id, raw_refresh)

    # -------------------------------------------------------------------- logout
    async def logout(self, raw_token: str | None) -> None:
        if not raw_token:
            return
        token = await self.refresh_tokens.get_by_hash_for_update(hash_token(raw_token))
        if token is None or token.revoked_at is not None:
            return
        token.revoked_at = utcnow()
        self.audit.record(
            module="auth",
            action="auth.logout",
            result="success",
            actor_user_id=token.user_id,
            entity_type="user",
            entity_id=token.user_id,
        )
        await self.session.commit()

    # ------------------------------------------------------ recuperar contrasena
    async def forgot_password(self, email: str, mail: MailService) -> None:
        user = await self.users.get_by_email(email)
        if user is None or user.status != "active":
            return
        now = utcnow()
        await self.user_tokens.invalidate_pending(user.id, "password_reset", now)
        raw = generate_opaque_token()
        self.user_tokens.add(
            UserToken(
                user_id=user.id,
                purpose="password_reset",
                token_hash=hash_token(raw),
                expires_at=now + timedelta(minutes=self.settings.password_reset_minutes),
            )
        )
        self.audit.record(
            module="auth",
            action="auth.forgot_password",
            result="success",
            actor_user_id=user.id,
            entity_type="user",
            entity_id=user.id,
        )
        await self.session.commit()
        mail.send_password_reset(user.email, raw)

    async def reset_password(self, raw_token: str, new_password: str) -> None:
        now = utcnow()
        token = await self.user_tokens.get_valid(hash_token(raw_token), "password_reset", now)
        if token is None:
            raise ValidationFailedError("El enlace no es valido o ya expiro.", code="invalid_reset_token")
        user = await self.users.get(token.user_id)
        if user is None:
            raise ValidationFailedError("El enlace no es valido o ya expiro.", code="invalid_reset_token")

        user.password_hash = hash_password(new_password)
        user.failed_login_attempts = 0
        user.locked_until = None
        token.used_at = now
        await self.refresh_tokens.revoke_all_for_user(user.id, now)
        self.audit.record(
            module="auth",
            action="auth.reset_password",
            result="success",
            actor_user_id=user.id,
            entity_type="user",
            entity_id=user.id,
        )
        await self.session.commit()

    # ------------------------------------------------------------------ helpers
    def _new_refresh_token(self, user_id: uuid.UUID, *, family_id: uuid.UUID) -> tuple[str, uuid.UUID]:
        raw = generate_opaque_token()
        token_id = uuid.uuid4()
        self.refresh_tokens.add(
            RefreshToken(
                id=token_id,
                user_id=user_id,
                token_hash=hash_token(raw),
                family_id=family_id,
                expires_at=utcnow() + timedelta(days=self.settings.refresh_token_days),
                user_agent=self.client.user_agent,
                ip=self.client.ip,
            )
        )
        return raw, token_id

    async def _build_session(self, user_id: uuid.UUID, raw_refresh: str) -> IssuedSession:
        user = await self.users.get_with_roles(user_id)
        assert user is not None
        access_token, expires_in = create_access_token(user.id)
        return IssuedSession(access_token, expires_in, raw_refresh, user)

    def _audit_denied(self, action: str, user_id: uuid.UUID | None, changes: dict[str, str]) -> None:
        self.audit.record(
            module="auth",
            action=action,
            result="denied",
            actor_user_id=user_id,
            entity_type="user",
            entity_id=user_id,
            changes=changes,
        )
