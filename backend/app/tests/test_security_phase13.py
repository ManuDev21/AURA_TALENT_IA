import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from app.config.settings import Settings
from app.tests.conftest import register
from app.tests.helpers import auth, candidate_token, company_admin, grant_role

SECRET = "x" * 40


def test_production_rejects_insecure_configuration() -> None:
    with pytest.raises(ValidationError, match="COOKIE_SECURE"):
        Settings(
            environment="production",
            db_password="p",
            jwt_secret=SECRET,
            cookie_secure=False,
            frontend_url="https://aura.example",
            cors_origins="https://aura.example",
        )
    ok = Settings(
        environment="production",
        db_password="p",
        jwt_secret=SECRET,
        cookie_secure=True,
        frontend_url="https://aura.example",
        cors_origins="https://aura.example",
    )
    assert ok.is_production


async def test_security_headers_and_no_store(client: AsyncClient) -> None:
    h = auth(await candidate_token(client))
    r = await client.get("/api/v1/users/me", headers=h)
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["cache-control"] == "no-store"
    assert "camera=(self)" in r.headers["permissions-policy"]


async def test_audit_log_scoped_by_company_and_read_only(client: AsyncClient) -> None:
    admin = await company_admin(client)
    ah = auth(admin["access_token"])
    await client.post(
        "/api/v1/jobs",
        headers=ah,
        json={
            "title": "Vacante auditada",
            "modality": "remote",
            "description": "Descripcion suficiente para la vacante.",
        },
    )
    mine = (await client.get("/api/v1/admin/audit", headers=ah)).json()
    assert mine["total"] >= 1 and all(i["actor"] for i in mine["items"])

    other = auth((await company_admin(client))["access_token"])
    theirs = (await client.get("/api/v1/admin/audit", headers=other)).json()
    assert not {i["id"] for i in theirs["items"]} & {i["id"] for i in mine["items"]}

    h = auth(await candidate_token(client))
    assert (await client.get("/api/v1/admin/audit", headers=h)).status_code == 403

    sys = await register(client)
    await grant_role(sys["body"]["user"]["id"], "ROLE_SYSTEM_ADMIN")
    login = await client.post(
        "/api/v1/auth/login", json={"email": sys["payload"]["email"], "password": sys["payload"]["password"]}
    )
    everything = (await client.get("/api/v1/admin/audit", headers=auth(login.json()["access_token"]))).json()
    assert everything["total"] >= mine["total"] + theirs["total"]
    assert (await client.delete("/api/v1/admin/audit", headers=ah)).status_code == 405

    sys_h = auth(login.json()["access_token"])
    models = (await client.get("/api/v1/admin/models", headers=sys_h)).json()
    assert {e["name"] for e in models["engines"]} >= {"AURA Match", "Recomendaciones"}
    assert (await client.get("/api/v1/admin/models", headers=ah)).status_code == 403


async def test_personal_data_export(client: AsyncClient) -> None:
    h = auth(await candidate_token(client))
    await client.post(
        "/api/v1/privacy/consents/me", headers=h, json={"consent_type": "camera", "granted": True}
    )
    r = await client.get("/api/v1/privacy/export", headers=h)
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    data = r.json()
    assert data["account"]["email"] and "profile" in data and "applications" in data
    assert any(c["type"] == "camera" for c in data["consents"])
    assert "password" not in r.text.lower() and "hash" not in r.text.lower()
