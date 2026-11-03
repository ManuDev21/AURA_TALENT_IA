import structlog

from app.config import get_settings

log = structlog.get_logger(__name__)


class MailService:
    """Envio de correos. En desarrollo solo registra el enlace en el log del servidor."""

    def send_password_reset(self, email: str, token: str) -> None:
        self._deliver("password_reset", email, f"/reset-password?token={token}")

    def send_invitation(self, email: str, token: str | None, company_name: str) -> None:
        # Sin token: la persona ya tenia cuenta; solo se le notifica el acceso
        path = f"/reset-password?token={token}" if token else "/login"
        self._deliver("company_invitation", email, path, company=company_name)

    def _deliver(self, purpose: str, email: str, path: str, **extra: str) -> None:
        settings = get_settings()
        link = f"{settings.frontend_url}{path}"
        if settings.environment == "development":
            log.info(f"{purpose}_link_dev", email=email, link=link, **extra)
        else:
            log.warning("mail_provider_not_configured", purpose=purpose)
