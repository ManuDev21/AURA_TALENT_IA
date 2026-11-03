import asyncpg
from httpx import AsyncClient

from app.config import get_settings
from app.tests.conftest import TEST_PASSWORD, register, unique_email

REFRESH_COOKIE = "aura_refresh"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _use_refresh(client: AsyncClient, token: str) -> None:
    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, token)


async def test_health(client: AsyncClient) -> None:
    assert (await client.get("/health/live")).json() == {"status": "ok"}
    ready = await client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.headers["X-Request-ID"]


async def test_register_candidate_returns_session_and_role(client: AsyncClient) -> None:
    result = await register(client)
    body = result["body"]
    assert body["token_type"] == "bearer"
    assert body["user"]["roles"] == [{"code": "ROLE_CANDIDATE", "company_id": None}]
    assert "profile:write_own" in body["user"]["permissions"]
    assert REFRESH_COOKIE in client.cookies


async def test_register_company_creates_company_admin(client: AsyncClient) -> None:
    body = (await register(client, account_type="company"))["body"]
    roles = body["user"]["roles"]
    assert len(roles) == 1
    assert roles[0]["code"] == "ROLE_COMPANY_ADMIN"
    assert roles[0]["company_id"] is not None
    assert "jobs:write" in body["user"]["permissions"]


async def test_register_rejects_duplicate_email_case_insensitive(client: AsyncClient) -> None:
    payload = (await register(client))["payload"]
    duplicate = {**payload, "email": payload["email"].upper()}
    response = await client.post("/api/v1/auth/register", json=duplicate)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


async def test_register_validates_password_and_consent(client: AsyncClient) -> None:
    base = {
        "email": unique_email(),
        "full_name": "Sin Consentimiento",
        "account_type": "candidate",
        "accept_terms": True,
        "accept_privacy": True,
    }
    weak = await client.post("/api/v1/auth/register", json={**base, "password": "solamenteletras"})
    assert weak.status_code == 422
    no_consent = await client.post(
        "/api/v1/auth/register", json={**base, "password": TEST_PASSWORD, "accept_privacy": False}
    )
    assert no_consent.status_code == 422
    assert no_consent.json()["error"]["code"] == "validation_failed"


async def test_login_me_and_invalid_credentials(client: AsyncClient) -> None:
    payload = (await register(client))["payload"]
    client.cookies.clear()

    bad = await client.post(
        "/api/v1/auth/login", json={"email": payload["email"], "password": "Incorrecta123"}
    )
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"

    unknown = await client.post(
        "/api/v1/auth/login", json={"email": unique_email(), "password": "Algo12345678"}
    )
    assert unknown.status_code == 401
    assert unknown.json()["error"]["message"] == bad.json()["error"]["message"]

    ok = await client.post("/api/v1/auth/login", json={"email": payload["email"], "password": TEST_PASSWORD})
    assert ok.status_code == 200
    me = await client.get("/api/v1/auth/me", headers=_auth(ok.json()["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == payload["email"]


async def test_account_locks_after_repeated_failures(client: AsyncClient) -> None:
    payload = (await register(client))["payload"]
    attempts = get_settings().login_max_attempts
    for _ in range(attempts):
        r = await client.post(
            "/api/v1/auth/login", json={"email": payload["email"], "password": "Incorrecta123"}
        )
        assert r.status_code == 401
    locked = await client.post(
        "/api/v1/auth/login", json={"email": payload["email"], "password": TEST_PASSWORD}
    )
    assert locked.status_code == 429
    assert locked.json()["error"]["code"] == "account_locked"


async def test_protected_route_requires_token(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    invalid = await client.get("/api/v1/auth/me", headers=_auth("no-es-un-jwt"))
    assert invalid.status_code == 401
    assert invalid.json()["error"]["code"] == "invalid_token"


async def test_refresh_rotation_and_reuse_detection(client: AsyncClient) -> None:
    await register(client)
    first_refresh = client.cookies[REFRESH_COOKIE]

    rotated = await client.post("/api/v1/auth/refresh")
    assert rotated.status_code == 200
    second_refresh = client.cookies[REFRESH_COOKIE]
    assert second_refresh != first_refresh

    # Reutilizar el token viejo revoca toda la familia
    _use_refresh(client, first_refresh)
    reused = await client.post("/api/v1/auth/refresh")
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "refresh_reused"

    _use_refresh(client, second_refresh)
    after_reuse = await client.post("/api/v1/auth/refresh")
    assert after_reuse.status_code == 401


async def test_logout_revokes_refresh(client: AsyncClient) -> None:
    await register(client)
    token = client.cookies[REFRESH_COOKIE]
    assert (await client.post("/api/v1/auth/logout")).status_code == 204
    _use_refresh(client, token)
    assert (await client.post("/api/v1/auth/refresh")).status_code == 401


async def test_password_reset_flow(client: AsyncClient, monkeypatch) -> None:  # noqa: ANN001
    payload = (await register(client))["payload"]
    captured: dict[str, str] = {}

    from app.services import mail_service

    monkeypatch.setattr(
        mail_service.MailService,
        "send_password_reset",
        lambda self, email, token: captured.update(token=token),
    )
    r = await client.post("/api/v1/auth/forgot-password", json={"email": payload["email"]})
    assert r.status_code == 202
    unknown = await client.post("/api/v1/auth/forgot-password", json={"email": unique_email()})
    assert unknown.status_code == 202
    assert unknown.json() == r.json()

    new_password = "NuevaClave2027"
    reset = await client.post(
        "/api/v1/auth/reset-password", json={"token": captured["token"], "new_password": new_password}
    )
    assert reset.status_code == 200
    reused = await client.post(
        "/api/v1/auth/reset-password", json={"token": captured["token"], "new_password": new_password}
    )
    assert reused.status_code == 422

    login = await client.post(
        "/api/v1/auth/login", json={"email": payload["email"], "password": new_password}
    )
    assert login.status_code == 200


async def test_rbac_admin_endpoint(client: AsyncClient) -> None:
    candidate = (await register(client))["body"]
    denied = await client.get("/api/v1/admin/roles", headers=_auth(candidate["access_token"]))
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "missing_permission"

    # Promover a admin de sistema directamente en BD y verificar acceso
    settings = get_settings()
    conn = await asyncpg.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password.get_secret_value(),
        database=settings.db_name,
    )
    try:
        await conn.execute(
            "INSERT INTO user_roles (user_id, role_id) "
            "SELECT $1::uuid, id FROM roles WHERE code = 'ROLE_SYSTEM_ADMIN'",
            candidate["user"]["id"],
        )
    finally:
        await conn.close()
    allowed = await client.get("/api/v1/admin/roles", headers=_auth(candidate["access_token"]))
    assert allowed.status_code == 200
    assert {r["code"] for r in allowed.json()} >= {"ROLE_CANDIDATE", "ROLE_SYSTEM_ADMIN"}


async def test_update_me_and_consents(client: AsyncClient) -> None:
    token = (await register(client))["body"]["access_token"]
    r = await client.patch("/api/v1/users/me", json={"full_name": "  Nombre Nuevo  "}, headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["full_name"] == "Nombre Nuevo"
    consents = await client.get("/api/v1/users/me/consents", headers=_auth(token))
    assert {c["consent_type"] for c in consents.json()} == {"terms", "privacy"}
