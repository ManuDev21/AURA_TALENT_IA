from httpx import AsyncClient

from app.tests.helpers import auth, candidate_token, company_admin, skill_id


def _job_payload(react_id: str, **overrides: object) -> dict:
    payload = {
        "title": "Frontend Developer React",
        "description": "Buscamos una persona para construir interfaces accesibles con React y TypeScript.",
        "modality": "remote",
        "salary_min": 30000,
        "salary_max": 45000,
        "salary_currency": "mxn",
        "show_salary": False,
        "experience_min_years": 2,
        "responsibilities": ["Construir componentes", "  "],
        "skills": [{"skill_id": react_id, "importance": "required", "min_proficiency": 4}],
        "languages": [{"language_code": "EN", "min_level": "B2"}],
        "requirements": [{"requirement_type": "education", "description": "Carrera afin"}],
    }
    payload.update(overrides)
    return payload


async def _published_job(client: AsyncClient) -> tuple[dict, dict, str]:
    admin = await company_admin(client)
    h = auth(admin["access_token"])
    react = await skill_id(client, admin["access_token"], "React")
    job = await client.post("/api/v1/jobs", headers=h, json=_job_payload(react))
    assert job.status_code == 201, job.text
    published = await client.post(
        f"/api/v1/jobs/{job.json()['id']}/status", headers=h, json={"status": "PUBLISHED"}
    )
    assert published.status_code == 200
    return admin, published.json(), react


async def test_job_lifecycle_and_visibility(client: AsyncClient) -> None:
    admin = await company_admin(client)
    h = auth(admin["access_token"])
    react = await skill_id(client, admin["access_token"], "React")
    created = (
        await client.post("/api/v1/jobs", headers=h, json=_job_payload(react, title="Vacante unica QA-9173"))
    ).json()
    assert created["status"] == "DRAFT"
    assert created["responsibilities"] == ["Construir componentes"]
    assert created["salary_currency"] == "MXN"
    assert created["skills"][0]["skill"]["name"] == "React"

    cand = auth(await candidate_token(client))
    search = (await client.get("/api/v1/jobs", headers=cand, params={"q": "QA-9173"})).json()
    assert search["total"] == 0
    assert (await client.get(f"/api/v1/jobs/{created['id']}", headers=cand)).status_code == 404

    bad = await client.post(f"/api/v1/jobs/{created['id']}/status", headers=h, json={"status": "PAUSED"})
    assert bad.status_code == 422
    await client.post(f"/api/v1/jobs/{created['id']}/status", headers=h, json={"status": "PUBLISHED"})
    search = (await client.get("/api/v1/jobs", headers=cand, params={"q": "QA-9173"})).json()
    assert search["total"] == 1
    item = search["items"][0]
    assert item["salary_min"] is None and item["salary_max"] is None  # show_salary=False
    by_skill = (
        await client.get("/api/v1/jobs", headers=cand, params={"q": "QA-9173", "skill_id": react})
    ).json()
    assert by_skill["total"] == 1

    assert (await client.delete(f"/api/v1/jobs/{created['id']}", headers=h)).status_code == 422
    await client.post(f"/api/v1/jobs/{created['id']}/status", headers=h, json={"status": "CLOSED"})
    edit = await client.put(f"/api/v1/jobs/{created['id']}", headers=h, json=_job_payload(react))
    assert edit.status_code == 422
    reopen = await client.post(
        f"/api/v1/jobs/{created['id']}/status", headers=h, json={"status": "PUBLISHED"}
    )
    assert reopen.status_code == 422


async def test_job_validation_and_company_isolation(client: AsyncClient) -> None:
    admin_a = await company_admin(client)
    admin_b = await company_admin(client)
    react = await skill_id(client, admin_a["access_token"], "React")
    bad_salary = _job_payload(react, salary_min=50000, salary_max=10000)
    assert (
        await client.post("/api/v1/jobs", headers=auth(admin_a["access_token"]), json=bad_salary)
    ).status_code == 422
    dup_skill = _job_payload(react, skills=[{"skill_id": react}, {"skill_id": react}])
    assert (
        await client.post("/api/v1/jobs", headers=auth(admin_a["access_token"]), json=dup_skill)
    ).status_code == 422

    job = (
        await client.post("/api/v1/jobs", headers=auth(admin_a["access_token"]), json=_job_payload(react))
    ).json()
    hb = auth(admin_b["access_token"])
    assert (
        await client.put(f"/api/v1/jobs/{job['id']}", headers=hb, json=_job_payload(react))
    ).status_code == 404
    assert (
        await client.post(f"/api/v1/jobs/{job['id']}/status", headers=hb, json={"status": "PUBLISHED"})
    ).status_code == 404
    assert (await client.get(f"/api/v1/jobs/{job['id']}/applications", headers=hb)).status_code == 404
    assert all(j["id"] != job["id"] for j in (await client.get("/api/v1/jobs/company", headers=hb)).json())

    cand = auth(await candidate_token(client))
    assert (await client.post("/api/v1/jobs", headers=cand, json=_job_payload(react))).status_code == 403
    assert (await client.get("/api/v1/jobs/company", headers=cand)).status_code == 403


async def test_application_pipeline_with_human_decisions(client: AsyncClient) -> None:
    admin, job, _ = await _published_job(client)
    h = auth(admin["access_token"])
    cand_token = await candidate_token(client)
    ch = auth(cand_token)

    await client.patch("/api/v1/candidates/me/profile", headers=ch, json={"headline": "Frontend Jr"})
    cv = (await client.post("/api/v1/cv/resumes", headers=ch, json={"name": "Mi CV"})).json()

    applied = await client.post(
        "/api/v1/applications", headers=ch, json={"job_id": job["id"], "resume_id": cv["id"]}
    )
    assert applied.status_code == 201, applied.text
    app_id = applied.json()["id"]
    assert applied.json()["current_stage"] == "APPLIED"
    assert applied.json()["job"]["salary_min"] is None
    dup = await client.post("/api/v1/applications", headers=ch, json={"job_id": job["id"]})
    assert dup.status_code == 409

    # El CV enviado queda congelado aunque la persona lo edite despues
    after = (await client.get(f"/api/v1/cv/resumes/{cv['id']}", headers=ch)).json()
    assert after["version_no"] == 2
    edited = [
        {
            "section_type": "summary",
            "title": "Perfil",
            "is_visible": True,
            "content": {"text": "Editado despues"},
        }
    ]
    await client.put(f"/api/v1/cv/resumes/{cv['id']}/sections", headers=ch, json={"sections": edited})

    applicants = (await client.get(f"/api/v1/jobs/{job['id']}/applications", headers=h)).json()
    assert len(applicants) == 1 and applicants[0]["headline"] == "Frontend Jr"
    detail = (await client.get(f"/api/v1/applications/{app_id}", headers=h)).json()
    assert detail["allowed_transitions"] == ["SCREENING", "CLOSED"]
    assert "Editado despues" not in str(detail["resume_sections"])
    assert detail["resume_sections"][0]["section_type"] == "header"

    skip = await client.post(
        f"/api/v1/applications/{app_id}/transition", headers=h, json={"to_stage": "INTERVIEW"}
    )
    assert skip.status_code == 422 and skip.json()["error"]["code"] == "invalid_transition"
    ok = await client.post(
        f"/api/v1/applications/{app_id}/transition",
        headers=h,
        json={"to_stage": "SCREENING", "comment": "Perfil solido"},
    )
    assert ok.status_code == 200 and ok.json()["current_stage"] == "SCREENING"

    no_confirm = await client.post(
        f"/api/v1/applications/{app_id}/transition",
        headers=h,
        json={"to_stage": "CLOSED", "comment": "Otro perfil"},
    )
    assert no_confirm.json()["error"]["code"] == "confirmation_required"
    no_comment = await client.post(
        f"/api/v1/applications/{app_id}/transition", headers=h, json={"to_stage": "CLOSED", "confirm": True}
    )
    assert no_comment.json()["error"]["code"] == "comment_required"

    note = await client.post(
        f"/api/v1/applications/{app_id}/notes", headers=h, json={"body": "Buena comunicacion"}
    )
    assert note.status_code == 201 and note.json()["author_name"]

    closed = await client.post(
        f"/api/v1/applications/{app_id}/transition",
        headers=h,
        json={"to_stage": "CLOSED", "comment": "Se eligio otro perfil", "confirm": True},
    )
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed" and closed.json()["allowed_transitions"] == []
    history = closed.json()["history"]
    assert [e["to_stage"] for e in history] == ["APPLIED", "SCREENING", "CLOSED"]
    assert all(e["actor_type"] == "human" for e in history)

    mine = (await client.get("/api/v1/applications/me", headers=ch)).json()
    assert mine[0]["status"] == "closed"
    assert "comment" not in mine[0]["timeline"][0]  # los comentarios internos no se exponen
    notes = (await client.get("/api/v1/notifications/me", headers=ch)).json()
    assert notes["unread"] == 2
    assert "Se eligio otro perfil" not in str(notes)
    await client.post("/api/v1/notifications/me/read-all", headers=ch)
    assert (await client.get("/api/v1/notifications/me", headers=ch)).json()["unread"] == 0

    recruiter_notes = (await client.get("/api/v1/notifications/me", headers=h)).json()
    assert recruiter_notes["items"][0]["notification_type"] == "application_received"


async def test_withdraw_and_cross_company_access(client: AsyncClient) -> None:
    _, job, _ = await _published_job(client)
    other = await company_admin(client)
    ch = auth(await candidate_token(client))
    app_id = (await client.post("/api/v1/applications", headers=ch, json={"job_id": job["id"]})).json()["id"]

    ho = auth(other["access_token"])
    assert (await client.get(f"/api/v1/applications/{app_id}", headers=ho)).status_code == 404
    assert (
        await client.post(
            f"/api/v1/applications/{app_id}/transition", headers=ho, json={"to_stage": "SCREENING"}
        )
    ).status_code == 404

    stranger = auth(await candidate_token(client))
    assert (await client.post(f"/api/v1/applications/{app_id}/withdraw", headers=stranger)).status_code == 404
    assert (await client.get(f"/api/v1/applications/{app_id}", headers=stranger)).status_code == 403

    withdrawn = await client.post(f"/api/v1/applications/{app_id}/withdraw", headers=ch)
    assert withdrawn.status_code == 200 and withdrawn.json()["status"] == "withdrawn"
    assert (await client.post(f"/api/v1/applications/{app_id}/withdraw", headers=ch)).status_code == 422
