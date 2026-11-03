import io

import pdfplumber
from httpx import AsyncClient
from openpyxl import load_workbook

from app.tests.helpers import auth, candidate_token, company_admin, skill_id


async def _setup(client: AsyncClient) -> tuple[dict, dict, str, str]:
    admin = await company_admin(client)
    ah = auth(admin["access_token"])
    react = await skill_id(client, admin["access_token"], "React")
    job = (
        await client.post(
            "/api/v1/jobs",
            headers=ah,
            json={
                "title": "Frontend Analitica",
                "modality": "remote",
                "description": "Construir interfaces con React para el equipo de producto y datos.",
                "skills": [{"skill_id": react, "min_proficiency": 3}],
            },
        )
    ).json()
    await client.post(f"/api/v1/jobs/{job['id']}/status", headers=ah, json={"status": "PUBLISHED"})
    h = auth(await candidate_token(client))
    app = (await client.post("/api/v1/applications", headers=h, json={"job_id": job["id"]})).json()
    await client.post(
        f"/api/v1/applications/{app['id']}/transition", headers=ah, json={"to_stage": "SCREENING"}
    )
    return ah, h, job["id"], app["id"]


async def test_company_analytics_funnel_gaps_and_isolation(client: AsyncClient) -> None:
    ah, h, job_id, _ = await _setup(client)
    data = (await client.get("/api/v1/analytics/company", headers=ah)).json()
    assert data["kpis"]["applications"] == 1 and data["small_sample"] is True
    by = {f["stage"]: f["count"] for f in data["funnel"]}
    assert by["APPLIED"] == 1 and by["SCREENING"] == 1 and by["INTERVIEW"] == 0
    assert data["top_gaps"] == [{"name": "React", "count": 1}]
    assert data["explanation"]["limitations"]

    other = auth((await company_admin(client))["access_token"])
    assert (await client.get(f"/api/v1/analytics/company?job_id={job_id}", headers=other)).status_code == 404
    assert (await client.get("/api/v1/analytics/company", headers=h)).status_code == 403


async def test_reports_pdf_xlsx_and_personal(client: AsyncClient) -> None:
    ah, h, job_id, _ = await _setup(client)
    pdf = await client.get(f"/api/v1/reports/jobs/{job_id}.pdf", headers=ah)
    assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf"
    with pdfplumber.open(io.BytesIO(pdf.content)) as doc:
        text = "".join(p.extract_text() or "" for p in doc.pages)
    assert "Frontend Analitica" in text and "Embudo" in text

    xlsx = await client.get(f"/api/v1/reports/jobs/{job_id}.xlsx", headers=ah)
    wb = load_workbook(io.BytesIO(xlsx.content))
    assert "Postulantes" in wb.sheetnames and wb["Postulantes"].max_row == 2

    assert (await client.get(f"/api/v1/reports/jobs/{job_id}.pdf", headers=h)).status_code == 403
    other = auth((await company_admin(client))["access_token"])
    assert (await client.get(f"/api/v1/reports/jobs/{job_id}.pdf", headers=other)).status_code == 404

    me = await client.get("/api/v1/reports/me.pdf", headers=h)
    assert me.status_code == 200 and me.content.startswith(b"%PDF")
    personal = (await client.get("/api/v1/analytics/me", headers=h)).json()
    assert personal["kpis"]["applications"] == 1
    assert personal["applications_by_stage"][0]["label"] == "Revision de perfil"
