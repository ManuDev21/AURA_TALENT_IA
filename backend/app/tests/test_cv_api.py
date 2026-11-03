import io

from docx import Document
from httpx import AsyncClient

from app.tests.helpers import auth, candidate_token, skill_id
from app.tests.test_cv_parser import CV_TEXT

BASE = "/api/v1/cv"


async def _candidate_with_profile(client: AsyncClient) -> str:
    token = await candidate_token(client)
    h = auth(token)
    await client.patch(
        "/api/v1/candidates/me/profile", headers=h, json={"headline": "Frontend Dev", "summary": "Resumen"}
    )
    await client.post(
        "/api/v1/candidates/me/experiences",
        headers=h,
        json={
            "company_name": "Acme",
            "title": "Dev",
            "start_date": "2023-01-01",
            "is_current": True,
            "achievements": ["Logro"],
        },
    )
    await client.post(
        "/api/v1/candidates/me/education", headers=h, json={"institution": "UNAM", "degree": "Ing."}
    )
    for q in ("React", "Python", "SQL"):
        await client.put(
            f"/api/v1/candidates/me/skills/{await skill_id(client, token, q)}",
            headers=h,
            json={"proficiency": 4},
        )
    return token


async def test_create_resume_from_profile_with_target_order(client: AsyncClient) -> None:
    token = await _candidate_with_profile(client)
    h = auth(token)
    r = await client.post(f"{BASE}/resumes", headers=h, json={"name": "CV Frontend", "target": "frontend"})
    assert r.status_code == 201, r.text
    cv = r.json()
    types = [s["section_type"] for s in cv["sections"]]
    assert types[:3] == ["header", "summary", "skills"]
    assert "experience" in types and "education" in types
    assert "certifications" not in types  # sin datos, no se inventa la seccion
    skills = next(s for s in cv["sections"] if s["section_type"] == "skills")
    assert skills["content"]["groups"][0]["category"] == "Frontend"
    header = cv["sections"][0]["content"]
    assert header["headline"] == "Frontend Dev"
    assert cv["is_default"] is True and cv["version_no"] == 1

    general = (await client.post(f"{BASE}/resumes", headers=h, json={"name": "CV General"})).json()
    assert general["is_default"] is False
    assert [s["section_type"] for s in general["sections"]][2] == "experience"


async def test_edit_sections_reorder_hide_and_validation(client: AsyncClient) -> None:
    token = await _candidate_with_profile(client)
    h = auth(token)
    cv = (await client.post(f"{BASE}/resumes", headers=h, json={"name": "CV"})).json()
    sections = [{k: s[k] for k in ("section_type", "title", "is_visible", "content")} for s in cv["sections"]]
    sections.reverse()
    sections[0]["is_visible"] = False
    sections.append({"section_type": "custom", "title": "Voluntariado", "content": {"text": "Mentoria"}})
    r = await client.put(f"{BASE}/resumes/{cv['id']}/sections", headers=h, json={"sections": sections})
    assert r.status_code == 200, r.text
    updated = r.json()["sections"]
    assert [s["display_order"] for s in updated] == list(range(len(sections)))
    assert updated[0]["is_visible"] is False
    assert updated[-1]["content"] == {"text": "Mentoria"}

    bad = [{"section_type": "experience", "content": {"items": [{"title": "X", "start": "enero 2020"}]}}]
    r = await client.put(f"{BASE}/resumes/{cv['id']}/sections", headers=h, json={"sections": bad})
    assert r.status_code == 422
    two_headers = [{"section_type": "header", "content": {}}, {"section_type": "header", "content": {}}]
    assert (
        await client.put(f"{BASE}/resumes/{cv['id']}/sections", headers=h, json={"sections": two_headers})
    ).status_code == 422


async def test_sync_versions_restore_duplicate_and_pdf(client: AsyncClient) -> None:
    token = await _candidate_with_profile(client)
    h = auth(token)
    cv = (
        await client.post(f"{BASE}/resumes", headers=h, json={"name": "CV Base", "template": "aura-modern"})
    ).json()
    summary = next(s for s in cv["sections"] if s["section_type"] == "summary")

    edited = [{k: s[k] for k in ("section_type", "title", "is_visible", "content")} for s in cv["sections"]]
    for s in edited:
        if s["section_type"] == "summary":
            s["content"] = {"text": "Texto editado solo en este CV"}
    await client.put(f"{BASE}/resumes/{cv['id']}/sections", headers=h, json={"sections": edited})

    saved = (
        await client.post(
            f"{BASE}/resumes/{cv['id']}/versions", headers=h, json={"note": "Antes de sincronizar"}
        )
    ).json()
    assert saved["version_no"] == 2
    new_summary_id = next(s["id"] for s in saved["sections"] if s["section_type"] == "summary")
    assert new_summary_id != summary["id"]

    synced = (
        await client.post(f"{BASE}/resumes/{cv['id']}/sections/{new_summary_id}/sync", headers=h)
    ).json()
    assert (
        next(s for s in synced["sections"] if s["section_type"] == "summary")["content"]["text"] == "Resumen"
    )

    versions = (await client.get(f"{BASE}/resumes/{cv['id']}/versions", headers=h)).json()
    assert [v["version_no"] for v in versions] == [2, 1]
    assert versions[0]["is_current"] and versions[1]["note"] == "Antes de sincronizar"

    restored = (
        await client.post(f"{BASE}/resumes/{cv['id']}/versions/{versions[1]['id']}/restore", headers=h)
    ).json()
    assert restored["version_no"] == 3
    restored_summary = next(s for s in restored["sections"] if s["section_type"] == "summary")
    assert restored_summary["content"]["text"] == "Texto editado solo en este CV"

    copy = (
        await client.post(f"{BASE}/resumes/{cv['id']}/duplicate", headers=h, json={"target": "internship"})
    ).json()
    assert copy["name"] == "CV Base (copia)" and copy["target"] == "internship"
    assert len(copy["sections"]) == len(restored["sections"])

    await client.patch(f"{BASE}/resumes/{copy['id']}", headers=h, json={"is_default": True})
    resumes = (await client.get(f"{BASE}/resumes", headers=h)).json()
    assert [r["id"] for r in resumes if r["is_default"]] == [copy["id"]]

    pdf = await client.get(f"{BASE}/resumes/{cv['id']}/export.pdf", headers=h)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")
    assert "CV_Base.pdf" in pdf.headers["content-disposition"]


async def test_resumes_are_isolated(client: AsyncClient) -> None:
    owner = await _candidate_with_profile(client)
    intruder = await candidate_token(client)
    cv = (await client.post(f"{BASE}/resumes", headers=auth(owner), json={"name": "Privado"})).json()
    assert (await client.get(f"{BASE}/resumes/{cv['id']}", headers=auth(intruder))).status_code == 404
    assert (
        await client.get(f"{BASE}/resumes/{cv['id']}/export.pdf", headers=auth(intruder))
    ).status_code == 404
    assert (await client.delete(f"{BASE}/resumes/{cv['id']}", headers=auth(intruder))).status_code == 404


def _docx_bytes() -> bytes:
    document = Document()
    for line in CV_TEXT.split("\n"):
        document.add_paragraph(line)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


async def test_cv_analyzer_upload_review_confirm(client: AsyncClient) -> None:
    token = await candidate_token(client)
    h = auth(token)
    docx_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    fake = await client.post(
        f"{BASE}/documents", headers=h, files={"file": ("cv.pdf", b"no soy un pdf", "application/pdf")}
    )
    assert fake.status_code == 422
    assert fake.json()["error"]["code"] == "unsupported_format"

    up = await client.post(
        f"{BASE}/documents", headers=h, files={"file": ("mi_cv.docx", _docx_bytes(), docx_mime)}
    )
    assert up.status_code == 202, up.text
    doc = (await client.get(f"{BASE}/documents/{up.json()['id']}", headers=h)).json()
    assert doc["parse_status"] == "done", doc
    parsed = doc["parsed_data"]
    assert len(parsed["experiences"]) == 2
    assert {s["name"] for s in parsed["skills"]} >= {"JavaScript", "React", "Python", "SQL"}

    # La persona revisa y confirma solo una parte (y corrige un dato)
    exp = parsed["experiences"][0]
    react = next(s for s in parsed["skills"] if s["name"] == "React")
    payload = {
        "headline": parsed["fields"]["headline"]["value"],
        "experiences": [
            {
                "company_name": exp["company_name"],
                "title": "Frontend Developer Sr",
                "start_date": exp["start_date"],
                "is_current": exp["is_current"],
                "achievements": exp["achievements"],
            }
        ],
        "languages": [{"language_code": "en", "level": "B2"}, {"language_code": "en", "level": "C1"}],
        "skills": [{"skill_id": react["skill_id"], "proficiency": 4}],
    }
    r = await client.post(f"{BASE}/documents/{doc['id']}/confirm", headers=h, json=payload)
    assert r.status_code == 200, r.text
    assert r.json()["created"]["experiences"] == 1
    assert r.json()["skipped"]["languages"] == 1

    overview = (await client.get("/api/v1/candidates/me", headers=h)).json()
    assert overview["profile"]["headline"] == "Desarrolladora Frontend"
    assert overview["experiences"][0]["title"] == "Frontend Developer Sr"
    assert overview["experiences"][0]["source"] == "cv_parsed"
    assert [s["skill"]["name"] for s in overview["skills"]] == ["React"]
    assert overview["education"] == []  # lo que no se confirmo no se guarda

    again = await client.post(f"{BASE}/documents/{doc['id']}/confirm", headers=h, json=payload)
    assert again.status_code == 409
    assert (await client.delete(f"{BASE}/documents/{doc['id']}", headers=h)).status_code == 204
    assert (await client.get(f"{BASE}/documents/{doc['id']}", headers=h)).status_code == 404
