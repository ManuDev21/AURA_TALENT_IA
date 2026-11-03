import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

log = structlog.get_logger("http")

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}
_HSTS = "max-age=31536000; includeSubDomains"


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Asigna request_id, lo propaga a los logs y agrega cabeceras de seguridad."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get("X-Request-ID", "")
        request_id = incoming if 0 < len(incoming) <= 64 else uuid.uuid4().hex
        request.state.request_id = request_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

        response.headers["X-Request-ID"] = request_id
        for header, value in _SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
            response.headers.setdefault("Strict-Transport-Security", _HSTS)
        if request.url.path.startswith("/api/"):
            # Datos personales: nunca en caches intermedias ni del navegador
            response.headers.setdefault("Cache-Control", "no-store")
        log.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            ms=elapsed_ms,
        )
        return response
