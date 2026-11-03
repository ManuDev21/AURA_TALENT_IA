from httpx import AsyncClient

from app.tests.helpers import auth, candidate_token, company_admin, skill_id


def job_payload(title: str) -> dict:
    return {
        "title": title,
        "description": "Construiras soluciones de producto con un equipo colaborativo.",
        "location": "Ciudad de Mexico",
        "modality": "hybrid",
        "employment_type": "full_time",
        "salary_min": 40000,
        "salary_max": 60000,
        "salary_currency": "MXN",
        "show_salary": True,
        "experience_min_years": 1,
        "responsibilities": ["Diseñar y mantener funcionalidades"],
        "benefits": ["Seguro médico", "Presupuesto de aprendizaje"],
        "schedule_description": "Lunes a viernes, 9:00-18:00 CST",
        "response_sla_days": 5,
        "process_estimate_days": 30,
    }


async def test_skill_evidence_is_candidate_controlled_and_shared_only_by_consent(client: AsyncClient) -> None:
    token = await candidate_token(client)
    candidate = auth(token)
    react = await skill_id(client, token, "React")
    await client.put(f"/api/v1/candidates/me/skills/{react}", headers=candidate, json={"proficiency": 4})

    evidence = (
        await client.post(
            "/api/v1/candidates/me/skill-evidence",
            headers=candidate,
            json={
                "skill_id": react,
                "evidence_type": "project",
                "title": "Panel de métricas",
                "description": "Interfaz React con filtros y pruebas.",
                "evidence_url": "https://github.com/example/metrics",
                "share_with_companies": False,
            },
        )
    ).json()
    assert evidence["source"] == "candidate_submitted"
    assert evidence["share_with_companies"] is False

    imported = (
        await client.post(
            "/api/v1/candidates/me/skill-evidence/open-badge",
            headers=candidate,
            json={
                "skill_id": react,
                "credential_title": "Badge React",
                "issuer": "Emisor declarado por el candidato",
                "credential_ref": "badge-123",
                "credential_url": "https://issuer.example/badges/123",
                "share_with_companies": False,
            },
        )
    ).json()
    assert imported["source"] == "open_badge_import"
    passport = (await client.get("/api/v1/candidates/me/skills-passport", headers=candidate)).json()
    react_record = next(item for item in passport["skills"] if item["id"] == react)
    assert len(react_record["evidence"]) == 2
    assert "not a cryptographically signed Open Badge" in passport["credential_compatibility"]
    assert "email" not in passport
    personal_export = (await client.get("/api/v1/privacy/export", headers=candidate)).json()
    assert personal_export["skills_passport"]["skills"]

    admin = await company_admin(client)
    employer = auth(admin["access_token"])
    job = (await client.post("/api/v1/jobs", headers=employer, json=job_payload("Evidence privacy"))).json()
    await client.post(f"/api/v1/jobs/{job['id']}/status", headers=employer, json={"status": "PUBLISHED"})
    application = (
        await client.post("/api/v1/applications", headers=candidate, json={"job_id": job["id"]})
    ).json()
    detail = (await client.get(f"/api/v1/applications/{application['id']}", headers=employer)).json()
    assert detail["candidate"]["shared_skill_evidence"] == []

    await client.patch(
        f"/api/v1/candidates/me/skill-evidence/{evidence['id']}",
        headers=candidate,
        json={"share_with_companies": True},
    )
    detail = (await client.get(f"/api/v1/applications/{application['id']}", headers=employer)).json()
    assert [item["id"] for item in detail["candidate"]["shared_skill_evidence"]] == [evidence["id"]]
    assert "email" not in (await client.get("/api/v1/candidates/me/skills-passport", headers=candidate)).text
    assert (await client.get("/api/v1/candidates/me/skill-evidence", headers=employer)).status_code == 403


async def test_job_transparency_confirmation_and_candidate_update_estimate(client: AsyncClient) -> None:
    admin = await company_admin(client)
    employer = auth(admin["access_token"])
    job = (await client.post("/api/v1/jobs", headers=employer, json=job_payload("Transparent role"))).json()
    assert job["transparency_score"] == 100
    assert "Rango salarial publicado" in job["transparent_fields"]
    await client.post(f"/api/v1/jobs/{job['id']}/status", headers=employer, json={"status": "PUBLISHED"})

    candidate = auth(await candidate_token(client))
    public = (await client.get(f"/api/v1/jobs/{job['id']}", headers=candidate)).json()
    assert public["transparency_score"] == 100 and public["response_sla_days"] == 5
    confirmed = (
        await client.post(f"/api/v1/jobs/company/{job['id']}/confirm-active", headers=employer)
    ).json()
    assert confirmed["last_confirmed_at"] is not None

    candidate = auth(await candidate_token(client))
    application = (
        await client.post("/api/v1/applications", headers=candidate, json={"job_id": job["id"]})
    ).json()
    assert application["last_update_at"]
    assert application["estimated_next_update_at"]
    assert application["estimated_next_update_at"] > application["last_update_at"]


async def test_company_csv_exchange_only_contains_its_vacancies(client: AsyncClient) -> None:
    admin = await company_admin(client)
    employer = auth(admin["access_token"])
    payload = job_payload("CSV export role")
    payload["show_salary"] = False
    react = await skill_id(client, admin["access_token"], "React")
    payload["skills"] = [{"skill_id": react, "importance": "required", "min_proficiency": 3}]
    payload["languages"] = [{"language_code": "en", "min_level": "B1", "is_required": True}]
    payload["requirements"] = [
        {"requirement_type": "other", "description": "Colaboración con producto.", "is_required": True}
    ]
    await client.post("/api/v1/jobs", headers=employer, json=payload)
    csv = await client.get("/api/v1/jobs/company/export.csv", headers=employer)
    assert csv.status_code == 200
    assert "text/csv" in csv.headers["content-type"]
    assert "CSV export role" in csv.text and "salary_min" in csv.text
    assert "skills_json" in csv.text and "React" in csv.text and "languages_json" in csv.text

    imported_payload = job_payload("CSV imported draft")
    imported_payload["skills"] = payload["skills"]
    imported_payload["languages"] = payload["languages"]
    imported_payload["requirements"] = payload["requirements"]
    imported = await client.post(
        "/api/v1/jobs/company/import", headers=employer, json={"items": [imported_payload]}
    )
    assert imported.status_code == 201
    result = imported.json()
    assert result["created"] == 1
    new_job = (await client.get(f"/api/v1/jobs/company/{result['job_ids'][0]}", headers=employer)).json()
    assert new_job["status"] == "DRAFT"

    outsider = auth((await company_admin(client))["access_token"])
    assert (
        "CSV export role" not in (await client.get("/api/v1/jobs/company/export.csv", headers=outsider)).text
    )
