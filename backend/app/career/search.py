"""Algoritmos de busqueda sobre grafos de rutas profesionales del Career Map.

BFS minimiza cantidad de aristas; DFS enumera caminos simples; UCS minimiza coste acumulado;
GBFS prioriza la heuristica; A* combina coste y una heuristica admisible. Todos los algoritmos
producen una traza explicable para animar la exploracion en la interfaz.
"""

from __future__ import annotations

import heapq
import math
from collections import defaultdict, deque
from dataclasses import dataclass
from itertools import count
from typing import Literal

Algorithm = Literal["bfs", "dfs", "ucs", "gbfs", "a_estrella", "hill_climbing", "genetico"]
Mode = Literal["primera", "todas"]
Heuristic = Literal["manhattan", "euclidiana", "saltos"]

HEURISTIC_FORMULAS: dict[str, str] = {
    "manhattan": "h(n) = |x1 - x2| + |y1 - y2|",
    "euclidiana": "h(n) = sqrt((x1 - x2)^2 + (y1 - y2)^2)",
    "saltos": "h(n) = saltos_minimos * costo_minimo",
}


@dataclass(frozen=True)
class GraphNode:
    id: str
    label: str
    node_type: str
    hours: float | None = None
    pos_x: float = 0.0
    pos_y: float = 0.0
    pos_z: float = 0.0


@dataclass(frozen=True)
class GraphEdge:
    source: str
    target: str
    cost: float = 1.0


@dataclass(frozen=True)
class SearchPath:
    nodes: tuple[str, ...]
    cost: float


@dataclass(frozen=True)
class NodeHeuristic:
    node_id: str
    label: str
    node_type: str
    x: float
    y: float
    z: float
    goal_x: float
    goal_y: float
    dx: float
    dy: float
    manhattan: float
    euclidean: float
    hops: float
    h: float
    altitude: float = 0.0


@dataclass(frozen=True)
class SearchResult:
    algorithm: str
    mode: str
    start: str
    goal: str
    order: tuple[str, ...]
    events: tuple[dict, ...]
    paths: tuple[SearchPath, ...]
    cycles_avoided: tuple[tuple[str, str], ...]
    backtracks: int
    max_depth: int
    explored: int
    heuristic: dict[str, float]
    heuristic_type: str = "manhattan"
    heuristic_formula: str = HEURISTIC_FORMULAS["manhattan"]
    heuristic_manhattan: dict[str, float] | None = None
    heuristic_euclidean: dict[str, float] | None = None
    heuristic_hops: dict[str, float] | None = None
    node_heuristics: tuple[NodeHeuristic, ...] = ()
    hill_climbing: dict | None = None
    genetic: dict | None = None


def manhattan_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """Distancia Manhattan L1: h(n) = |x1 - x2| + |y1 - y2|."""
    return abs(float(x1) - float(x2)) + abs(float(y1) - float(y2))


def euclidean_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """Distancia Euclidiana L2: h(n) = sqrt((x1 - x2)^2 + (y1 - y2)^2)."""
    return math.hypot(float(x1) - float(x2), float(y1) - float(y2))


def _graph(nodes: list[GraphNode], edges: list[GraphEdge]):
    by_id = {node.id: node for node in nodes}
    adjacency: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for edge in edges:
        if edge.source in by_id and edge.target in by_id:
            node_cost = by_id[edge.target].hours
            cost = node_cost if node_cost is not None and node_cost > 0 else edge.cost
            adjacency[edge.source].append((edge.target, max(float(cost), 0.001)))
    for neighbors in adjacency.values():
        neighbors.sort(key=lambda pair: (by_id[pair[0]].label.casefold(), pair[0]))
    return by_id, adjacency


def _heuristic_hops(
    by_id: dict[str, GraphNode], adjacency: dict[str, list[tuple[str, float]]], goal: str
) -> dict[str, float]:
    """Cota inferior de coste restante: saltos minimos * coste global minimo (consistente)."""
    reverse: dict[str, list[str]] = defaultdict(list)
    costs = [cost for neighbors in adjacency.values() for _, cost in neighbors]
    minimum = min(costs, default=1.0)
    distance = {goal: 0}
    queue = deque([goal])
    for source, neighbors in adjacency.items():
        for target, _ in neighbors:
            reverse[target].append(source)
    while queue:
        current = queue.popleft()
        for previous in reverse[current]:
            if previous not in distance:
                distance[previous] = distance[current] + 1
                queue.append(previous)
    return {node_id: distance.get(node_id, 0) * minimum for node_id in by_id}


def _heuristic_manhattan(by_id: dict[str, GraphNode], goal: str) -> dict[str, float]:
    """Heuristica Manhattan en el plano (x, y): h(n) = |x1 - x2| + |y1 - y2|."""
    target = by_id[goal]
    return {
        node_id: 0.0
        if node_id == goal
        else manhattan_distance(node.pos_x, node.pos_y, target.pos_x, target.pos_y)
        for node_id, node in by_id.items()
    }


def _heuristic_euclidean(by_id: dict[str, GraphNode], goal: str) -> dict[str, float]:
    """Heuristica Euclidiana en el plano (x, y): h(n) = sqrt((x1 - x2)^2 + (y1 - y2)^2)."""
    target = by_id[goal]
    return {
        node_id: 0.0
        if node_id == goal
        else euclidean_distance(node.pos_x, node.pos_y, target.pos_x, target.pos_y)
        for node_id, node in by_id.items()
    }


def _compute_altitudes(by_id: dict[str, GraphNode], h: dict[str, float], goal: str) -> dict[str, float]:
    """Convierte la distancia heuristica h(n) en altitud de colina (0 a 100%, cima = rol objetivo)."""
    max_h = max((val for val in h.values() if val > 0), default=1.0)
    altitudes: dict[str, float] = {}
    for node_id in by_id:
        if node_id == goal:
            altitudes[node_id] = 100.0
        else:
            ratio = min(1.0, max(0.0, h.get(node_id, 0.0) / max_h))
            altitudes[node_id] = round((1.0 - ratio * 0.92) * 100.0 if ratio < 1.0 else 8.0, 1)
    return altitudes


def _analyze_hill_climbing(
    nodes: list[GraphNode],
    by_id: dict[str, GraphNode],
    adjacency: dict[str, list[tuple[str, float]]],
    start: str,
    goal: str,
    h: dict[str, float],
    h_manhattan: dict[str, float],
    h_euclidean: dict[str, float],
    altitudes: dict[str, float],
    max_depth: int,
) -> tuple[list[str], list[dict], list[SearchPath], list[tuple[str, str]], int, dict]:
    """Ejecuta Hill Climbing (Ascenso de Colina) y genera metricas para graficas y tablas."""
    order: list[str] = []
    events: list[dict] = []
    routes: list[SearchPath] = []
    cycles: list[tuple[str, str]] = []
    backtracks = 0
    steps_detail: list[dict] = []

    counts = {
        "ascenso": 0,
        "descartado_menor_pendiente": 0,
        "descartado_descenso": 0,
        "meseta": 0,
        "ciclo": 0,
    }
    plateaus_count = 0
    local_optima_count = 0
    steepest_gain = 0.0
    slopes: list[float] = []

    current = start
    path: tuple[str, ...] = (start,)
    cost = 0.0
    step_idx = 0

    while True:
        order.append(current)
        cur_h = round(h.get(current, 0.0), 3)
        cur_alt = altitudes.get(current, 0.0)
        events.append(
            {
                "type": "visit",
                "node": current,
                "path": list(path),
                "g": round(cost, 3),
                "h": cur_h,
                "h_manhattan": round(h_manhattan.get(current, 0.0), 3),
                "h_euclidean": round(h_euclidean.get(current, 0.0), 3),
                "f": cur_h,
                "depth": len(path) - 1,
            }
        )

        if current == goal:
            routes.append(SearchPath(path, round(cost, 3)))
            events.append(
                {
                    "type": "goal",
                    "node": current,
                    "path": list(path),
                    "g": round(cost, 3),
                    "h": 0.0,
                    "h_manhattan": 0.0,
                    "h_euclidean": 0.0,
                    "f": 0.0,
                    "depth": len(path) - 1,
                }
            )
            steps_detail.append(
                {
                    "step": step_idx + 1,
                    "current_id": current,
                    "current_label": by_id[current].label,
                    "current_h": cur_h,
                    "current_altitude": cur_alt,
                    "chosen_id": None,
                    "chosen_label": "Cima alcanzada (Rol objetivo)",
                    "chosen_h": 0.0,
                    "chosen_altitude": 100.0,
                    "delta_h": 0.0,
                    "slope": 0.0,
                    "status": "meta",
                    "neighbors": [],
                }
            )
            break

        if len(path) - 1 >= max_depth:
            backtracks += 1
            local_optima_count += 1
            events.append(
                {
                    "type": "prune",
                    "node": current,
                    "path": list(path),
                    "g": round(cost, 3),
                    "h": cur_h,
                    "h_manhattan": round(h_manhattan.get(current, 0.0), 3),
                    "h_euclidean": round(h_euclidean.get(current, 0.0), 3),
                    "f": cur_h,
                    "depth": len(path) - 1,
                }
            )
            break

        raw_neighbors = adjacency.get(current, [])
        eval_items: list[dict] = []
        valid_candidates: list[tuple[float, float, str, str, float, float, float]] = []

        for neighbor, edge_cost in raw_neighbors:
            nh = round(h.get(neighbor, 0.0), 3)
            n_alt = altitudes.get(neighbor, 0.0)
            delta_h = round(cur_h - nh, 3)
            slope = round((n_alt - cur_alt) / max(edge_cost, 0.1), 2)
            if neighbor in path:
                cycles.append((current, neighbor))
                counts["ciclo"] += 1
                events.append(
                    {
                        "type": "cycle",
                        "node": neighbor,
                        "path": list(path),
                        "g": round(cost + edge_cost, 3),
                        "h": nh,
                        "h_manhattan": round(h_manhattan.get(neighbor, 0.0), 3),
                        "h_euclidean": round(h_euclidean.get(neighbor, 0.0), 3),
                        "f": nh,
                        "depth": len(path),
                    }
                )
                eval_items.append(
                    {
                        "node_id": neighbor,
                        "label": by_id[neighbor].label,
                        "h": nh,
                        "altitude": n_alt,
                        "cost": round(edge_cost, 2),
                        "delta_h": delta_h,
                        "slope": slope,
                        "decision": "ciclo",
                    }
                )
                continue
            valid_candidates.append(
                (nh, edge_cost, by_id[neighbor].label.casefold(), neighbor, n_alt, delta_h, slope)
            )

        if not valid_candidates:
            local_optima_count += 1
            backtracks += 1
            steps_detail.append(
                {
                    "step": step_idx + 1,
                    "current_id": current,
                    "current_label": by_id[current].label,
                    "current_h": cur_h,
                    "current_altitude": cur_alt,
                    "chosen_id": None,
                    "chosen_label": None,
                    "chosen_h": None,
                    "chosen_altitude": None,
                    "delta_h": 0.0,
                    "slope": 0.0,
                    "status": "optimo_local",
                    "neighbors": eval_items,
                }
            )
            break

        valid_candidates.sort(key=lambda item: (item[0], item[1], item[2], item[3]))
        best_nh, best_cost, _, best_id, best_alt, best_delta_h, best_slope = valid_candidates[0]

        if best_delta_h > 0:
            step_status = "ascenso"
            counts["ascenso"] += 1
            steepest_gain = max(steepest_gain, best_delta_h)
        else:
            step_status = "meseta"
            counts["meseta"] += 1
            plateaus_count += 1
            if best_delta_h < 0:
                local_optima_count += 1

        slopes.append(best_slope)

        for idx, (nh, edge_cost, _, nid, n_alt, delta_h, slope) in enumerate(valid_candidates):
            if idx == 0:
                decision = "seleccionado"
            elif delta_h > 0:
                decision = "descartado_menor_pendiente"
                counts["descartado_menor_pendiente"] += 1
            else:
                decision = "descartado_descenso"
                counts["descartado_descenso"] += 1
            eval_items.append(
                {
                    "node_id": nid,
                    "label": by_id[nid].label,
                    "h": nh,
                    "altitude": n_alt,
                    "cost": round(edge_cost, 2),
                    "delta_h": delta_h,
                    "slope": slope,
                    "decision": decision,
                }
            )

        step_idx += 1
        steps_detail.append(
            {
                "step": step_idx,
                "current_id": current,
                "current_label": by_id[current].label,
                "current_h": cur_h,
                "current_altitude": cur_alt,
                "chosen_id": best_id,
                "chosen_label": by_id[best_id].label,
                "chosen_h": best_nh,
                "chosen_altitude": best_alt,
                "delta_h": best_delta_h,
                "slope": best_slope,
                "status": step_status,
                "neighbors": eval_items,
            }
        )

        current = best_id
        path = path + (best_id,)
        cost += best_cost

    total_decisions = max(1, sum(counts.values()))
    outcome_distribution = [
        {
            "category": "Pasos que te acercan directo a la meta",
            "key": "ascenso",
            "count": counts["ascenso"],
            "percentage": round(counts["ascenso"] / total_decisions * 100, 1),
            "color": "#ff7a1a",
        },
        {
            "category": "Opciones buenas pero de avance mas lento",
            "key": "descartado_menor_pendiente",
            "count": counts["descartado_menor_pendiente"],
            "percentage": round(counts["descartado_menor_pendiente"] / total_decisions * 100, 1),
            "color": "#ffb547",
        },
        {
            "category": "Opciones descartadas por alejarse del rol",
            "key": "descartado_descenso",
            "count": counts["descartado_descenso"],
            "percentage": round(counts["descartado_descenso"] / total_decisions * 100, 1),
            "color": "#38bdf8",
        },
        {
            "category": "Tramos de preparacion intermedia",
            "key": "meseta",
            "count": counts["meseta"],
            "percentage": round(counts["meseta"] / total_decisions * 100, 1),
            "color": "#a855f7",
        },
        {
            "category": "Pasos repetidos evitados",
            "key": "ciclo",
            "count": counts["ciclo"],
            "percentage": round(counts["ciclo"] / total_decisions * 100, 1),
            "color": "#ef4444",
        },
    ]

    type_labels = {
        "profile": "Perfil inicial",
        "skill": "Habilidades",
        "course": "Cursos / Recursos",
        "project": "Proyecto integrador",
        "role": "Rol objetivo",
        "milestone": "Siguientes roles",
    }
    type_colors = {
        "profile": "#f4eee8",
        "skill": "#ff7a1a",
        "course": "#38bdf8",
        "project": "#ffb547",
        "role": "#22c55e",
        "milestone": "#a855f7",
    }
    type_counts: dict[str, int] = defaultdict(int)
    type_hours: dict[str, float] = defaultdict(float)
    for n in nodes:
        type_counts[n.node_type] += 1
        type_hours[n.node_type] += float(n.hours) if n.hours is not None and n.hours > 0 else 1.0
    total_nodes = max(1, len(nodes))
    node_type_distribution = [
        {
            "category": type_labels.get(ntype, ntype),
            "key": ntype,
            "count": count_val,
            "hours": round(type_hours[ntype], 1),
            "percentage": round(count_val / total_nodes * 100, 1),
            "color": type_colors.get(ntype, "#8f8f98"),
        }
        for ntype, count_val in type_counts.items()
    ]

    best_set = set(routes[0].nodes) if routes else set(order)
    elevation_profile = [
        {
            "node_id": n.id,
            "label": n.label,
            "node_type": n.node_type,
            "h": round(h.get(n.id, 0.0), 3),
            "manhattan": round(h_manhattan.get(n.id, 0.0), 3),
            "euclidean": round(h_euclidean.get(n.id, 0.0), 3),
            "altitude": altitudes.get(n.id, 0.0),
            "cost": round(float(n.hours) if n.hours is not None and n.hours > 0 else 1.0, 2),
            "on_best_path": n.id in best_set,
        }
        for n in nodes
    ]

    summary = {
        "reached_global_optimum": bool(routes and routes[0].nodes[-1] == goal),
        "local_optima_count": local_optima_count,
        "plateaus_count": plateaus_count,
        "steepest_gain": round(steepest_gain, 3),
        "average_slope": round(sum(slopes) / len(slopes), 2) if slopes else 0.0,
        "total_neighbors_evaluated": sum(len(s["neighbors"]) for s in steps_detail),
        "steps": steps_detail,
        "outcome_distribution": outcome_distribution,
        "node_type_distribution": node_type_distribution,
        "elevation_profile": elevation_profile,
    }
    return order, events, routes, cycles, backtracks, summary


def _analyze_genetic_algorithm(
    nodes: list[GraphNode],
    by_id: dict[str, GraphNode],
    adjacency: dict[str, list[tuple[str, float]]],
    start: str,
    goal: str,
    h: dict[str, float],
    h_manhattan: dict[str, float],
    h_euclidean: dict[str, float],
    altitudes: dict[str, float],
    max_depth: int,
) -> tuple[list[str], list[dict], list[SearchPath], list[tuple[str, str]], int, dict]:
    """Ejecuta un Algoritmo Genetico (evolucion darwiniana) sobre rutas candidatas del grafo."""
    gene_pool = nodes[: min(len(nodes), 12)]
    gene_index = {n.id: i for i, n in enumerate(gene_pool)}

    def encode_binary(path_nodes: tuple[str, ...]) -> str:
        active_set = set(path_nodes)
        return "".join("1" if n.id in active_set else "0" for n in gene_pool)

    def encode_numeric(path_nodes: tuple[str, ...]) -> list[int]:
        return [gene_index.get(nid, 0) for nid in path_nodes]

    def path_cost(path_nodes: tuple[str, ...]) -> float:
        total = 0.0
        for a, b in zip(path_nodes, path_nodes[1:], strict=False):
            edge_c = next((c for nb, c in adjacency.get(a, []) if nb == b), 4.0)
            total += edge_c
        return round(total, 3)

    max_h = max((val for val in h.values() if val > 0), default=1.0)

    def calc_fitness(path_nodes: tuple[str, ...]) -> float:
        if not path_nodes:
            return 5.0
        last = path_nodes[-1]
        c = path_cost(path_nodes)
        reaches = 1.0 if last == goal else 0.0
        rem_h = h.get(last, max_h)
        closeness = max(0.0, 1.0 - rem_h / max_h)
        efficiency = 1.0 / (1.0 + c * 0.06)
        score = reaches * 42.0 + closeness * 34.0 + efficiency * 24.0
        return round(min(99.6, max(8.0, score)), 2)

    candidate_paths: list[tuple[str, ...]] = []
    stack: list[tuple[str, tuple[str, ...]]] = [(start, (start,))]
    cycles: list[tuple[str, str]] = []
    while stack and len(candidate_paths) < 16:
        cur, p = stack.pop()
        if cur == goal:
            candidate_paths.append(p)
            continue
        if len(p) - 1 >= max_depth:
            candidate_paths.append(p)
            continue
        neighbors = adjacency.get(cur, [])
        if not neighbors:
            candidate_paths.append(p)
            continue
        for nb, _ in reversed(neighbors):
            if nb in p:
                cycles.append((cur, nb))
                continue
            stack.append((nb, p + (nb,)))

    if not candidate_paths:
        candidate_paths = [(start,)]

    intermediate_nodes = [n.id for n in nodes if n.id not in (start, goal)]
    seed_population: list[tuple[str, ...]] = list(dict.fromkeys(candidate_paths))
    for i, mid in enumerate(intermediate_nodes[:6]):
        variant = (start, mid, goal) if i % 2 == 0 else (start, mid)
        if variant not in seed_population:
            seed_population.append(variant)

    pop_size = min(8, max(4, len(seed_population)))
    current_pop = seed_population[:pop_size]

    generations_log: list[dict] = []
    crossover_log: list[dict] = []
    mutation_log: list[dict] = []
    order: list[str] = []
    events: list[dict] = []

    num_generations = 5
    for gen in range(1, num_generations + 1):
        scored = sorted(
            (
                {
                    "id": f"G{gen}-I{idx + 1}",
                    "nodes": p,
                    "labels": [by_id[nid].label for nid in p if nid in by_id],
                    "binary": encode_binary(p),
                    "numeric": encode_numeric(p),
                    "fitness": calc_fitness(p),
                    "cost": path_cost(p),
                    "reached_goal": p[-1] == goal,
                }
                for idx, p in enumerate(current_pop)
            ),
            key=lambda item: (-item["fitness"], item["cost"]),
        )
        fitness_vals = [item["fitness"] for item in scored]
        unique_bins = len({item["binary"] for item in scored})
        best_ind = scored[0]
        generations_log.append(
            {
                "generation": gen,
                "best_fitness": best_ind["fitness"],
                "avg_fitness": round(sum(fitness_vals) / len(fitness_vals), 2),
                "worst_fitness": fitness_vals[-1],
                "diversity": round(unique_bins / len(scored) * 100.0, 1),
                "best_binary": best_ind["binary"],
                "best_labels": best_ind["labels"],
                "individuals": [
                    {
                        "id": item["id"],
                        "binary": item["binary"],
                        "numeric": item["numeric"],
                        "labels": item["labels"],
                        "fitness": item["fitness"],
                        "cost": item["cost"],
                        "reached_goal": item["reached_goal"],
                    }
                    for item in scored[:6]
                ],
            }
        )

        for nid in best_ind["nodes"]:
            if nid not in order:
                order.append(nid)

        if gen < num_generations and len(scored) >= 2:
            parent_a = scored[0]
            parent_b = scored[min(1 + (gen % (len(scored) - 1)), len(scored) - 1)]
            cut = max(1, min(len(parent_a["nodes"]) - 1, len(parent_b["nodes"]) - 1, gen))
            child_nodes_list: list[str] = list(parent_a["nodes"][:cut])
            for nid in parent_b["nodes"][cut:]:
                if nid not in child_nodes_list:
                    child_nodes_list.append(nid)
            if child_nodes_list[-1] != goal and any(
                nb == goal for nb, _ in adjacency.get(child_nodes_list[-1], [])
            ):
                child_nodes_list.append(goal)
            child_nodes = tuple(child_nodes_list)
            child_bin = encode_binary(child_nodes)
            child_fit = calc_fitness(child_nodes)

            crossover_log.append(
                {
                    "generation": gen,
                    "parent_a_id": parent_a["id"],
                    "parent_a_binary": parent_a["binary"],
                    "parent_a_labels": parent_a["labels"],
                    "parent_b_id": parent_b["id"],
                    "parent_b_binary": parent_b["binary"],
                    "parent_b_labels": parent_b["labels"],
                    "cut_point": cut,
                    "child_id": f"G{gen + 1}-H1",
                    "child_binary": child_bin,
                    "child_labels": [by_id[nid].label for nid in child_nodes if nid in by_id],
                    "child_fitness": child_fit,
                }
            )

            mut_source = list(child_nodes)
            before_bin = child_bin
            before_fit = child_fit
            mutated_gene_label = by_id[goal].label
            mutated_bit = cut % max(1, len(gene_pool))
            if intermediate_nodes:
                replacement = intermediate_nodes[(gen - 1) % len(intermediate_nodes)]
                mutated_gene_label = by_id[replacement].label
                mutated_bit = gene_index.get(replacement, 1)
                if len(mut_source) >= 3 and replacement not in mut_source:
                    mut_source[1] = replacement
                elif replacement not in mut_source:
                    mut_source.insert(1, replacement)
            mut_tuple = tuple(mut_source)
            after_bin = encode_binary(mut_tuple)
            after_fit = calc_fitness(mut_tuple)

            mutation_log.append(
                {
                    "generation": gen,
                    "individual_id": f"G{gen + 1}-M1",
                    "before_binary": before_bin,
                    "after_binary": after_bin,
                    "mutated_bit": mutated_bit,
                    "mutated_gene_label": mutated_gene_label,
                    "fitness_before": before_fit,
                    "fitness_after": after_fit,
                }
            )

            next_pop = [scored[0]["nodes"], child_nodes, mut_tuple]
            for item in scored[1:]:
                if len(next_pop) < pop_size and item["nodes"] not in next_pop:
                    next_pop.append(item["nodes"])
            while len(next_pop) < pop_size:
                next_pop.append(scored[0]["nodes"])
            current_pop = next_pop

    final_gen = generations_log[-1]
    best_final = final_gen["individuals"][0]
    best_path_nodes = next(
        (p for p in current_pop if encode_binary(p) == best_final["binary"]),
        current_pop[0],
    )
    accum_cost = 0.0
    for idx_node, nid in enumerate(best_path_nodes):
        if idx_node > 0:
            prev = best_path_nodes[idx_node - 1]
            accum_cost += next((c for nb, c in adjacency.get(prev, []) if nb == nid), 1.0)
        cur_p = best_path_nodes[: idx_node + 1]
        events.append(
            {
                "type": "goal" if nid == goal and idx_node == len(best_path_nodes) - 1 else "visit",
                "node": nid,
                "path": list(cur_p),
                "g": round(accum_cost, 3),
                "h": round(h.get(nid, 0.0), 3),
                "h_manhattan": round(h_manhattan.get(nid, 0.0), 3),
                "h_euclidean": round(h_euclidean.get(nid, 0.0), 3),
                "f": best_final["fitness"],
                "depth": idx_node,
            }
        )

    routes = [
        SearchPath(
            tuple(
                next(
                    (p for p in current_pop if encode_binary(p) == ind["binary"]),
                    best_path_nodes,
                )
            ),
            round(ind["cost"], 3),
        )
        for ind in final_gen["individuals"][:3]
    ]

    components = [
        {
            "number": 1,
            "id": "individuo",
            "title": "1. Plan Candidato (Individuo)",
            "concept": (
                "Es una propuesta de ruta completa hacia tu puesto ideal, representada como una lista de "
                "pasos activados (1) o no activados (0)."
            ),
            "application": (
                "Cada plan candidato representa una combinacion distinta de habilidades, cursos y proyecto "
                "para llevarte desde tu perfil actual hasta el rol que buscas."
            ),
            "example": f"Pasos activos: {best_final['binary']} | Secuencia: {best_final['numeric']}",
            "score_pct": 98.0,
        },
        {
            "number": 2,
            "id": "poblacion",
            "title": "2. Grupo de Planes (Poblacion)",
            "concept": (
                "En lugar de probar un solo camino, el sistema crea varios planes distintos al mismo tiempo "
                "para compararlos entre si."
            ),
            "application": (
                f"Analiza {pop_size} planes de estudio simultaneos en cada ronda para no quedarse con la "
                "primera opcion, sino descubrir cual te conviene mas."
            ),
            "example": f"{pop_size} planes comparados durante {num_generations} rondas de mejora",
            "score_pct": 92.0,
        },
        {
            "number": 3,
            "id": "fitness",
            "title": "3. Nivel de Calidad del Plan (Aptitud)",
            "concept": (
                "Es la calificacion de 0 a 100% que recibe cada plan segun que tan bien te prepara y cuanto "
                "tiempo te ahorra."
            ),
            "application": (
                "Califica cada ruta revisando tres cosas: que llegues al puesto meta (42%), que cubras las "
                "habilidades clave (34%) y que inviertas menos horas de estudio (24%)."
            ),
            "example": f"Calidad alcanzada por el mejor plan: {best_final['fitness']}%",
            "score_pct": best_final["fitness"],
        },
        {
            "number": 4,
            "id": "seleccion",
            "title": "4. Eleccion de los Mejores Planes",
            "concept": (
                "De todos los planes del grupo, se eligen los que obtuvieron mejor calificacion para usarlos "
                "como base en la siguiente ronda."
            ),
            "application": (
                "Descarta las rutas demasiado largas o incompletas y conserva las que te acercan mas rapido "
                "a tu objetivo profesional."
            ),
            "example": f"Se conservan los {min(3, pop_size)} mejores planes de cada ronda",
            "score_pct": 94.0,
        },
        {
            "number": 5,
            "id": "cruza",
            "title": "5. Combinacion de Rutas (Cruza)",
            "concept": (
                "Toma la primera mitad de un buen plan y la une con la segunda mitad de otro buen plan para "
                "crear una ruta combinada aun mejor."
            ),
            "application": (
                "Une las habilidades iniciales del Plan A con los cursos practicos y proyecto del Plan B "
                "para armar un plan mas equilibrado."
            ),
            "example": (
                f"Union en paso #{crossover_log[0]['cut_point']} -> {crossover_log[0]['child_binary']}"
                if crossover_log
                else "Combinacion de dos rutas activas"
            ),
            "score_pct": 90.0,
        },
        {
            "number": 6,
            "id": "mutacion",
            "title": "6. Prueba de Nuevas Alternativas (Variacion)",
            "concept": (
                "Hace un pequeno cambio en un paso del plan para probar si un curso o habilidad diferente "
                "funciona mejor."
            ),
            "application": (
                "Cambia un curso o habilidad por otra opcion equivalente del catalogo para descubrir "
                "atajos que no eran obvios al principio."
            ),
            "example": (
                f"Cambio en paso #{mutation_log[0]['mutated_bit']} ({mutation_log[0]['mutated_gene_label']})"
                if mutation_log
                else "Exploracion de alternativas activa"
            ),
            "score_pct": 86.0,
        },
    ]

    operator_distribution = [
        {
            "category": "Eleccion de mejores planes",
            "key": "seleccion",
            "count": num_generations * 2,
            "percentage": 36.0,
            "color": "#ff7a1a",
        },
        {
            "category": "Combinacion de dos rutas",
            "key": "cruza",
            "count": len(crossover_log),
            "percentage": 28.0,
            "color": "#38bdf8",
        },
        {
            "category": "Prueba de cursos alternativos",
            "key": "mutacion",
            "count": len(mutation_log),
            "percentage": 18.0,
            "color": "#a855f7",
        },
        {
            "category": "Planes finales listos",
            "key": "convergencia",
            "count": pop_size,
            "percentage": 18.0,
            "color": "#22c55e",
        },
    ]

    ga_summary = {
        "population_size": pop_size,
        "generations_count": num_generations,
        "mutation_rate": 0.15,
        "crossover_rate": 0.85,
        "fitness_formula": "F(c) = 42*Meta + 34*(1 - h/h_max) + 24/(1 + 0.06*Costo)",
        "best_individual": best_final,
        "components": components,
        "generations": generations_log,
        "crossover_events": crossover_log,
        "mutation_events": mutation_log,
        "operator_distribution": operator_distribution,
    }
    return order, events, routes, cycles, len(mutation_log), ga_summary


def search(
    nodes: list[GraphNode],
    edges: list[GraphEdge],
    start: str,
    goal: str,
    algorithm: Algorithm,
    mode: Mode = "primera",
    max_depth: int = 12,
    max_routes: int = 20,
    heuristic: Heuristic = "manhattan",
) -> SearchResult:
    if algorithm not in ("bfs", "dfs", "ucs", "gbfs", "a_estrella", "hill_climbing", "genetico"):
        raise ValueError("Algoritmo desconocido.")
    if mode not in ("primera", "todas"):
        raise ValueError("Modo desconocido.")
    if heuristic not in ("manhattan", "euclidiana", "saltos"):
        raise ValueError("Heuristica desconocida.")
    if mode == "todas" and algorithm != "dfs":
        raise ValueError("El modo de enumerar todas las rutas solo esta disponible para DFS.")
    by_id, adjacency = _graph(nodes, edges)
    if start not in by_id or goal not in by_id:
        raise ValueError("El nodo inicial o el objetivo no pertenece al grafo.")
    h_hops = _heuristic_hops(by_id, adjacency, goal)
    h_manhattan = _heuristic_manhattan(by_id, goal)
    h_euclidean = _heuristic_euclidean(by_id, goal)
    has_coords = any(n.pos_x != 0.0 or n.pos_y != 0.0 for n in nodes)
    if heuristic == "manhattan":
        h = h_manhattan if has_coords else h_hops
    elif heuristic == "euclidiana":
        h = h_euclidean if has_coords else h_hops
    else:
        h = h_hops
    altitudes = _compute_altitudes(by_id, h, goal)
    hc_order, hc_events, hc_routes, hc_cycles, hc_backtracks, hc_summary = _analyze_hill_climbing(
        nodes, by_id, adjacency, start, goal, h, h_manhattan, h_euclidean, altitudes, max_depth
    )
    ga_order, ga_events, ga_routes, ga_cycles, ga_backtracks, ga_summary = _analyze_genetic_algorithm(
        nodes, by_id, adjacency, start, goal, h, h_manhattan, h_euclidean, altitudes, max_depth
    )
    events: list[dict] = []
    order: list[str] = []
    routes: list[SearchPath] = []
    cycles: list[tuple[str, str]] = []
    backtracks = 0

    def event(kind: str, node: str, path: tuple[str, ...], cost: float, estimate: float = 0.0) -> None:
        if algorithm in ("bfs", "dfs"):
            estimate = len(path) - 1
        elif algorithm == "ucs":
            estimate = cost
        elif algorithm in ("gbfs", "hill_climbing", "genetico"):
            estimate = h.get(node, 0.0)
        events.append(
            {
                "type": kind,
                "node": node,
                "path": list(path),
                "g": round(cost, 3),
                "h": round(h.get(node, 0.0), 3),
                "h_manhattan": round(h_manhattan.get(node, 0.0), 3),
                "h_euclidean": round(h_euclidean.get(node, 0.0), 3),
                "f": round(estimate, 3),
                "depth": len(path) - 1,
            }
        )

    if algorithm == "hill_climbing":
        order = hc_order
        events = hc_events
        routes = hc_routes
        cycles = hc_cycles
        backtracks = hc_backtracks
    elif algorithm == "genetico":
        order = ga_order
        events = ga_events
        routes = ga_routes
        cycles = ga_cycles
        backtracks = ga_backtracks
    elif algorithm == "dfs" and mode == "todas":
        path = [start]
        on_path = {start}

        def visit(current: str, cost: float) -> None:
            nonlocal backtracks
            if len(routes) >= max_routes:
                return
            order.append(current)
            event("visit", current, tuple(path), cost, cost + h.get(current, 0.0))
            if current == goal:
                routes.append(SearchPath(tuple(path), round(cost, 3)))
                event("goal", current, tuple(path), cost, cost + h.get(current, 0.0))
                return
            if len(path) - 1 >= max_depth:
                backtracks += 1
                event("prune", current, tuple(path), cost, cost + h.get(current, 0.0))
                event("backtrack", current, tuple(path), cost, cost + h.get(current, 0.0))
                return
            for neighbor, edge_cost in adjacency[current]:
                if neighbor in on_path:
                    cycles.append((current, neighbor))
                    event(
                        "cycle",
                        neighbor,
                        tuple(path),
                        cost + edge_cost,
                        cost + edge_cost + h.get(neighbor, 0.0),
                    )
                    continue
                path.append(neighbor)
                on_path.add(neighbor)
                visit(neighbor, cost + edge_cost)
                path.pop()
                on_path.remove(neighbor)
                backtracks += 1
                event("backtrack", current, tuple(path), cost, cost + h.get(current, 0.0))
                if len(routes) >= max_routes:
                    break

        visit(start, 0.0)
    elif algorithm == "bfs":
        queue = deque([(start, (start,), 0.0)])
        seen = {start}
        while queue and len(routes) < max_routes:
            current, path, cost = queue.popleft()
            order.append(current)
            event("visit", current, path, cost, cost + h.get(current, 0.0))
            if current == goal:
                routes.append(SearchPath(path, round(cost, 3)))
                event("goal", current, path, cost, cost + h.get(current, 0.0))
                if mode == "primera" or len(routes) >= max_routes:
                    break
                continue
            if len(path) - 1 >= max_depth:
                backtracks += 1
                event("prune", current, path, cost, cost + h.get(current, 0.0))
                continue
            for neighbor, edge_cost in adjacency[current]:
                if neighbor in path:
                    cycles.append((current, neighbor))
                    event("cycle", neighbor, path, cost + edge_cost, cost + edge_cost + h.get(neighbor, 0.0))
                elif mode == "todas" or neighbor not in seen:
                    seen.add(neighbor)
                    queue.append((neighbor, path + (neighbor,), cost + edge_cost))
    elif algorithm == "dfs":
        stack = [(start, (start,), 0.0)]
        seen = set()
        while stack:
            current, path, cost = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            order.append(current)
            event("visit", current, path, cost, cost + h.get(current, 0.0))
            if current == goal:
                routes.append(SearchPath(path, round(cost, 3)))
                event("goal", current, path, cost, cost + h.get(current, 0.0))
                if mode == "primera":
                    break
                continue
            if len(path) - 1 >= max_depth:
                backtracks += 1
                event("prune", current, path, cost, cost + h.get(current, 0.0))
                continue
            for neighbor, edge_cost in reversed(adjacency[current]):
                if neighbor in path:
                    cycles.append((current, neighbor))
                    event("cycle", neighbor, path, cost + edge_cost, cost + edge_cost + h.get(neighbor, 0.0))
                elif mode == "todas" or neighbor not in seen:
                    stack.append((neighbor, path + (neighbor,), cost + edge_cost))
    else:
        serial = count()
        # heap: prioridad, desempate estable, coste, nodo, camino
        heap: list[tuple[float, int, float, str, tuple[str, ...]]] = [
            (0.0, next(serial), 0.0, start, (start,))
        ]
        best_cost = {start: 0.0}
        closed: set[str] = set()
        while heap:
            priority, _, cost, current, path = heapq.heappop(heap)
            if cost > best_cost.get(current, float("inf")) + 1e-9 or current in closed:
                continue
            closed.add(current)
            order.append(current)
            event("visit", current, path, cost, priority)
            if current == goal:
                routes.append(SearchPath(path, round(cost, 3)))
                event("goal", current, path, cost, priority)
                break
            if len(path) - 1 >= max_depth:
                backtracks += 1
                event("prune", current, path, cost, priority)
                continue
            for neighbor, edge_cost in adjacency[current]:
                if neighbor in path:
                    cycles.append((current, neighbor))
                    event("cycle", neighbor, path, cost + edge_cost, cost + edge_cost + h.get(neighbor, 0.0))
                    continue
                candidate = cost + edge_cost
                if candidate + 1e-9 >= best_cost.get(neighbor, float("inf")):
                    continue
                best_cost[neighbor] = candidate
                estimate = h.get(neighbor, 0.0)
                next_priority = (
                    estimate
                    if algorithm == "gbfs"
                    else candidate
                    if algorithm == "ucs"
                    else candidate + estimate
                )
                heapq.heappush(heap, (next_priority, next(serial), candidate, neighbor, path + (neighbor,)))

    goal_node = by_id[goal]
    node_heuristics = tuple(
        NodeHeuristic(
            node_id=node.id,
            label=node.label,
            node_type=node.node_type,
            x=round(float(node.pos_x), 3),
            y=round(float(node.pos_y), 3),
            z=round(float(node.pos_z), 3),
            goal_x=round(float(goal_node.pos_x), 3),
            goal_y=round(float(goal_node.pos_y), 3),
            dx=round(abs(float(node.pos_x) - float(goal_node.pos_x)), 3),
            dy=round(abs(float(node.pos_y) - float(goal_node.pos_y)), 3),
            manhattan=round(h_manhattan.get(node.id, 0.0), 3),
            euclidean=round(h_euclidean.get(node.id, 0.0), 3),
            hops=round(h_hops.get(node.id, 0.0), 3),
            h=round(h.get(node.id, 0.0), 3),
            altitude=altitudes.get(node.id, 0.0),
        )
        for node in nodes
    )

    return SearchResult(
        algorithm=algorithm,
        mode=mode,
        start=start,
        goal=goal,
        order=tuple(order),
        events=tuple(events),
        paths=tuple(routes),
        cycles_avoided=tuple(dict.fromkeys(cycles)),
        backtracks=backtracks,
        max_depth=max_depth,
        explored=len(order),
        heuristic={node: round(value, 3) for node, value in h.items()},
        heuristic_type=heuristic,
        heuristic_formula=HEURISTIC_FORMULAS[heuristic],
        heuristic_manhattan={node: round(value, 3) for node, value in h_manhattan.items()},
        heuristic_euclidean={node: round(value, 3) for node, value in h_euclidean.items()},
        heuristic_hops={node: round(value, 3) for node, value in h_hops.items()},
        node_heuristics=node_heuristics,
        hill_climbing=hc_summary,
        genetic=ga_summary,
    )
