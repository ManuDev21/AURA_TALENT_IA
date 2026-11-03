"""Configuracion de tests.

Los tests usan una base dedicada (por defecto aura_talent_test) propiedad de aura_app.
En cada ejecucion se recrea el esquema public y se aplican database/01_schema.sql y 02_seed.sql.
Crear la base una sola vez (como postgres):
    CREATE DATABASE aura_talent_test OWNER aura_app TEMPLATE template0;
"""

import os
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest

os.environ["ENVIRONMENT"] = "test"
os.environ["DB_NAME"] = os.environ.get("TEST_DB_NAME", "aura_talent_test")
os.environ["RATE_LIMIT_ENABLED"] = "false"

import asyncpg  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.config import get_settings  # noqa: E402

DATABASE_DIR = Path(__file__).resolve().parents[3] / "database"
TEST_PASSWORD = "ClaveSegura2026"


async def _reset_database() -> None:
    settings = get_settings()
    if not settings.db_name.endswith("_test"):
        raise RuntimeError(
            f"Por seguridad los tests solo corren en bases *_test (actual: {settings.db_name})"
        )
    conn = await asyncpg.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password.get_secret_value(),
        database=settings.db_name,
    )
    try:
        await conn.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
        for script in (
            "01_schema.sql",
            "02_seed.sql",
            "03_learning_resources.sql",
            "04_trust_and_portability.sql",
        ):
            await conn.execute((DATABASE_DIR / script).read_text(encoding="utf-8"))
    finally:
        await conn.close()


@pytest.fixture(scope="session", autouse=True)
async def database() -> AsyncIterator[None]:
    await _reset_database()
    yield
    from app.database.session import engine

    await engine.dispose()


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


def unique_email(prefix: str = "user") -> str:
    return f"{prefix}.{uuid.uuid4().hex[:10]}@aura-tests.dev"


async def register(client: AsyncClient, *, account_type: str = "candidate", **overrides: object) -> dict:
    payload = {
        "email": unique_email(account_type),
        "password": TEST_PASSWORD,
        "full_name": "Persona de Prueba",
        "account_type": account_type,
        "accept_terms": True,
        "accept_privacy": True,
    }
    if account_type == "company":
        payload["company_name"] = "Empresa de Prueba"
    payload.update(overrides)
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return {"payload": payload, "body": response.json()}
