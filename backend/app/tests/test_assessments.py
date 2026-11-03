from httpx import AsyncClient

from app.tests.conftest import register
from app.tests.helpers import auth, candidate_token, company_admin, grant_role, skill_id

A = "/api/v1/assessments"


async def _catalog(client: AsyncClient, h: dict) -> dict[str, dict]:
    items = (await client.get(f"{A}/catalog", headers=h)).json()
    return {i["code"]: i for i in items}


async def _answer_all(client: AsyncClient, h: dict, session: dict, value: int = 4) -> None:
    for q in session["questions"]:
        body = {"question_id": q["id"], "time_ms": 2500}
        if q["question_type"] == "likert":
            body["numeric_value"] = value
        else:
            body["option_id"] = q["options"][0]["id"]
        r = await client.put(f"{A}/attempts/{session['attempt_id']}/answers", headers=h, json=body)
        assert r.status_code == 204, r.text


async def test_psychometric_flow_with_consent_and_disclaimer(client: AsyncClient) -> None:
    h = auth(await candidate_token(client))
    catalog = await _catalog(client, h)
    assert {"AURA-ORIENT-EXP", "AURA-TECH-JS-BASIC", "AURA-SJT-WORK-01"} <= set(catalog)
    psy = catalog["AURA-ORIENT-EXP"]
    assert psy["is_experimental"] and psy["question_count"] == 25

    intro = (await client.get(f"{A}/versions/{psy['version_id']}", headers=h)).json()
    assert intro["requires_consent"] and "no constituye un diagnostico" in intro["disclaimer_text"]

    denied = await client.post(f"{A}/attempts", headers=h, json={"version_id": psy["version_id"]})
    assert denied.json()["error"]["code"] == "consent_required"
    session = (
        await client.post(f"{A}/attempts", headers=h, json={"version_id": psy["version_id"], "consent": True})
    ).json()
    assert len(session["questions"]) == 25
    # El cliente nunca recibe claves de puntuacion
    assert all(
        set(q) == {"id", "question_type", "stem", "context", "options", "scale"} for q in session["questions"]
    )
    again = (
        await client.post(f"{A}/attempts", headers=h, json={"version_id": psy["version_id"], "consent": True})
    ).json()
    assert again["attempt_id"] == session["attempt_id"]  # reanuda el intento en curso

    q0 = session["questions"][0]["id"]
    bad = await client.put(
        f"{A}/attempts/{session['attempt_id']}/answers",
        headers=h,
        json={"question_id": q0, "numeric_value": 6},
    )
    assert bad.status_code == 422
    first = await client.put(
        f"{A}/attempts/{session['attempt_id']}/answers",
        headers=h,
        json={"question_id": q0, "numeric_value": 5},
    )
    assert first.status_code == 204
    incomplete = await client.post(f"{A}/attempts/{session['attempt_id']}/submit", headers=h)
    assert incomplete.json()["error"]["code"] == "incomplete_attempt"

    await _answer_all(client, h, session)
    result = await client.post(f"{A}/attempts/{session['attempt_id']}/submit", headers=h)
    assert result.status_code == 200, result.text
    body = result.json()
    assert len(body["dimensions"]) == 8
    assert body["overall_score"] is None and body["review"] == []
    dim = body["dimensions"][0]
    assert dim["interpretation"].startswith("Las respuestas muestran una tendencia")
    assert dim["recommendations"] and dim["evidence"]
    assert "no constituye un diagnostico" in body["disclaimer"]
    assert any("mismo valor" in n for n in body["quality_notes"])  # todas las respuestas en 4
    assert body["explanation"]["limitations"]

    resubmit = await client.post(f"{A}/attempts/{session['attempt_id']}/submit", headers=h)
    assert resubmit.status_code == 409
    history = (await client.get(f"{A}/attempts/me", headers=h)).json()
    assert history[0]["status"] == "scored"
    no_share = await client.patch(
        f"{A}/attempts/{session['attempt_id']}/sharing", headers=h, json={"share_with_company": True}
    )
    assert no_share.json()["error"]["code"] == "no_assignment"


async def test_technical_and_situational_review(client: AsyncClient) -> None:
    h = auth(await candidate_token(client))
    catalog = await _catalog(client, h)
    for code in ("AURA-TECH-JS-BASIC", "AURA-SJT-WORK-01"):
        session = (
            await client.post(f"{A}/attempts", headers=h, json={"version_id": catalog[code]["version_id"]})
        ).json()
        await _answer_all(client, h, session)
        result = (await client.post(f"{A}/attempts/{session['attempt_id']}/submit", headers=h)).json()
        assert result["overall_score"] is not None and result["overall_band"] in {"low", "moderate", "high"}
        assert result["review"] and all(r["selected"] for r in result["review"])
        if code == "AURA-TECH-JS-BASIC":
            assert all(r["correct"] for r in result["review"]) and result["review"][0]["explanation"]
        else:
            assert all(r["rationale"] for r in result["review"])
    other = auth(await candidate_token(client))
    assert (
        await client.get(f"{A}/attempts/{session['attempt_id']}/result", headers=other)
    ).status_code == 404


async def test_company_assignment_and_psychometric_privacy(client: AsyncClient) -> None:
    admin = await company_admin(client)
    ah = auth(admin["access_token"])
    react = await skill_id(client, admin["access_token"], "React")
    job = (
        await client.post(
            "/api/v1/jobs",
            headers=ah,
            json={
                "title": "Dev React",
                "description": "Descripcion suficiente de la vacante para publicar.",
                "modality": "remote",
                "skills": [{"skill_id": react}],
            },
        )
    ).json()
    await client.post(f"/api/v1/jobs/{job['id']}/status", headers=ah, json={"status": "PUBLISHED"})
    ch = auth(await candidate_token(client))
    app_id = (await client.post("/api/v1/applications", headers=ch, json={"job_id": job["id"]})).json()["id"]

    assignable = {v["title"]: v for v in (await client.get(f"{A}/assignable", headers=ah)).json()}
    tech = next(v for v in assignable.values() if v["type_code"] == "technical")
    psy = next(v for v in assignable.values() if v["type_code"] == "psychometric")
    for v in (tech, psy):
        r = await client.post(
            f"{A}/assignments", headers=ah, json={"version_id": v["version_id"], "application_id": app_id}
        )
        assert r.status_code == 201, r.text
    dup = await client.post(
        f"{A}/assignments", headers=ah, json={"version_id": tech["version_id"], "application_id": app_id}
    )
    assert dup.status_code == 409

    catalog = await _catalog(client, ch)
    tech_item = catalog["AURA-TECH-JS-BASIC"]
    assert tech_item["pending_assignments"][0]["job_title"] == "Dev React"
    notes = (await client.get("/api/v1/notifications/me", headers=ch)).json()
    assert any(n["notification_type"] == "assessment_assigned" for n in notes["items"])

    for item, consent in ((tech_item, False), (catalog["AURA-ORIENT-EXP"], True)):
        assignment_id = item["pending_assignments"][0]["id"]
        session = (
            await client.post(
                f"{A}/attempts",
                headers=ch,
                json={"version_id": item["version_id"], "consent": consent, "assignment_id": assignment_id},
            )
        ).json()
        assert session["assignment_company"]
        await _answer_all(client, ch, session, value=3)
        await client.post(f"{A}/attempts/{session['attempt_id']}/submit", headers=ch)
        if item["code"] == "AURA-ORIENT-EXP":
            psy_attempt = session["attempt_id"]

    views = {
        v["type_code"]: v
        for v in (await client.get(f"/api/v1/applications/{app_id}/assessments", headers=ah)).json()
    }
    assert views["technical"]["shared"] and views["technical"]["result"]["overall_score"] is not None
    assert views["psychometric"]["status"] == "completed"
    assert views["psychometric"]["shared"] is False and views["psychometric"]["result"] is None

    shared = await client.patch(
        f"{A}/attempts/{psy_attempt}/sharing", headers=ch, json={"share_with_company": True}
    )
    assert shared.json()["share_with_company"] is True
    views = {
        v["type_code"]: v
        for v in (await client.get(f"/api/v1/applications/{app_id}/assessments", headers=ah)).json()
    }
    assert len(views["psychometric"]["result"]["dimensions"]) == 8

    other = await company_admin(client)
    assert (
        await client.get(f"/api/v1/applications/{app_id}/assessments", headers=auth(other["access_token"]))
    ).status_code == 404
    assert (await client.get(f"{A}/assignable", headers=ch)).status_code == 403


async def test_instrument_versioning_and_import(client: AsyncClient) -> None:
    body = (await register(client))["body"]
    await grant_role(body["user"]["id"], "ROLE_SYSTEM_ADMIN")
    h = auth(body["access_token"])
    cand = auth(await candidate_token(client))
    assert (await client.get("/api/v1/psychometrics/instruments", headers=cand)).status_code == 403

    instruments = {
        i["code"]: i for i in (await client.get("/api/v1/psychometrics/instruments", headers=h)).json()
    }
    tech = instruments["AURA-TECH-JS-BASIC"]
    v1 = tech["versions"][0]
    detail = (await client.get(f"/api/v1/psychometrics/versions/{v1['id']}", headers=h)).json()
    assert detail["definition"]["questions"][0]["options"]

    draft = (await client.post(f"/api/v1/psychometrics/versions/{v1['id']}/clone", headers=h)).json()
    assert draft["version_no"] == 2 and draft["status"] == "draft"
    assert (
        await client.post(f"/api/v1/psychometrics/versions/{v1['id']}/clone", headers=h)
    ).status_code == 409
    published = (await client.post(f"/api/v1/psychometrics/versions/{draft['id']}/publish", headers=h)).json()
    assert published["status"] == "published" and published["checksum"]
    refreshed = {
        i["code"]: i for i in (await client.get("/api/v1/psychometrics/instruments", headers=h)).json()
    }
    statuses = {v["version_no"]: v["status"] for v in refreshed["AURA-TECH-JS-BASIC"]["versions"]}
    assert statuses == {1: "retired", 2: "published"}
    catalog = await _catalog(client, cand)
    assert catalog["AURA-TECH-JS-BASIC"]["version_id"] == draft["id"]

    definition = {
        "code": "AURA-LOGIC-01",
        "title": "Razonamiento logico basico",
        "type_code": "logical",
        "is_experimental": True,
        "version": {
            "questions": [
                {
                    "question_type": "multiple_choice",
                    "stem": "Si todos los A son B y ningun B es C, entonces:",
                    "options": [
                        {"label": "Ningun A es C", "is_correct": True},
                        {"label": "Algun A es C", "is_correct": False},
                    ],
                }
            ],
            "scoring": [{"method": "correct_count"}],
            "interpretation": [
                {"min_score": 0, "max_score": 100, "band": "moderate", "text_template": "Resultado"}
            ],
        },
    }
    imported = await client.post("/api/v1/psychometrics/instruments", headers=h, json=definition)
    assert imported.status_code == 201, imported.text
    assert (
        await client.post("/api/v1/psychometrics/instruments", headers=h, json=definition)
    ).status_code == 409
    broken = {**definition, "code": "AURA-LOGIC-02"}
    broken["version"] = {
        **definition["version"],
        "questions": [{**definition["version"]["questions"][0], "dimension_code": "NOPE"}],
    }
    assert (await client.post("/api/v1/psychometrics/instruments", headers=h, json=broken)).status_code == 422
    assert "AURA-LOGIC-01" not in await _catalog(client, cand)  # borrador: no visible
    await client.post(f"/api/v1/psychometrics/versions/{imported.json()['id']}/publish", headers=h)
    assert "AURA-LOGIC-01" in await _catalog(client, cand)
