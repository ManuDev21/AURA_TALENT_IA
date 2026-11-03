from httpx import AsyncClient

from app.tests.helpers import auth, candidate_token, company_admin, skill_id

BASE = "/api/v1/candidates/me"


async def test_overview_and_profile_update(client: AsyncClient) -> None:
    token = await candidate_token(client)
    overview = await client.get(BASE, headers=auth(token))
    assert overview.status_code == 200
    assert overview.json()["profile"]["completeness"] == 0

    r = await client.patch(
        f"{BASE}/profile",
        json={
            "headline": "  Frontend Developer  ",
            "desired_roles": ["Frontend", "frontend", " React Dev "],
            "availability": "immediate",
            "work_modality": "remote",
            "salary_currency": "mxn",
        },
        headers=auth(token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["headline"] == "Frontend Developer"
    assert body["desired_roles"] == ["Frontend", "React Dev"]
    assert body["salary_currency"] == "MXN"
    assert body["completeness"] == 10 + 5 + 10


async def test_profile_rejects_invalid_enum(client: AsyncClient) -> None:
    token = await candidate_token(client)
    r = await client.patch(f"{BASE}/profile", json={"work_modality": "mars"}, headers=auth(token))
    assert r.status_code == 422


async def test_experience_crud_and_date_validation(client: AsyncClient) -> None:
    token = await candidate_token(client)
    bad = await client.post(
        f"{BASE}/experiences",
        json={"company_name": "Acme", "title": "Dev", "start_date": "2024-05-01", "end_date": "2023-01-01"},
        headers=auth(token),
    )
    assert bad.status_code == 422

    created = await client.post(
        f"{BASE}/experiences",
        json={
            "company_name": "Acme",
            "title": "Dev",
            "start_date": "2023-01-01",
            "end_date": "2024-01-01",
            "is_current": True,
            "achievements": ["  Migre la app a React  ", ""],
        },
        headers=auth(token),
    )
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["end_date"] is None
    assert item["achievements"] == ["Migre la app a React"]

    updated = await client.put(
        f"{BASE}/experiences/{item['id']}",
        json={"company_name": "Acme Corp", "title": "Senior Dev", "start_date": "2023-01-01"},
        headers=auth(token),
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Senior Dev"

    assert (await client.delete(f"{BASE}/experiences/{item['id']}", headers=auth(token))).status_code == 204
    overview = (await client.get(BASE, headers=auth(token))).json()
    assert overview["experiences"] == []


async def test_items_are_isolated_between_candidates(client: AsyncClient) -> None:
    owner = await candidate_token(client)
    intruder = await candidate_token(client)
    created = await client.post(
        f"{BASE}/education", json={"institution": "UNAM", "level": "bachelor"}, headers=auth(owner)
    )
    item_id = created.json()["id"]
    payload = {"institution": "Hackeado"}
    assert (
        await client.put(f"{BASE}/education/{item_id}", json=payload, headers=auth(intruder))
    ).status_code == 404
    assert (await client.delete(f"{BASE}/education/{item_id}", headers=auth(intruder))).status_code == 404
    owner_view = (await client.get(BASE, headers=auth(owner))).json()
    assert owner_view["education"][0]["institution"] == "UNAM"


async def test_duplicate_language_conflict(client: AsyncClient) -> None:
    token = await candidate_token(client)
    first = await client.post(
        f"{BASE}/languages", json={"language_code": "EN", "level": "B2"}, headers=auth(token)
    )
    assert first.status_code == 201
    assert first.json()["language_code"] == "en"
    dup = await client.post(
        f"{BASE}/languages", json={"language_code": "en", "level": "C1"}, headers=auth(token)
    )
    assert dup.status_code == 409


async def test_link_requires_valid_url(client: AsyncClient) -> None:
    token = await candidate_token(client)
    bad = await client.post(
        f"{BASE}/links", json={"link_type": "github", "url": "no-es-url"}, headers=auth(token)
    )
    assert bad.status_code == 422
    ok = await client.post(
        f"{BASE}/links", json={"link_type": "github", "url": "https://github.com/aura"}, headers=auth(token)
    )
    assert ok.status_code == 201
    assert ok.json()["url"].startswith("https://github.com/aura")


async def test_skill_search_by_alias_and_upsert(client: AsyncClient) -> None:
    token = await candidate_token(client)
    results = (await client.get("/api/v1/skills", params={"q": "JS"}, headers=auth(token))).json()
    assert any(s["name"] == "JavaScript" for s in results)

    js = await skill_id(client, token, "JavaScript")
    react = await skill_id(client, token, "React")
    ts = await skill_id(client, token, "TypeScript")
    for sid, level in ((js, 5), (react, 4), (ts, 2)):
        r = await client.put(
            f"{BASE}/skills/{sid}", json={"proficiency": level, "years_experience": 2}, headers=auth(token)
        )
        assert r.status_code == 200, r.text
    again = await client.put(f"{BASE}/skills/{ts}", json={"proficiency": 3}, headers=auth(token))
    assert again.json()["proficiency"] == 3
    assert again.json()["skill"]["category"]["code"] == "frontend"

    overview = (await client.get(BASE, headers=auth(token))).json()
    assert len(overview["skills"]) == 3
    assert overview["profile"]["completeness"] == 15

    indicators = (await client.get(f"{BASE}/indicators", headers=auth(token))).json()
    frontend = next(i for i in indicators["indicators"] if i["category_code"] == "frontend")
    assert 0 < frontend["score"] <= 100
    assert frontend["skills_count"] == 3
    assert "generados por el sistema" in indicators["disclaimer"]
    assert indicators["limitations"]

    assert (await client.delete(f"{BASE}/skills/{ts}", headers=auth(token))).status_code == 204
    bad = await client.put(
        f"{BASE}/skills/00000000-0000-0000-0000-000000000000", json={"proficiency": 3}, headers=auth(token)
    )
    assert bad.status_code == 404


async def test_company_accounts_cannot_use_candidate_profile(client: AsyncClient) -> None:
    admin = await company_admin(client)
    r = await client.get(BASE, headers=auth(admin["access_token"]))
    assert r.status_code == 403
