from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.core.rate_limit import limiter
from app.database.session import engine
from app.routers import health
from app.routers.v1 import api_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="AURA - Artificial Understanding & Recruitment Assistant",
        # La documentacion interactiva solo se publica fuera de produccion
        openapi_url=None if settings.is_production else "/api/v1/openapi.json",
        docs_url=None if settings.is_production else "/api/docs",
        redoc_url=None,
        lifespan=lifespan,
    )
    app.state.limiter = limiter

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    register_exception_handlers(app)

    app.include_router(health.router)
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
