from app.career.search import GraphEdge, GraphNode, euclidean_distance, manhattan_distance, search


def graph():
    nodes = [
        GraphNode("s", "Perfil", "profile"),
        GraphNode("a", "React", "skill", 10),
        GraphNode("b", "TypeScript", "skill", 2),
        GraphNode("c", "Proyecto", "project", 3),
        GraphNode("g", "Frontend", "role"),
        GraphNode("x", "Ruta larga", "skill", 1),
    ]
    edges = [
        GraphEdge("s", "a", 1),
        GraphEdge("s", "x", 1),
        GraphEdge("a", "g", 1),
        GraphEdge("a", "b", 1),
        GraphEdge("b", "g", 1),
        GraphEdge("x", "c", 1),
        GraphEdge("c", "g", 1),
        GraphEdge("b", "s", 0.5),
    ]
    return nodes, edges


def test_bfs_finds_route_with_fewest_steps_and_detects_cycles():
    nodes, edges = graph()
    result = search(nodes, edges, "s", "g", "bfs")
    assert result.paths[0].nodes == ("s", "a", "g")
    assert result.explored >= 4
    assert result.events[0]["f"] == result.events[0]["depth"] == 0
    assert any(e["type"] == "goal" for e in result.events)


def test_dfs_enumerates_simple_paths_and_backtracks_with_depth_limit():
    nodes, edges = graph()
    result = search(nodes, edges, "s", "g", "dfs", "todas", max_depth=4)
    routes = {path.nodes for path in result.paths}
    assert routes == {
        ("s", "a", "b", "g"),
        ("s", "a", "g"),
        ("s", "x", "c", "g"),
    }
    assert result.backtracks > 0
    assert ("b", "s") in result.cycles_avoided
    assert all(len(p.nodes) == len(set(p.nodes)) for p in result.paths)


def test_dfs_depth_limit_prunes_long_route():
    nodes, edges = graph()
    result = search(nodes, edges, "s", "g", "dfs", "todas", max_depth=2)
    assert any(e["type"] == "prune" for e in result.events)
    assert ("s", "x", "c", "g") not in {p.nodes for p in result.paths}


def test_ucs_and_a_star_minimize_cost_not_number_of_steps():
    nodes, edges = graph()
    ucs = search(nodes, edges, "s", "g", "ucs")
    astar = search(nodes, edges, "s", "g", "a_estrella")
    assert ucs.paths[0].nodes == ("s", "x", "c", "g")
    assert astar.paths[0].cost == ucs.paths[0].cost
    assert ucs.paths[0].cost == 5
    assert ucs.events[0]["f"] == ucs.events[0]["g"] == 0
    assert astar.events[0]["f"] == 0


def test_greedy_best_first_reports_heuristic_priority():
    nodes, edges = graph()
    result = search(nodes, edges, "s", "g", "gbfs")
    assert result.paths
    assert result.events[0]["type"] == "visit"
    assert result.heuristic["g"] == 0
    assert result.events[0]["f"] == result.events[0]["h"]
    assert result.algorithm == "gbfs"


def test_unreachable_goal_returns_trace_without_route():
    nodes, edges = graph()
    result = search(nodes, edges, "g", "s", "ucs")
    assert result.paths == ()
    assert result.order == ("g",)


def test_invalid_nodes_or_algorithm_rejected():
    nodes, edges = graph()
    try:
        search(nodes, edges, "missing", "g", "bfs")
    except ValueError as exc:
        assert "nodo" in str(exc)
    else:
        raise AssertionError("Debio rechazar el nodo inicial desconocido")


def test_manhattan_and_euclidean_heuristics_compute_exact_geometry():
    assert manhattan_distance(-2.0, 3.0, 4.0, -1.0) == 10.0
    assert euclidean_distance(0.0, 0.0, 3.0, 4.0) == 5.0

    nodes = [
        GraphNode("s", "Perfil", "profile", pos_x=-6.0, pos_y=0.0, pos_z=0.0),
        GraphNode("a", "Diagonal", "skill", 2, pos_x=3.5, pos_y=4.0, pos_z=0.0),
        GraphNode("b", "Eje X", "skill", 2, pos_x=0.5, pos_y=0.0, pos_z=0.0),
        GraphNode("g", "Rol", "role", pos_x=6.5, pos_y=0.0, pos_z=0.0),
    ]
    edges = [
        GraphEdge("s", "a", 1),
        GraphEdge("s", "b", 1),
        GraphEdge("a", "g", 1),
        GraphEdge("b", "g", 1),
    ]

    res_manhattan = search(nodes, edges, "s", "g", "gbfs", heuristic="manhattan")
    assert res_manhattan.heuristic_type == "manhattan"
    assert res_manhattan.heuristic_formula == "h(n) = |x1 - x2| + |y1 - y2|"
    # Para "a" (3.5, 4.0) -> "g" (6.5, 0.0): |3.5 - 6.5| + |4.0 - 0.0| = 3 + 4 = 7.0
    # Para "b" (0.5, 0.0) -> "g" (6.5, 0.0): |0.5 - 6.5| + |0.0 - 0.0| = 6.0
    assert res_manhattan.heuristic["a"] == 7.0
    assert res_manhattan.heuristic["b"] == 6.0
    assert res_manhattan.paths[0].nodes == ("s", "b", "g")

    res_euclidean = search(nodes, edges, "s", "g", "gbfs", heuristic="euclidiana")
    assert res_euclidean.heuristic_type == "euclidiana"
    assert res_euclidean.heuristic_formula == "h(n) = sqrt((x1 - x2)^2 + (y1 - y2)^2)"
    # Para "a": sqrt(3^2 + 4^2) = 5.0 < 6.0 de "b", por lo que GBFS Euclidiana prefiere "a"
    assert res_euclidean.heuristic["a"] == 5.0
    assert res_euclidean.heuristic["b"] == 6.0
    assert res_euclidean.paths[0].nodes == ("s", "a", "g")

    detail_a = next(item for item in res_euclidean.node_heuristics if item.node_id == "a")
    assert detail_a.dx == 3.0
    assert detail_a.dy == 4.0
    assert detail_a.manhattan == 7.0
    assert detail_a.euclidean == 5.0
    assert detail_a.altitude > 0


def test_hill_climbing_ascends_by_steepest_neighbor_and_builds_distributions():
    nodes = [
        GraphNode("s", "Perfil", "profile", pos_x=-6.0, pos_y=0.0),
        GraphNode("a", "Skill Cerca", "skill", 2, pos_x=2.0, pos_y=0.5),
        GraphNode("b", "Skill Lejos", "skill", 2, pos_x=-3.0, pos_y=4.0),
        GraphNode("p", "Proyecto", "project", 4, pos_x=4.5, pos_y=0.0),
        GraphNode("g", "Rol Objetivo", "role", pos_x=6.5, pos_y=0.0),
    ]
    edges = [
        GraphEdge("s", "a", 1),
        GraphEdge("s", "b", 1),
        GraphEdge("a", "p", 1),
        GraphEdge("b", "p", 1),
        GraphEdge("p", "g", 1),
    ]
    res = search(nodes, edges, "s", "g", "hill_climbing", heuristic="manhattan")
    assert res.algorithm == "hill_climbing"
    assert res.paths[0].nodes == ("s", "a", "p", "g")
    assert res.hill_climbing is not None
    assert res.hill_climbing["reached_global_optimum"] is True
    assert res.hill_climbing["steepest_gain"] > 0
    assert len(res.hill_climbing["steps"]) == 4
    assert res.hill_climbing["outcome_distribution"]
    assert res.hill_climbing["node_type_distribution"]
    assert res.hill_climbing["elevation_profile"]

    ga = search(nodes, edges, "s", "g", "genetico", heuristic="manhattan")
    assert ga.algorithm == "genetico"
    assert ga.genetic is not None
    assert len(ga.genetic["components"]) == 6
    assert ga.genetic["generations"]
    assert ga.genetic["crossover_events"]
    assert ga.genetic["mutation_events"]
    assert ga.genetic["best_individual"]["fitness"] > 0



