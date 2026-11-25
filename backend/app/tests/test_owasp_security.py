"""Suite de validacion y seguridad basada en OWASP Top 10 / API Security Top 10."""

import base64
import json

import pytest
from httpx import AsyncClient

from app.config.settings import Settings
from app.tests.conftest import TEST_PASSWORD, register, unique_email
from app.tests.helpers import auth, candidate_token, company_admin


def _forge_alg_none_jwt(sub: str) -> str:
    header = (
        base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    )
    payload = (
        base64.urlsafe_b64encode(json.dumps({"sub": sub, "type": "access"}).encode()).rstrip(b"=").decode()
    )
    return f"{header}.{payload}."


async def test_owasp_a01_broken_access_control_rbac_and_idor(client: AsyncClient) -> None:
    """A01: RBAC estricto y aislamiento entre usuarios/empresas (anti-IDOR/BOLA)."""
    cand_a = await register(client, account_type="candidate")
    cand_b = await register(client, account_type="candidate")
    ha = auth(cand_a["body"]["access_token"])
    hb = auth(cand_b["body"]["access_token"])

    # Candidato A crea experiencia; Candidato B no puede modificarla ni borrarla
    created = await client.post(
        "/api/v1/candidates/me/experiences",
        headers=ha,
        json={"company_name": "Acme", "title": "Analista", "start_date": "2024-01-01"},
    )
    assert created.status_code == 201
    exp_id = created.json()["id"]

    assert (
        await client.put(
            f"/api/v1/candidates/me/experiences/{exp_id}",
            headers=hb,
            json={"company_name": "Hack", "title": "Hack", "start_date": "2024-01-01"},
        )
    ).status_code == 404
    assert (await client.delete(f"/api/v1/candidates/me/experiences/{exp_id}", headers=hb)).status_code == 404

    # Escalada horizontal/vertical bloqueada: candidato no entra a rutas de empresa ni admin
    for protected in (
        "/api/v1/jobs/company",
        "/api/v1/analytics/company",
        "/api/v1/admin/audit",
        "/api/v1/admin/models",
    ):
        assert (await client.get(protected, headers=ha)).status_code == 403

    # Aislamiento multi-tenant entre dos empresas
    comp_a = await company_admin(client)
    comp_b = await company_admin(client)
    job = await client.post(
        "/api/v1/jobs",
        headers=auth(comp_a["access_token"]),
        json={
            "title": "Vacante Privada A",
            "modality": "remote",
            "description": "Descripcion de prueba suficiente.",
        },
    )
    assert job.status_code == 201
    job_id = job.json()["id"]
    assert (
        await client.delete(f"/api/v1/jobs/{job_id}", headers=auth(comp_b["access_token"]))
    ).status_code == 404


async def test_owasp_a02_cryptographic_and_jwt_tampering(client: AsyncClient) -> None:
    """A02: Sin exposicion de secretos/hashes y rechazo de JWT manipulados o alg=none."""
    reg = await register(client, account_type="candidate")
    token = reg["body"]["access_token"]
    user_id = reg["body"]["user"]["id"]

    # Ningun hash o secreto aparece en la respuesta
    raw = json.dumps(reg["body"]).lower()
    assert "password_hash" not in raw and "argon2" not in raw and "jwt_secret" not in raw

    # Algoritmo 'none' rechazado
    assert (
        await client.get("/api/v1/users/me", headers=auth(_forge_alg_none_jwt(user_id)))
    ).status_code == 401

    # Firma alterada rechazada
    tampered = token[:-4] + ("AAAA" if token[-4:] != "AAAA" else "BBBB")
    assert (await client.get("/api/v1/users/me", headers=auth(tampered))).status_code == 401


async def test_owasp_a03_injection_and_input_validation(client: AsyncClient) -> None:
    """A03: Proteccion frente a SQLi, XSS en URLs y validacion estricta de entradas."""
    h = auth(await candidate_token(client))

    # Payloads SQLi en busquedas parametrizadas no causan error 500 ni fuga
    sqli_payloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "1 UNION SELECT password_hash FROM users --",
    ]
    for payload in sqli_payloads:
        r_jobs = await client.get("/api/v1/jobs", params={"q": payload}, headers=h)
        assert r_jobs.status_code == 200
        r_skills = await client.get("/api/v1/skills", params={"q": payload}, headers=h)
        assert r_skills.status_code == 200

    # SQLi en login siempre devuelve 401/422, nunca 200 ni 500
    r_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin' OR '1'='1@aura.dev", "password": "' OR '1'='1"},
    )
    assert r_login.status_code in (401, 422)

    # XSS en URL de enlace de perfil rechazado por validacion de esquema
    r_xss = await client.post(
        "/api/v1/candidates/me/links",
        headers=h,
        json={"link_type": "website", "url": "javascript:alert(1)"},
    )
    assert r_xss.status_code == 422


async def test_owasp_a05_security_headers_and_cloud_db_config(client: AsyncClient) -> None:
    """A05: Cabeceras de seguridad y soporte seguro de DATABASE_URL con SSL."""
    r = await client.get("/health/ready")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["referrer-policy"] == "strict-origin-when-cross-origin"

    # DATABASE_URL de Neon con sslmode=require se normaliza a asyncpg + uses_ssl=True
    cfg = Settings(
        environment="production",
        DATABASE_URL="postgresql://user:secret@ep-demo.neon.tech/aura_talent?sslmode=require",
        jwt_secret="s" * 40,
        cookie_secure=True,
        frontend_url="https://aura.vercel.app",
        cors_origins="https://aura.vercel.app",
    )
    assert cfg.uses_ssl is True
    assert str(cfg.database_url).startswith("postgresql+asyncpg://")
    assert "sslmode" not in str(cfg.database_url)


async def test_owasp_a07_account_deletion_revokes_session_immediately(client: AsyncClient) -> None:
    """A07: Borrado de cuenta revoca tokens al instante y bloquea re-ingreso."""
    email = unique_email("owasp_del")
    reg = await register(client, email=email, password=TEST_PASSWORD)
    h = auth(reg["body"]["access_token"])

    assert (await client.delete("/api/v1/users/me", headers=h)).status_code == 204
    # Token existente queda invalido inmediatamente
    assert (await client.get("/api/v1/users/me", headers=h)).status_code == 401
    # Re-login bloqueado
    assert (
        await client.post("/api/v1/auth/login", json={"email": email, "password": TEST_PASSWORD})
    ).status_code == 401


@pytest.mark.parametrize(
    "bad_password", ["corta", "1234567890", "SinNumerosSoloLetras", "solo_simbolos_!!!"]
)
async def test_owasp_a07_weak_passwords_rejected(client: AsyncClient, bad_password: str) -> None:
    """A07: Politica de contrasenas fuertes en registro."""
    r = await client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email("weak"),
            "password": bad_password,
            "full_name": "Usuario Prueba",
            "account_type": "candidate",
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    assert r.status_code == 422
