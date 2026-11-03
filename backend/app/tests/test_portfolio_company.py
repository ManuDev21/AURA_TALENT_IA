from httpx import AsyncClient

from app.tests.conftest import TEST_PASSWORD, unique_email
from app.tests.helpers import auth, candidate_token, company_admin, skill_id


async def test_portfolio_projects_and_public_visibility(client: AsyncClient) -> None:
    token = await candidate_token(client)
    me = (await client.get("/api/v1/portfolio/me", headers=auth(token))).json()
    slug = me["settings"]["slug"]
    assert me["settings"]["visibility"] == "private"

    react = await skill_id(client, token, "React")
    created = await client.post(
        "/api/v1/portfolio/me/projects",
        json={"title": "AURA Demo", "repo_url": "https://github.com/aura/demo", "skill_ids": [react, react]},
        headers=auth(token),
    )
    assert created.status_code == 201, created.text
    assert [s["name"] for s in created.json()["skills"]] == ["React"]

    bad_skill = await client.post(
        "/api/v1/portfolio/me/projects",
        json={"title": "X", "skill_ids": ["00000000-0000-0000-0000-000000000000"]},
        headers=auth(token),
    )
    assert bad_skill.status_code == 422

    assert (await client.get(f"/api/v1/portfolio/public/{slug}")).status_code == 404
    r = await client.patch("/api/v1/portfolio/me", json={"visibility": "public"}, headers=auth(token))
    assert r.status_code == 200
    public = await client.get(f"/api/v1/portfolio/public/{slug}")
    assert public.status_code == 200
    body = public.json()
    assert body["projects"][0]["title"] == "AURA Demo"
    assert "email" not in body


async def test_portfolio_slug_conflict(client: AsyncClient) -> None:
    a = await candidate_token(client)
    b = await candidate_token(client)
    slug_a = (await client.get("/api/v1/portfolio/me", headers=auth(a))).json()["settings"]["slug"]
    await client.get("/api/v1/portfolio/me", headers=auth(b))
    r = await client.patch("/api/v1/portfolio/me", json={"slug": slug_a}, headers=auth(b))
    assert r.status_code == 409
    invalid = await client.patch("/api/v1/portfolio/me", json={"slug": "Con Espacios"}, headers=auth(b))
    assert invalid.status_code == 422


async def test_company_update_and_member_invitation_flow(client: AsyncClient, monkeypatch) -> None:  # noqa: ANN001
    admin = await company_admin(client)
    h = auth(admin["access_token"])

    ws = (await client.get("/api/v1/companies/current", headers=h)).json()
    assert ws["can_edit"] and ws["can_manage_members"]
    r = await client.patch(
        "/api/v1/companies/current",
        json={
            "sector": "Tecnologia",
            "benefits": ["Remoto", "remoto", "Seguro"],
            "website": "https://aura.dev",
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["benefits"] == ["Remoto", "Seguro"]

    captured: dict[str, str | None] = {}
    from app.services import mail_service

    monkeypatch.setattr(
        mail_service.MailService,
        "send_invitation",
        lambda self, email, token, company: captured.update(token=token),
    )
    recruiter_email = unique_email("recruiter")
    invited = await client.post(
        "/api/v1/companies/current/members",
        json={"email": recruiter_email, "full_name": "Rita Reclutadora", "role": "ROLE_RECRUITER"},
        headers=h,
    )
    assert invited.status_code == 201, invited.text
    dup = await client.post(
        "/api/v1/companies/current/members",
        json={"email": recruiter_email, "full_name": "Rita", "role": "ROLE_RECRUITER"},
        headers=h,
    )
    assert dup.status_code == 409

    # La persona invitada define su contrasena con el enlace y entra como reclutadora
    assert captured["token"]
    reset = await client.post(
        "/api/v1/auth/reset-password", json={"token": captured["token"], "new_password": TEST_PASSWORD}
    )
    assert reset.status_code == 200
    login = await client.post(
        "/api/v1/auth/login", json={"email": recruiter_email, "password": TEST_PASSWORD}
    )
    recruiter = login.json()
    assert recruiter["user"]["roles"][0]["code"] == "ROLE_RECRUITER"
    rh = auth(recruiter["access_token"])

    ws_recruiter = (await client.get("/api/v1/companies/current", headers=rh)).json()
    assert ws_recruiter["company"]["id"] == ws["company"]["id"]
    assert not ws_recruiter["can_edit"]
    assert (
        await client.patch("/api/v1/companies/current", json={"sector": "X"}, headers=rh)
    ).status_code == 403

    members = (await client.get("/api/v1/companies/current/members", headers=h)).json()
    assert {m["email"] for m in members} >= {recruiter_email}

    self_removal = await client.delete(f"/api/v1/companies/current/members/{admin['user']['id']}", headers=h)
    assert self_removal.status_code == 422
    removed = await client.delete(f"/api/v1/companies/current/members/{recruiter['user']['id']}", headers=h)
    assert removed.status_code == 204
    assert (await client.get("/api/v1/companies/current", headers=rh)).status_code == 403


async def test_companies_are_isolated(client: AsyncClient) -> None:
    a = await company_admin(client)
    b = await company_admin(client)
    ca = (await client.get("/api/v1/companies/current", headers=auth(a["access_token"]))).json()
    cb = (await client.get("/api/v1/companies/current", headers=auth(b["access_token"]))).json()
    assert ca["company"]["id"] != cb["company"]["id"]
    members_b = (
        await client.get("/api/v1/companies/current/members", headers=auth(b["access_token"]))
    ).json()
    assert all(m["user_id"] != a["user"]["id"] for m in members_b)


async def test_candidate_cannot_access_company_and_catalog_admin(client: AsyncClient) -> None:
    token = await candidate_token(client)
    assert (await client.get("/api/v1/companies/current", headers=auth(token))).status_code == 403
    r = await client.post(
        "/api/v1/skills",
        json={"name": "Svelte", "category_code": "frontend", "skill_type": "framework"},
        headers=auth(token),
    )
    assert r.status_code == 403
