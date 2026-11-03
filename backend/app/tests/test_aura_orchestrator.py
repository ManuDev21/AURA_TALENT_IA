import asyncpg
import pytest
from httpx import AsyncClient
from pydantic import SecretStr

import app.services.orchestrator_service as orch
from app.config import get_settings
from app.tests.helpers import auth, candidate_token, company_admin, skill_id

A = "/api/v1/aura"


async def _interactions(user_email: str) -> list[asyncpg.Record]:
    s = get_settings()
    conn = await asyncpg.connect(
        host=s.db_host,
        port=s.db_port,
        user=s.db_user,
        password=s.db_password.get_secret_value(),
        database=s.db_name,
    )
    try:
        return await conn.fetch(
            "SELECT i.* FROM ai_interactions i JOIN users u ON u.id = i.user_id "
            "WHERE u.email = $1 ORDER BY created_at",
            user_email,
        )
    finally:
        await conn.close()


async def test_candidate_commands_execute_tools_and_are_logged(client: AsyncClient) -> None:
    token = await candidate_token(client)
    h = auth(token)
    me = (await client.get("/api/v1/users/me", headers=h)).json()
    await client.put(
        f"/api/v1/candidates/me/skills/{await skill_id(client, token, 'React')}",
        headers=h,
        json={"proficiency": 4},
    )

    profile = (await client.post(f"{A}/command", headers=h, json={"text": "AURA, analiza mi perfil"})).json()
    assert profile["intent"] == "profile.analyze" and profile["outcome"] == "ok"
    assert "completo al" in profile["reply"] and profile["action"]["path"] == "/candidate/profile"

    search = (
        await client.post(
            f"{A}/command", headers=h, json={"text": "busca vacantes de react", "channel": "voice"}
        )
    ).json()
    assert search["intent"] == "jobs.search" and search["action"]["path"] == "/candidate/jobs?q=react"

    unknown = (await client.post(f"{A}/command", headers=h, json={"text": "hola que tal el clima"})).json()
    assert unknown["outcome"] == "unknown" and unknown["action"] is None

    help_ = (await client.post(f"{A}/command", headers=h, json={"text": "que puedes hacer"})).json()
    assert help_["details"] and not any("candidatos" in d for d in help_["details"])

    rows = await _interactions(me["email"])
    assert [r["detected_intent"] for r in rows] == ["profile.analyze", "jobs.search", "unknown", "aura.help"]
    assert rows[1]["channel"] == "voice" and rows[0]["llm_used"] is False


async def test_risky_actions_need_single_use_confirmation(client: AsyncClient) -> None:
    token = await candidate_token(client)
    h = auth(token)
    await client.put(
        f"/api/v1/candidates/me/skills/{await skill_id(client, token, 'Python')}",
        headers=h,
        json={"proficiency": 3},
    )

    ask = (await client.post(f"{A}/command", headers=h, json={"text": "genera una ruta profesional"})).json()
    assert ask["outcome"] == "needs_confirmation" and ask["confirmation"]["token"]
    assert (await client.get("/api/v1/career/paths", headers=h)).json() == []

    other = auth(await candidate_token(client))
    stolen = await client.post(f"{A}/confirm", headers=other, json={"token": ask["confirmation"]["token"]})
    assert stolen.status_code == 404

    done = (await client.post(f"{A}/confirm", headers=h, json={"token": ask["confirmation"]["token"]})).json()
    assert done["outcome"] == "ok" and done["action"]["path"].startswith("/candidate/career?path=")
    paths = (await client.get("/api/v1/career/paths", headers=h)).json()
    assert len(paths) == 1
    again = await client.post(f"{A}/confirm", headers=h, json={"token": ask["confirmation"]["token"]})
    assert again.status_code == 404

    cv = (await client.post(f"{A}/command", headers=h, json={"text": "crea mi cv"})).json()
    cancelled = (
        await client.post(f"{A}/cancel", headers=h, json={"token": cv["confirmation"]["token"]})
    ).json()
    assert cancelled["outcome"] == "cancelled"
    assert (await client.get("/api/v1/cv/resumes", headers=h)).json() == []


async def test_role_boundaries(client: AsyncClient) -> None:
    admin = await company_admin(client)
    ah = auth(admin["access_token"])
    denied = (
        await client.post(f"{A}/command", headers=ah, json={"text": "que habilidades necesito mejorar"})
    ).json()
    assert denied["outcome"] == "denied"
    company = (
        await client.post(
            f"{A}/command", headers=ah, json={"text": "analiza los candidatos", "area": "company"}
        )
    ).json()
    assert company["intent"] == "candidates.analyze" and company["outcome"] == "ok"

    h = auth(await candidate_token(client))
    cand = (await client.post(f"{A}/command", headers=h, json={"text": "analiza los candidatos"})).json()
    assert cand["outcome"] == "denied"


# -------------------------------------------------------------- respaldo LLM


@pytest.fixture
def fake_gemini(monkeypatch: pytest.MonkeyPatch):
    """Simula Gemini configurado y controla su respuesta sin tocar la red."""

    class FakeSettings:
        gemini_api_key = SecretStr("test-key")
        gemini_model = "test-model"

    calls: list[str] = []
    result: dict | None = {"intent": "skills.gaps"}

    async def fake_classify(self, text: str, lines: list[str]) -> dict | None:  # noqa: ARG001
        calls.append(text)
        return result

    monkeypatch.setattr(orch, "get_settings", lambda: FakeSettings())
    monkeypatch.setattr(orch.GeminiClient, "classify", fake_classify)
    return calls, result


async def test_llm_fallback_understands_free_phrases(client: AsyncClient, fake_gemini) -> None:
    calls, result = fake_gemini
    h = auth(await candidate_token(client))
    me = (await client.get("/api/v1/users/me", headers=h)).json()
    text = "oye aura, en que me tengo que poner las pilas para conseguir chamba"
    denied = (await client.post(f"{A}/command", headers=h, json={"text": text})).json()
    assert denied["outcome"] == "unknown" and calls == []  # sin consentimiento no se llama a Gemini

    await client.post(
        "/api/v1/privacy/consents/me",
        headers=h,
        json={"consent_type": "external_ai_processing", "granted": True},
    )
    reply = (await client.post(f"{A}/command", headers=h, json={"text": text})).json()
    assert calls == [text]
    assert reply["intent"] == "skills.gaps"
    rows = await _interactions(me["email"])
    assert rows[-1]["llm_used"] is True and rows[-1]["detected_intent"] == "skills.gaps"

    result.update({"intent": "no.existe"})  # respuesta invalida del modelo: se ignora
    bad = (await client.post(f"{A}/command", headers=h, json={"text": text})).json()
    assert bad["outcome"] == "unknown"


async def test_llm_fallback_keeps_permission_boundaries(client: AsyncClient, fake_gemini) -> None:
    """Aunque el modelo sugiera un comando de empresa, un candidato no puede ejecutarlo."""
    calls, result = fake_gemini
    result.update({"intent": "candidates.analyze"})
    h = auth(await candidate_token(client))
    await client.post(
        "/api/v1/privacy/consents/me",
        headers=h,
        json={"consent_type": "external_ai_processing", "granted": True},
    )
    reply = (
        await client.post(f"{A}/command", headers=h, json={"text": "dime quienes aplicaron a la vacante"})
    ).json()
    # El comando de empresa no esta en la lista permitida del candidato: el modelo puede sugerirlo,
    # pero nunca llega a ejecutarse ni siquiera como "denied" registrado
    assert calls and reply["outcome"] == "unknown"
