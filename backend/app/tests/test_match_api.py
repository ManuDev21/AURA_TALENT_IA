from httpx import AsyncClient

from app.tests.helpers import auth, candidate_token, company_admin, skill_id

M = "/api/v1/match"


async def _job(client: AsyncClient, h: dict, react: str, ts: str, title: str, publish: bool = True) -> str:
    job = (
        await client.post(
            "/api/v1/jobs",
            headers=h,
            json={
                "title": title,
                "description": "Desarrollo frontend con React y TypeScript para productos accesibles.",
                "modality": "remote",
                "experience_min_years": 1,
                "skills": [
                    {"skill_id": react, "importance": "required", "min_proficiency": 4},
                    {"skill_id": ts, "importance": "required", "min_proficiency": 4},
                ],
                "languages": [{"language_code": "en", "min_level": "B2"}],
            },
        )
    ).json()
    if publish:
        await client.post(f"/api/v1/jobs/{job['id']}/status", headers=h, json={"status": "PUBLISHED"})
    return job["id"]


async def test_candidate_match_top_gaps_and_company_view(client: AsyncClient) -> None:
    admin = await company_admin(client)
    ah = auth(admin["access_token"])
    react = await skill_id(client, admin["access_token"], "React")
    ts = await skill_id(client, admin["access_token"], "TypeScript")
    job_a = await _job(client, ah, react, ts, "Frontend React")
    draft = await _job(client, ah, react, ts, "Borrador oculto", publish=False)

    token = await candidate_token(client)
    h = auth(token)
    await client.patch(
        "/api/v1/candidates/me/profile",
        headers=h,
        json={"headline": "Frontend developer React", "work_modality": "remote"},
    )
    await client.put(f"/api/v1/candidates/me/skills/{react}", headers=h, json={"proficiency": 5})
    await client.post(
        "/api/v1/candidates/me/languages", headers=h, json={"language_code": "en", "level": "C1"}
    )

    m = (await client.get(f"{M}/me/jobs/{job_a}", headers=h)).json()
    assert m["score_low"] <= m["score"] <= m["score_high"]
    status = {r["label"]: r["status"] for r in m["requirements"]}
    assert status["React"] == "met" and status["TypeScript"] == "missing"
    assert any(g["name"] == "TypeScript" for g in m["gaps"])
    assert any("TypeScript" in r for r in m["recommendations"])
    assert "Fotografia o datos biometricos" in m["explanation"]["not_used"]
    assert "persona" in m["disclaimer"]

    # Vacante en borrador: invisible para el candidato
    assert (await client.get(f"{M}/me/jobs/{draft}", headers=h)).status_code == 404

    top = (await client.get(f"{M}/me/top", headers=h, params={"limit": 30})).json()
    assert draft not in {t["job_id"] for t in top}
    mine = next(t for t in top if t["job_id"] == job_a)
    assert mine["required_total"] == 4 and mine["top_gap"] == "TypeScript"
    assert [t["score"] for t in top] == sorted((t["score"] for t in top), reverse=True)

    gaps = (await client.get(f"{M}/me/gaps", headers=h)).json()
    ts_gap = next(g for g in gaps["gaps"] if g["name"] == "TypeScript")
    assert "Frontend React" in ts_gap["jobs"] and ts_gap["required_in"] >= 1

    # Recalcular es idempotente (una fila por candidato, vacante y version del modelo)
    await client.get(f"{M}/me/jobs/{job_a}", headers=h)

    app_id = (await client.post("/api/v1/applications", headers=h, json={"job_id": job_a})).json()["id"]
    company_view = (await client.get(f"{M}/applications/{app_id}", headers=ah)).json()
    assert company_view["score"] == m["score"]
    ranking = (await client.get(f"{M}/jobs/{job_a}/applicants", headers=ah)).json()
    assert ranking[0]["application_id"] == app_id

    # Aislamiento: otra empresa y el candidato no acceden a la vista de empresa
    other = auth((await company_admin(client))["access_token"])
    assert (await client.get(f"{M}/applications/{app_id}", headers=other)).status_code == 404
    assert (await client.get(f"{M}/jobs/{job_a}/applicants", headers=other)).status_code == 404
    assert (await client.get(f"{M}/applications/{app_id}", headers=h)).status_code == 403
