from httpx import AsyncClient

from app.tests.helpers import auth, candidate_token, company_admin, skill_id


async def test_career_map_path_progress_and_isolation(client: AsyncClient) -> None:
    token = await candidate_token(client)
    h = auth(token)
    for name, level in (("HTML", 4), ("CSS", 4), ("JavaScript", 4), ("React", 2)):
        await client.put(
            f"/api/v1/candidates/me/skills/{await skill_id(client, token, name)}",
            headers=h,
            json={"proficiency": level},
        )

    roles = (await client.get("/api/v1/career/roles", headers=h)).json()
    assert roles["roles"][0]["code"] == "frontend"
    assert "React" in roles["roles"][0]["partial"]

    bad = await client.post("/api/v1/career/paths", headers=h, json={"role_code": "astronauta"})
    assert bad.status_code == 422
    path = (await client.post("/api/v1/career/paths", headers=h, json={"role_code": "frontend"})).json()
    kinds = {n["node_type"] for n in path["nodes"]}
    assert {"profile", "skill", "course", "project", "role"} <= kinds
    react_course = next(n for n in path["nodes"] if n["node_type"] == "course" and "React" in n["label"])
    assert react_course["meta"]["url"] == "https://react.dev/learn"
    assert len(path["edges"]) >= len(path["nodes"]) - 1

    bfs = (
        await client.get(
            f"/api/v1/career/paths/{path['id']}/search/bfs", headers=h, params={"mode": "primera", "limit": 8}
        )
    ).json()
    assert bfs["algorithm"] == "bfs" and bfs["paths"]
    assert bfs["start_label"] == "Tu perfil actual" and bfs["goal_label"] == "Desarrollador/a Frontend"
    assert bfs["events"] and bfs["order_labels"]
    all_dfs = (
        await client.get(
            f"/api/v1/career/paths/{path['id']}/search/dfs", headers=h, params={"mode": "todas", "limit": 8}
        )
    ).json()
    assert all_dfs["algorithm"] == "dfs" and all_dfs["paths"]
    assert all_dfs["max_depth"] == 8 and all_dfs["backtracks"] >= 0
    assert (await client.get(f"/api/v1/career/paths/{path['id']}/search/ucs", headers=h)).status_code == 200
    assert (await client.get(f"/api/v1/career/paths/{path['id']}/search/gbfs", headers=h)).status_code == 200
    astar_m = await client.get(
        f"/api/v1/career/paths/{path['id']}/search/a_estrella",
        headers=h,
        params={"heuristic": "manhattan"},
    )
    assert astar_m.status_code == 200
    astar_m_json = astar_m.json()
    assert astar_m_json["heuristic_type"] == "manhattan"
    assert astar_m_json["heuristic_formula"] == "h(n) = |x1 - x2| + |y1 - y2|"
    assert astar_m_json["node_heuristics"]
    assert astar_m_json["heuristic_manhattan"] and astar_m_json["heuristic_euclidean"]

    astar_e = await client.get(
        f"/api/v1/career/paths/{path['id']}/search/a_estrella",
        headers=h,
        params={"heuristic": "euclidiana"},
    )
    assert astar_e.status_code == 200
    assert astar_e.json()["heuristic_type"] == "euclidiana"

    hc = await client.get(
        f"/api/v1/career/paths/{path['id']}/search/hill_climbing",
        headers=h,
        params={"heuristic": "manhattan"},
    )
    assert hc.status_code == 200
    hc_json = hc.json()
    assert hc_json["algorithm"] == "hill_climbing"
    assert hc_json["hill_climbing"]["steps"]
    assert hc_json["hill_climbing"]["outcome_distribution"]
    assert hc_json["hill_climbing"]["node_type_distribution"]
    assert hc_json["hill_climbing"]["elevation_profile"]

    ga_res = await client.get(
        f"/api/v1/career/paths/{path['id']}/search/genetico",
        headers=h,
        params={"heuristic": "manhattan"},
    )
    assert ga_res.status_code == 200
    ga_json = ga_res.json()
    assert ga_json["algorithm"] == "genetico"
    assert len(ga_json["genetic"]["components"]) == 6
    assert ga_json["genetic"]["generations"]
    assert ga_json["genetic"]["crossover_events"]
    assert ga_json["genetic"]["mutation_events"]
    assert (
        await client.get(f"/api/v1/career/paths/{path['id']}/search/bfs", headers=h, params={"mode": "todas"})
    ).status_code == 422
    assert (
        await client.get(f"/api/v1/career/paths/{path['id']}/search/bfs", headers=h, params={"limit": 30})
    ).status_code == 422

    before = path["progress"]
    updated = (
        await client.patch(
            f"/api/v1/career/paths/{path['id']}/nodes/{react_course['id']}",
            headers=h,
            json={"status": "acquired"},
        )
    ).json()
    assert updated["progress"] > before
    profile_node = next(n for n in path["nodes"] if n["node_type"] == "profile")
    locked = await client.patch(
        f"/api/v1/career/paths/{path['id']}/nodes/{profile_node['id']}", headers=h, json={"status": "gap"}
    )
    assert locked.status_code == 404

    other = auth(await candidate_token(client))
    assert (await client.get(f"/api/v1/career/paths/{path['id']}", headers=other)).status_code == 404
    assert (
        await client.get(f"/api/v1/career/paths/{path['id']}/search/bfs", headers=other)
    ).status_code == 404

    assert (await client.delete(f"/api/v1/career/paths/{path['id']}", headers=h)).status_code == 204
    assert (await client.get("/api/v1/career/paths", headers=h)).json() == []


async def test_recommendations_explain_and_respect_dismissals(client: AsyncClient) -> None:
    admin = await company_admin(client)
    ah = auth(admin["access_token"])
    react = await skill_id(client, admin["access_token"], "React")
    ts = await skill_id(client, admin["access_token"], "TypeScript")
    job = (
        await client.post(
            "/api/v1/jobs",
            headers=ah,
            json={
                "title": "Frontend React Recs",
                "modality": "remote",
                "description": "Construir interfaces con React y TypeScript en un equipo de producto.",
                "skills": [{"skill_id": react, "min_proficiency": 3}, {"skill_id": ts, "min_proficiency": 3}],
            },
        )
    ).json()
    await client.post(f"/api/v1/jobs/{job['id']}/status", headers=ah, json={"status": "PUBLISHED"})

    token = await candidate_token(client)
    h = auth(token)
    await client.put(f"/api/v1/candidates/me/skills/{react}", headers=h, json={"proficiency": 4})
    await client.patch("/api/v1/candidates/me/profile", headers=h, json={"headline": "Frontend React"})

    recs = (await client.get("/api/v1/recommendations/me", headers=h)).json()
    types = {i["rec_type"] for i in recs["items"]}
    assert {"career_path", "skill"} <= types
    assert all(i["reason"].get("summary") for i in recs["items"])
    assert recs["explanation"]["limitations"]
    ts_rec = next(i for i in recs["items"] if i["rec_type"] == "skill" and i["target_label"] == "TypeScript")
    assert any(i["rec_type"] == "course" and i["reason"].get("skill") == "TypeScript" for i in recs["items"])

    r = await client.post(
        f"/api/v1/recommendations/{ts_rec['id']}/feedback", headers=h, json={"action": "dismiss"}
    )
    assert r.status_code == 204
    again = (await client.post("/api/v1/recommendations/me/refresh", headers=h)).json()
    assert not any(i["rec_type"] == "skill" and i["target_label"] == "TypeScript" for i in again["items"])

    other = auth(await candidate_token(client))
    denied = await client.post(
        f"/api/v1/recommendations/{again['items'][0]['id']}/feedback",
        headers=other,
        json={"action": "dismiss"},
    )
    assert denied.status_code == 404
    # La empresa no tiene acceso a recomendaciones personales
    assert (await client.get("/api/v1/recommendations/me", headers=ah)).status_code == 403
