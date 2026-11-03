from typing import Annotated

from fastapi import APIRouter, Cookie, Request, Response, status

from app.config import get_settings
from app.core.context import ClientInfo
from app.core.deps import CurrentPrincipal, DbSession
from app.core.rate_limit import limiter
from app.schemas.auth import (
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserMe
from app.services.auth_service import AuthService, IssuedSession
from app.services.mail_service import MailService
from app.services.user_service import to_user_me

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "aura_refresh"
_COOKIE_PATH = "/api/v1/auth"

RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE)]


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=settings.refresh_token_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path=_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        REFRESH_COOKIE, path=_COOKIE_PATH, httponly=True, secure=settings.cookie_secure, samesite="strict"
    )


def _session_response(response: Response, session: IssuedSession) -> TokenResponse:
    _set_refresh_cookie(response, session.refresh_token)
    return TokenResponse(
        access_token=session.access_token, expires_in=session.expires_in, user=to_user_me(session.user)
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request, response: Response, data: RegisterRequest, db: DbSession
) -> TokenResponse:
    session = await AuthService(db, ClientInfo.from_request(request)).register(data)
    return _session_response(response, session)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, response: Response, data: LoginRequest, db: DbSession) -> TokenResponse:
    session = await AuthService(db, ClientInfo.from_request(request)).login(data)
    return _session_response(response, session)


@router.post("/google", response_model=TokenResponse)
@limiter.limit("15/minute")
async def google_auth(
    request: Request, response: Response, data: GoogleAuthRequest, db: DbSession
) -> TokenResponse:
    session = await AuthService(db, ClientInfo.from_request(request)).google_auth(data)
    return _session_response(response, session)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh(
    request: Request, response: Response, db: DbSession, refresh_token: RefreshCookie = None
) -> TokenResponse:
    session = await AuthService(db, ClientInfo.from_request(request)).refresh(refresh_token)
    return _session_response(response, session)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, db: DbSession, refresh_token: RefreshCookie = None) -> Response:
    await AuthService(db, ClientInfo.from_request(request)).logout(refresh_token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


@router.post("/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def forgot_password(request: Request, data: ForgotPasswordRequest, db: DbSession) -> MessageResponse:
    await AuthService(db, ClientInfo.from_request(request)).forgot_password(data.email, MailService())
    return MessageResponse(
        message="Si el correo esta registrado, recibiras instrucciones para restablecer tu contrasena."
    )


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("10/minute")
async def reset_password(request: Request, data: ResetPasswordRequest, db: DbSession) -> MessageResponse:
    await AuthService(db, ClientInfo.from_request(request)).reset_password(data.token, data.new_password)
    return MessageResponse(message="Tu contrasena se actualizo. Ya puedes iniciar sesion.")


@router.get("/me", response_model=UserMe)
async def me(principal: CurrentPrincipal) -> UserMe:
    return to_user_me(principal.user)
