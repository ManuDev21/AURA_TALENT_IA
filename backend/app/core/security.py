import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.config import get_settings
from app.core.errors import UnauthorizedError

_password_hasher = PasswordHash.recommended()
# Hash de referencia para igualar el tiempo de respuesta cuando el correo no existe.
_DUMMY_HASH = _password_hasher.hash("aura-timing-equalizer")


def utcnow() -> datetime:
    return datetime.now(UTC)


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> tuple[bool, str | None]:
    """Devuelve (valida, nuevo_hash_si_requiere_actualizacion)."""
    return _password_hasher.verify_and_update(password, password_hash)


def burn_password_check(password: str) -> None:
    _password_hasher.verify(password, _DUMMY_HASH)


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    settings = get_settings()
    now = utcnow()
    expires_in = settings.access_token_minutes * 60
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_access_token(token: str) -> uuid.UUID:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "exp", "type"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("La sesion expiro.", code="token_expired") from exc
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Token invalido.", code="invalid_token") from exc
    if payload.get("type") != "access":
        raise UnauthorizedError("Token invalido.", code="invalid_token")
    try:
        return uuid.UUID(payload["sub"])
    except ValueError as exc:
        raise UnauthorizedError("Token invalido.", code="invalid_token") from exc


def generate_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
