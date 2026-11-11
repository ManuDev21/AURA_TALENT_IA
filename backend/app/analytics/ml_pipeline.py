"""Pipeline de Ciencia de Datos, Calidad Tabular, Reglas Fijas y Arbol de Decision CART.

Adapta la logica completa de las Practicas 01, 02 y 03 al dominio de AURA Talent AI:
- Practica 01 (Parte A y B): Busqueda en anchura (BFS) en mapa de competencias vs
  Regla Fija Manual sobre horas de dedicacion semanal.
- Practica 02 (Partes A, B, C, D y E): Creacion tabular, exploracion estadistica
  (head, tail, shape, dtypes, describe, mean), deteccion de errores de calidad
  (valores faltantes, duplicados exactos, porcentajes fuera de rango 0-100),
  separacion auditable en registros validos vs registros en revision (CSV),
  y preparacion de variables de entrada X y variable objetivo y.
- Practica 03: Division estratificada entrenamiento/prueba (70% / 30%, semilla 42),
  comparacion entre Sistema de Reglas Fijas y Arbol de Decisiones (max_depth=3),
  exactitud (accuracy_score), precision, recall, F1-score, soporte, matriz de
  confusion 2x2 [[VN, FP], [FN, VP]] y prediccion explicable para un caso nuevo.

IMPORTANTE: Este motor es exclusivamente formativo, analitico y de apoyo humano.
Nunca toma decisiones automaticas de contratacion ni de rechazo.
"""

from __future__ import annotations

import csv
import io
import math
import random
from collections import deque
from typing import Any

MODEL_VERSION = "ml-talent-cart-v1"

# ============================================================================
# PRACTICA 01 - PARTE A: BUSQUEDA EN ANCHURA (BFS) EN GRAFO DE COMPETENCIAS
# ============================================================================

DEFAULT_TALENT_GRAPH: dict[str, list[str]] = {
    "Perfil Inicial": ["Fundamentos Tecnicos", "Taller de Proyectos"],
    "Fundamentos Tecnicos": ["Portafolio Verificado"],
    "Taller de Proyectos": ["Simulacion de Entrevista STAR", "Portafolio Verificado"],
    "Simulacion de Entrevista STAR": ["Portafolio Verificado"],
    "Portafolio Verificado": ["Rol Objetivo Alcanzado"],
    "Rol Objetivo Alcanzado": [],
}


def bfs_find_route(
    graph: dict[str, list[str]] | None = None,
    start: str = "Perfil Inicial",
    goal: str = "Rol Objetivo Alcanzado",
) -> dict[str, Any]:
    """Encuentra la ruta con menor numero de conexiones usando una cola FIFO."""
    mapa = graph if graph is not None else DEFAULT_TALENT_GRAPH
    if start not in mapa or goal not in mapa:
        return {
            "start": start,
            "goal": goal,
            "route": None,
            "connections": 0,
            "visited_order": [],
            "steps_log": [],
        }

    cola: deque[list[str]] = deque([[start]])
    visitados: set[str] = {start}
    orden_visitados: list[str] = [start]
    steps_log: list[dict[str, Any]] = []

    while cola:
        ruta = cola.popleft()
        nodo_actual = ruta[-1]
        steps_log.append(
            {
                "current_node": nodo_actual,
                "current_path": list(ruta),
                "queue_size": len(cola),
                "visited_count": len(visitados),
            }
        )
        if nodo_actual == goal:
            return {
                "start": start,
                "goal": goal,
                "route": ruta,
                "connections": max(0, len(ruta) - 1),
                "visited_order": orden_visitados,
                "steps_log": steps_log,
            }

        for vecino in mapa.get(nodo_actual, []):
            if vecino not in visitados:
                visitados.add(vecino)
                orden_visitados.append(vecino)
                nueva_ruta = ruta + [vecino]
                cola.append(nueva_ruta)

    return {
        "start": start,
        "goal": goal,
        "route": None,
        "connections": 0,
        "visited_order": orden_visitados,
        "steps_log": steps_log,
    }


# ============================================================================
# PRACTICA 01 - PARTE B: REGLA FIJA SIMPLE SOBRE HORAS DE PREPARACION
# ============================================================================


def predict_single_fixed_rule(horas_estudio: float, threshold: float = 6.0) -> str:
    """Regla manual simple: si dedica al menos `threshold` horas semanales."""
    if horas_estudio >= threshold:
        return "Preparacion solida (Probablemente avanza)"
    return "Necesita reforzar dedicacion"


# ============================================================================
# PRACTICA 02 - CONJUNTOS DE DATOS, EXPLORACION, CALIDAD Y LIMPIEZA
# ============================================================================

# Conjunto limpio de 8 perfiles base (equivalente a estudiantes.csv de Practica 2A/2B/2E)
CLEAN_DATASET_8: list[dict[str, Any]] = [
    {
        "candidato": "Ana",
        "horas_estudio": 8.0,
        "asistencia": 95.0,
        "actividades_entregadas": 100.0,
        "calificacion": 92.0,
    },
    {
        "candidato": "Luis",
        "horas_estudio": 3.0,
        "asistencia": 60.0,
        "actividades_entregadas": 50.0,
        "calificacion": 58.0,
    },
    {
        "candidato": "Maria",
        "horas_estudio": 10.0,
        "asistencia": 98.0,
        "actividades_entregadas": 100.0,
        "calificacion": 96.0,
    },
    {
        "candidato": "Carlos",
        "horas_estudio": 5.0,
        "asistencia": 75.0,
        "actividades_entregadas": 80.0,
        "calificacion": 72.0,
    },
    {
        "candidato": "Sofia",
        "horas_estudio": 6.0,
        "asistencia": 85.0,
        "actividades_entregadas": 90.0,
        "calificacion": 81.0,
    },
    {
        "candidato": "Pedro",
        "horas_estudio": 2.0,
        "asistencia": 55.0,
        "actividades_entregadas": 40.0,
        "calificacion": 50.0,
    },
    {
        "candidato": "Elena",
        "horas_estudio": 7.0,
        "asistencia": 90.0,
        "actividades_entregadas": 95.0,
        "calificacion": 88.0,
    },
    {
        "candidato": "Jorge",
        "horas_estudio": 4.0,
        "asistencia": 70.0,
        "actividades_entregadas": 65.0,
        "calificacion": 64.0,
    },
]

# Conjunto con anomalias deliberadas (equivalente a datos_prueba de Practica 2C/2D)
DIRTY_DATASET_SAMPLE: list[dict[str, Any]] = [
    {
        "candidato": "Ana",
        "horas_estudio": 8.0,
        "asistencia": 95.0,
        "actividades_entregadas": 100.0,
        "calificacion": 92.0,
    },
    {
        "candidato": "Luis",
        "horas_estudio": 3.0,
        "asistencia": 60.0,
        "actividades_entregadas": 50.0,
        "calificacion": 58.0,
    },
    {
        "candidato": "Maria",
        "horas_estudio": None,
        "asistencia": 98.0,
        "actividades_entregadas": 100.0,
        "calificacion": 96.0,
    },
    {
        "candidato": "Luis",
        "horas_estudio": 3.0,
        "asistencia": 60.0,
        "actividades_entregadas": 50.0,
        "calificacion": 58.0,
    },
    {
        "candidato": "Carlos",
        "horas_estudio": 5.0,
        "asistencia": 110.0,
        "actividades_entregadas": 80.0,
        "calificacion": None,
    },
]


def _percentile(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return float(sorted_vals[0])
    pos = (len(sorted_vals) - 1) * q
    lower = int(math.floor(pos))
    upper = int(math.ceil(pos))
    if lower == upper:
        return float(sorted_vals[lower])
    weight = pos - lower
    return float(sorted_vals[lower] * (1.0 - weight) + sorted_vals[upper] * weight)


def describe_numeric_column(values: list[float]) -> dict[str, float]:
    """Calcula count, mean, std, min, 25%, 50%, 75% y max (como df.describe())."""
    if not values:
        return {
            "count": 0.0,
            "mean": 0.0,
            "std": 0.0,
            "min": 0.0,
            "p25": 0.0,
            "p50": 0.0,
            "p75": 0.0,
            "max": 0.0,
        }
    n = len(values)
    mean_val = sum(values) / n
    if n > 1:
        variance = sum((v - mean_val) ** 2 for v in values) / (n - 1)
        std_val = math.sqrt(variance)
    else:
        std_val = 0.0
    s = sorted(values)
    return {
        "count": float(n),
        "mean": round(mean_val, 2),
        "std": round(std_val, 2),
        "min": round(s[0], 2),
        "p25": round(_percentile(s, 0.25), 2),
        "p50": round(_percentile(s, 0.50), 2),
        "p75": round(_percentile(s, 0.75), 2),
        "max": round(s[-1], 2),
    }


def _rows_to_csv(rows: list[dict[str, Any]], fieldnames: list[str]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for r in rows:
        writer.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in fieldnames})
    return buf.getvalue()


def explore_and_clean_datasets(
    clean_rows: list[dict[str, Any]] | None = None,
    dirty_rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Ejecuta las Practicas 2A, 2B, 2C, 2D y 2E sobre datos de talento."""
    base = clean_rows if clean_rows is not None else CLEAN_DATASET_8
    dirty = dirty_rows if dirty_rows is not None else DIRTY_DATASET_SAMPLE

    cols = [
        "candidato",
        "horas_estudio",
        "asistencia",
        "actividades_entregadas",
        "calificacion",
    ]
    numeric_cols = [
        "horas_estudio",
        "asistencia",
        "actividades_entregadas",
        "calificacion",
    ]

    # Practica 2A y 2B: Dimensiones, head, tail, tipos, estadisticas descriptivas
    shape = [len(base), len(cols)]
    head_rows = base[:5]
    tail_rows = base[-5:]
    dtypes = {
        "candidato": "object (texto)",
        "horas_estudio": "float64 (numerico)",
        "asistencia": "float64 (porcentaje 0-100)",
        "actividades_entregadas": "float64 (porcentaje 0-100)",
        "calificacion": "float64 (puntaje 0-100)",
    }

    describe_table: dict[str, dict[str, float]] = {}
    for col in numeric_cols:
        vals = [float(r[col]) for r in base if r.get(col) is not None]
        describe_table[col] = describe_numeric_column(vals)

    mean_score = describe_table["calificacion"]["mean"]

    # Practica 2C: Deteccion de errores en datos sucios
    missing_by_col: dict[str, int] = {c: 0 for c in cols}
    incomplete_rows_count = 0
    duplicate_rows: list[dict[str, Any]] = []
    out_of_range_rows: list[dict[str, Any]] = []

    seen_signatures: set[tuple[Any, ...]] = set()
    deduped_rows: list[dict[str, Any]] = []

    for idx, row in enumerate(dirty):
        row_has_null = False
        for c in cols:
            if row.get(c) is None:
                missing_by_col[c] += 1
                row_has_null = True
        if row_has_null:
            incomplete_rows_count += 1

        sig = tuple(row.get(c) for c in cols)
        if sig in seen_signatures:
            duplicate_rows.append({"row_index": idx, **row, "motivo": "Fila duplicada exacta"})
        else:
            seen_signatures.add(sig)
            deduped_rows.append(dict(row))

        asist = row.get("asistencia")
        calif = row.get("calificacion")
        horas = row.get("horas_estudio")
        range_issues: list[str] = []
        if asist is not None and (float(asist) < 0.0 or float(asist) > 100.0):
            range_issues.append(f"Asistencia fuera de rango 0-100 ({asist}%)")
        if calif is not None and (float(calif) < 0.0 or float(calif) > 100.0):
            range_issues.append(f"Calificacion fuera de rango 0-100 ({calif})")
        if horas is not None and float(horas) < 0.0:
            range_issues.append(f"Horas negativas ({horas})")
        if range_issues:
            out_of_range_rows.append(
                {"row_index": idx, **row, "motivo": "; ".join(range_issues)}
            )

    # Practica 2D: Separar registros validos vs registros que requieren revision
    valid_records: list[dict[str, Any]] = []
    review_records: list[dict[str, Any]] = []

    for row in deduped_rows:
        reasons: list[str] = []
        for c in cols:
            if row.get(c) is None:
                reasons.append(f"Valor faltante en {c}")
        asist = row.get("asistencia")
        calif = row.get("calificacion")
        horas = row.get("horas_estudio")
        if asist is not None and not (0.0 <= float(asist) <= 100.0):
            reasons.append(f"Asistencia fuera de rango (0-100): {asist}")
        if calif is not None and not (0.0 <= float(calif) <= 100.0):
            reasons.append(f"Calificacion fuera de rango (0-100): {calif}")
        if horas is not None and float(horas) < 0.0:
            reasons.append(f"Horas invalidas (< 0): {horas}")

        if not reasons:
            valid_records.append(row)
        else:
            review_records.append({**row, "motivo_revision": " | ".join(reasons)})

    # Practica 2E: Variables de entrada X y variable objetivo y
    x_columns = ["horas_estudio", "asistencia", "actividades_entregadas"]
    y_column = "calificacion"
    x_preview = [{k: r[k] for k in x_columns} for r in base[:5]]
    y_preview = [r[y_column] for r in base[:5]]

    return {
        "shape": shape,
        "columns": cols,
        "dtypes": dtypes,
        "head": head_rows,
        "tail": tail_rows,
        "describe": describe_table,
        "mean_score": mean_score,
        "caution_note": (
            "Las estadisticas permiten conocer la estructura de los datos, pero no "
            "demuestran por si mismas que una variable cause otra (correlacion no "
            "implica causalidad)."
        ),
        "quality_audit": {
            "dirty_total_rows": len(dirty),
            "missing_by_column": missing_by_col,
            "incomplete_rows_count": incomplete_rows_count,
            "duplicate_rows": duplicate_rows,
            "out_of_range_rows": out_of_range_rows,
            "valid_records": valid_records,
            "review_records": review_records,
            "valid_csv": _rows_to_csv(valid_records, cols),
            "review_csv": _rows_to_csv(
                review_records, cols + ["motivo_revision"]
            ),
        },
        "variables_xy": {
            "x_columns": x_columns,
            "y_column": y_column,
            "x_shape": [len(base), len(x_columns)],
            "y_shape": [len(base)],
            "aligned": len(base) == len(y_preview) + (len(base) - len(y_preview)),
            "x_preview": x_preview,
            "y_preview": y_preview,
        },
    }


# ============================================================================
# PRACTICA 03: REGLAS FIJAS VS ARBOL DE DECISIONES (MACHINE LEARNING)
# ============================================================================

# Los 30 registros exactos de la Practica 03 adaptados a candidatos/estudiantes
PRACTICE_03_DATASET: list[dict[str, Any]] = [
    {"id": 1, "horas_estudio": 1, "asistencia": 40, "actividades_entregadas": 30, "aprueba": 0},
    {"id": 2, "horas_estudio": 2, "asistencia": 50, "actividades_entregadas": 40, "aprueba": 0},
    {"id": 3, "horas_estudio": 3, "asistencia": 55, "actividades_entregadas": 45, "aprueba": 0},
    {"id": 4, "horas_estudio": 4, "asistencia": 60, "actividades_entregadas": 55, "aprueba": 0},
    {"id": 5, "horas_estudio": 5, "asistencia": 65, "actividades_entregadas": 60, "aprueba": 1},
    {"id": 6, "horas_estudio": 6, "asistencia": 70, "actividades_entregadas": 65, "aprueba": 1},
    {"id": 7, "horas_estudio": 7, "asistencia": 75, "actividades_entregadas": 70, "aprueba": 1},
    {"id": 8, "horas_estudio": 8, "asistencia": 80, "actividades_entregadas": 80, "aprueba": 1},
    {"id": 9, "horas_estudio": 9, "asistencia": 85, "actividades_entregadas": 90, "aprueba": 1},
    {"id": 10, "horas_estudio": 10, "asistencia": 90, "actividades_entregadas": 95, "aprueba": 1},
    {"id": 11, "horas_estudio": 1, "asistencia": 45, "actividades_entregadas": 20, "aprueba": 0},
    {"id": 12, "horas_estudio": 2, "asistencia": 55, "actividades_entregadas": 35, "aprueba": 0},
    {"id": 13, "horas_estudio": 3, "asistencia": 60, "actividades_entregadas": 50, "aprueba": 0},
    {"id": 14, "horas_estudio": 4, "asistencia": 65, "actividades_entregadas": 60, "aprueba": 1},
    {"id": 15, "horas_estudio": 5, "asistencia": 70, "actividades_entregadas": 65, "aprueba": 1},
    {"id": 16, "horas_estudio": 6, "asistencia": 75, "actividades_entregadas": 70, "aprueba": 1},
    {"id": 17, "horas_estudio": 7, "asistencia": 80, "actividades_entregadas": 75, "aprueba": 1},
    {"id": 18, "horas_estudio": 8, "asistencia": 85, "actividades_entregadas": 85, "aprueba": 1},
    {"id": 19, "horas_estudio": 9, "asistencia": 90, "actividades_entregadas": 95, "aprueba": 1},
    {"id": 20, "horas_estudio": 10, "asistencia": 95, "actividades_entregadas": 100, "aprueba": 1},
    {"id": 21, "horas_estudio": 2, "asistencia": 50, "actividades_entregadas": 40, "aprueba": 0},
    {"id": 22, "horas_estudio": 4, "asistencia": 60, "actividades_entregadas": 55, "aprueba": 0},
    {"id": 23, "horas_estudio": 6, "asistencia": 70, "actividades_entregadas": 75, "aprueba": 1},
    {"id": 24, "horas_estudio": 8, "asistencia": 80, "actividades_entregadas": 85, "aprueba": 1},
    {"id": 25, "horas_estudio": 10, "asistencia": 95, "actividades_entregadas": 100, "aprueba": 1},
    {"id": 26, "horas_estudio": 3, "asistencia": 55, "actividades_entregadas": 45, "aprueba": 0},
    {"id": 27, "horas_estudio": 5, "asistencia": 75, "actividades_entregadas": 70, "aprueba": 1},
    {"id": 28, "horas_estudio": 7, "asistencia": 85, "actividades_entregadas": 80, "aprueba": 1},
    {"id": 29, "horas_estudio": 9, "asistencia": 90, "actividades_entregadas": 90, "aprueba": 1},
    {"id": 30, "horas_estudio": 6, "asistencia": 68, "actividades_entregadas": 60, "aprueba": 0},
]

FEATURE_NAMES = ["horas_estudio", "asistencia", "actividades_entregadas"]


def predict_with_fixed_rules(
    record: dict[str, Any],
    min_horas: float = 5.0,
    min_asistencia: float = 70.0,
    min_actividades: float = 65.0,
) -> int:
    """Regla fija manual de la Practica 03: exige cumplir las 3 condiciones a la vez."""
    if (
        float(record["horas_estudio"]) >= min_horas
        and float(record["asistencia"]) >= min_asistencia
        and float(record["actividades_entregadas"]) >= min_actividades
    ):
        return 1
    return 0


def _gini_impurity(labels: list[int]) -> float:
    n = len(labels)
    if n == 0:
        return 0.0
    ones = sum(1 for y in labels if y == 1)
    p1 = ones / n
    p0 = 1.0 - p1
    return 1.0 - (p0 * p0 + p1 * p1)


def _build_cart_tree(
    rows: list[dict[str, Any]],
    depth: int = 0,
    max_depth: int = 3,
    features: list[str] | None = None,
    min_samples_leaf: int = 1,
    candidate_thresholds_limit: int = 18,
    rng: random.Random | None = None,
    max_features: int | None = None,
) -> dict[str, Any]:
    """Construye un Arbol de Decision CART binario usando impureza Gini."""
    labels = [int(r["aprueba"]) for r in rows]
    n = len(labels)
    ones = sum(1 for y in labels if y == 1)
    zeros = n - ones
    majority_class = 1 if ones >= zeros else 0
    current_gini = round(_gini_impurity(labels), 4)

    if depth >= max_depth or ones == 0 or zeros == 0 or n < max(2, min_samples_leaf * 2):
        return {
            "is_leaf": True,
            "depth": depth,
            "prediction": majority_class,
            "samples": n,
            "class_counts": [zeros, ones],
            "gini": current_gini,
        }

    all_feats = features if features is not None else FEATURE_NAMES
    if max_features is not None and rng is not None and max_features < len(all_feats):
        feats_to_try = rng.sample(all_feats, max_features)
    else:
        feats_to_try = all_feats

    best_gain = 0.0
    best_feature: str | None = None
    best_threshold: float | None = None
    best_left: list[dict[str, Any]] = []
    best_right: list[dict[str, Any]] = []

    for feat in feats_to_try:
        vals = sorted({float(r[feat]) for r in rows})
        if len(vals) < 2:
            continue
        raw_thresholds = [(vals[i] + vals[i + 1]) / 2.0 for i in range(len(vals) - 1)]
        if len(raw_thresholds) > candidate_thresholds_limit:
            step = max(1, len(raw_thresholds) // candidate_thresholds_limit)
            thresholds = raw_thresholds[::step]
        else:
            thresholds = raw_thresholds
        for thr in thresholds:
            left = [r for r in rows if float(r[feat]) <= thr]
            right = [r for r in rows if float(r[feat]) > thr]
            if len(left) < min_samples_leaf or len(right) < min_samples_leaf:
                continue
            g_left = _gini_impurity([int(r["aprueba"]) for r in left])
            g_right = _gini_impurity([int(r["aprueba"]) for r in right])
            weighted = (len(left) / n) * g_left + (len(right) / n) * g_right
            gain = current_gini - weighted
            if gain > best_gain + 1e-9:
                best_gain = gain
                best_feature = feat
                best_threshold = round(thr, 2)
                best_left = left
                best_right = right

    if best_feature is None or best_threshold is None:
        return {
            "is_leaf": True,
            "depth": depth,
            "prediction": majority_class,
            "samples": n,
            "class_counts": [zeros, ones],
            "gini": current_gini,
        }

    return {
        "is_leaf": False,
        "depth": depth,
        "feature": best_feature,
        "threshold": best_threshold,
        "prediction": majority_class,
        "samples": n,
        "class_counts": [zeros, ones],
        "gini": current_gini,
        "left": _build_cart_tree(
            best_left,
            depth + 1,
            max_depth,
            features=all_feats,
            min_samples_leaf=min_samples_leaf,
            candidate_thresholds_limit=candidate_thresholds_limit,
            rng=rng,
            max_features=max_features,
        ),
        "right": _build_cart_tree(
            best_right,
            depth + 1,
            max_depth,
            features=all_feats,
            min_samples_leaf=min_samples_leaf,
            candidate_thresholds_limit=candidate_thresholds_limit,
            rng=rng,
            max_features=max_features,
        ),
    }


def _predict_cart_single(tree: dict[str, Any], record: dict[str, Any]) -> tuple[int, list[str]]:
    """Clasifica un registro recorriendo el arbol de decision y devuelve la traza."""
    node = tree
    path_trace: list[str] = []
    while not node.get("is_leaf", True):
        feat = str(node["feature"])
        thr = float(node["threshold"])
        val = float(record[feat])
        if val <= thr:
            path_trace.append(f"{feat} ({val:g}) <= {thr:g}")
            node = node["left"]
        else:
            path_trace.append(f"{feat} ({val:g}) > {thr:g}")
            node = node["right"]
    pred = int(node["prediction"])
    return pred, path_trace


def _stratified_train_test_split(
    dataset: list[dict[str, Any]],
    test_size: float = 0.30,
    seed: int = 42,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Division estratificada reproducible (70% entrenamiento / 30% prueba)."""
    rng = random.Random(seed)
    class_0 = [dict(r) for r in dataset if int(r["aprueba"]) == 0]
    class_1 = [dict(r) for r in dataset if int(r["aprueba"]) == 1]
    rng.shuffle(class_0)
    rng.shuffle(class_1)

    n0_test = max(1, int(round(len(class_0) * test_size)))
    n1_test = max(1, int(round(len(class_1) * test_size)))

    test_rows = class_0[:n0_test] + class_1[:n1_test]
    train_rows = class_0[n0_test:] + class_1[n1_test:]

    test_rows.sort(key=lambda r: int(r["id"]))
    train_rows.sort(key=lambda r: int(r["id"]))
    return train_rows, test_rows


def _compute_classification_metrics(
    y_true: list[int],
    y_pred: list[int],
) -> dict[str, Any]:
    """Calcula exactitud, matriz de confusion 2x2 [[VN, FP], [FN, VP]] y reporte F1."""
    n = len(y_true)
    if n == 0:
        return {
            "accuracy": 0.0,
            "confusion_matrix": [[0, 0], [0, 0]],
            "report": [],
        }

    vn = sum(1 for t, p in zip(y_true, y_pred, strict=False) if t == 0 and p == 0)
    fp = sum(1 for t, p in zip(y_true, y_pred, strict=False) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred, strict=False) if t == 1 and p == 0)
    vp = sum(1 for t, p in zip(y_true, y_pred, strict=False) if t == 1 and p == 1)

    accuracy = (vn + vp) / n

    # Clase 0: No aprueba / Requiere refuerzo
    prec_0 = vn / (vn + fn) if (vn + fn) > 0 else 0.0
    rec_0 = vn / (vn + fp) if (vn + fp) > 0 else 0.0
    f1_0 = (2 * prec_0 * rec_0 / (prec_0 + rec_0)) if (prec_0 + rec_0) > 0 else 0.0
    sup_0 = vn + fp

    # Clase 1: Aprueba / Perfil listo
    prec_1 = vp / (vp + fp) if (vp + fp) > 0 else 0.0
    rec_1 = vp / (vp + fn) if (vp + fn) > 0 else 0.0
    f1_1 = (2 * prec_1 * rec_1 / (prec_1 + rec_1)) if (prec_1 + rec_1) > 0 else 0.0
    sup_1 = fn + vp

    return {
        "accuracy": round(accuracy, 4),
        "accuracy_pct": round(accuracy * 100.0, 2),
        "precision": round(prec_1, 4),
        "precision_pct": round(prec_1 * 100.0, 2),
        "recall": round(rec_1, 4),
        "recall_pct": round(rec_1 * 100.0, 2),
        "f1_score": round(f1_1, 4),
        "f1_pct": round(f1_1 * 100.0, 2),
        "confusion_matrix": [[vn, fp], [fn, vp]],
        "confusion_details": {
            "true_negatives": vn,
            "false_positives": fp,
            "false_negatives": fn,
            "true_positives": vp,
        },
        "report": [
            {
                "class_id": 0,
                "label": "Requiere refuerzo (0)",
                "precision": round(prec_0, 2),
                "recall": round(rec_0, 2),
                "f1_score": round(f1_0, 2),
                "support": sup_0,
            },
            {
                "class_id": 1,
                "label": "Perfil listo / Aprueba (1)",
                "precision": round(prec_1, 2),
                "recall": round(rec_1, 2),
                "f1_score": round(f1_1, 2),
                "support": sup_1,
            },
        ],
    }


# ============================================================================
# PRACTICA 04 y 05: DATASET SINTETICO DE 4 VARIABLES (60% / 20% / 20%)
# ============================================================================

FEATURES_4 = ["horas_estudio", "asistencia", "actividades_entregadas", "participacion"]


def _generate_smart_talent_dataset(n: int = 150, seed: int = 42) -> list[dict[str, Any]]:
    """Genera registros sinteticos reproducibles con 4 variables y ruido normal."""
    rng = random.Random(seed)
    rows: list[dict[str, Any]] = []
    for i in range(1, n + 1):
        horas = round(rng.uniform(0.0, 18.0), 2)
        asist = round(rng.uniform(35.0, 100.0), 2)
        activ = round(rng.uniform(15.0, 100.0), 2)
        part = round(rng.uniform(0.0, 10.0), 2)
        ruido = rng.gauss(0.0, 6.8)
        puntuacion = (
            horas * 2.35
            + asist * 0.25
            + activ * 0.18
            + part * 1.55
            + ruido
        )
        aprueba = 1 if puntuacion >= 55.0 else 0
        rows.append(
            {
                "id": i,
                "horas_estudio": horas,
                "asistencia": asist,
                "actividades_entregadas": activ,
                "participacion": part,
                "aprueba": aprueba,
            }
        )
    return rows


_CACHED_DATASET_150: list[dict[str, Any]] | None = None


def _get_dataset_150() -> list[dict[str, Any]]:
    global _CACHED_DATASET_150
    if _CACHED_DATASET_150 is None:
        _CACHED_DATASET_150 = _generate_smart_talent_dataset(150, seed=42)
    return _CACHED_DATASET_150


def _split_train_val_test_60_20_20(
    dataset: list[dict[str, Any]],
    seed: int = 42,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Divide estratificadamente en 60% entrenamiento, 20% validacion y 20% prueba."""
    train_rows, temp_rows = _stratified_train_test_split(dataset, test_size=0.40, seed=seed)
    val_rows, test_rows = _stratified_train_test_split(temp_rows, test_size=0.50, seed=seed)
    return train_rows, val_rows, test_rows


def _cross_validate_stratified_5fold(
    rows: list[dict[str, Any]],
    predict_fold_fn: Any,
    metric_key: str = "accuracy",
    seed: int = 42,
) -> dict[str, Any]:
    """Ejecuta validacion cruzada estratificada de 5 particiones (cv=5)."""
    rng = random.Random(seed)
    c0 = [dict(r) for r in rows if int(r["aprueba"]) == 0]
    c1 = [dict(r) for r in rows if int(r["aprueba"]) == 1]
    rng.shuffle(c0)
    rng.shuffle(c1)

    folds: list[list[dict[str, Any]]] = [[] for _ in range(5)]
    for idx, item in enumerate(c0):
        folds[idx % 5].append(item)
    for idx, item in enumerate(c1):
        folds[idx % 5].append(item)

    scores: list[float] = []
    for k in range(5):
        val_fold = folds[k]
        train_fold: list[dict[str, Any]] = []
        for j in range(5):
            if j != k:
                train_fold.extend(folds[j])
        y_true = [int(r["aprueba"]) for r in val_fold]
        y_pred = predict_fold_fn(train_fold, val_fold)
        m = _compute_classification_metrics(y_true, y_pred)
        scores.append(round(float(m[metric_key]), 4))

    mean_val = sum(scores) / len(scores) if scores else 0.0
    variance = sum((s - mean_val) ** 2 for s in scores) / len(scores) if scores else 0.0
    std_val = math.sqrt(variance)
    return {
        "folds": [round(s * 100.0, 2) for s in scores],
        "mean_pct": round(mean_val * 100.0, 2),
        "std_pct": round(std_val * 100.0, 2),
    }


def _run_practice_04_overfitting(
    train_rows: list[dict[str, Any]],
    val_rows: list[dict[str, Any]],
    test_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    """Practica 04: Entrenamiento (60%), Validacion (20%) y Prueba (20%)."""
    depths: list[int | None] = [1, 2, 3, 5, 10, None]
    depth_results: list[dict[str, Any]] = []
    trees_by_key: dict[str, dict[str, Any]] = {}

    y_train = [int(r["aprueba"]) for r in train_rows]
    y_val = [int(r["aprueba"]) for r in val_rows]
    y_test = [int(r["aprueba"]) for r in test_rows]

    for d in depths:
        effective_depth = 14 if d is None else d
        key_label = "Sin limite" if d is None else str(d)
        graph_x = 12 if d is None else d
        tree = _build_cart_tree(
            train_rows,
            depth=0,
            max_depth=effective_depth,
            features=FEATURES_4,
            min_samples_leaf=1,
            candidate_thresholds_limit=14,
        )
        trees_by_key[key_label] = tree

        pred_train = [_predict_cart_single(tree, r)[0] for r in train_rows]
        pred_val = [_predict_cart_single(tree, r)[0] for r in val_rows]

        acc_train = sum(
            1 for t, p in zip(y_train, pred_train, strict=False) if t == p
        ) / len(y_train)
        acc_val = sum(
            1 for t, p in zip(y_val, pred_val, strict=False) if t == p
        ) / len(y_val)
        diff = acc_train - acc_val

        if acc_train < 0.72 and acc_val < 0.72:
            diag = "Posible subajuste (Underfitting)"
            tone = "warning"
        elif diff > 0.10:
            diag = "Posible sobreajuste (Overfitting)"
            tone = "danger"
        else:
            diag = "Buen ajuste (Sin brecha grande)"
            tone = "success"

        depth_results.append(
            {
                "profundidad": key_label,
                "profundidad_grafica": graph_x,
                "entrenamiento": round(acc_train, 4),
                "entrenamiento_pct": round(acc_train * 100.0, 2),
                "validacion": round(acc_val, 4),
                "validacion_pct": round(acc_val * 100.0, 2),
                "diferencia_pct": round(diff * 100.0, 2),
                "diagnostico": diag,
                "tone": tone,
            }
        )

    best_row = max(depth_results, key=lambda item: float(item["validacion"]))
    best_label = str(best_row["profundidad"])
    best_tree = trees_by_key[best_label]
    best_eff_depth = 14 if best_label == "Sin limite" else int(best_label)

    pred_test = [_predict_cart_single(best_tree, r)[0] for r in test_rows]
    final_test_metrics = _compute_classification_metrics(y_test, pred_test)

    def _cv_tree_predict(
        tr_fold: list[dict[str, Any]], vl_fold: list[dict[str, Any]]
    ) -> list[int]:
        t = _build_cart_tree(
            tr_fold,
            depth=0,
            max_depth=best_eff_depth,
            features=FEATURES_4,
            min_samples_leaf=1,
            candidate_thresholds_limit=12,
        )
        return [_predict_cart_single(t, r)[0] for r in vl_fold]

    cv_summary = _cross_validate_stratified_5fold(
        train_rows, _cv_tree_predict, metric_key="accuracy", seed=42
    )

    csv_comp = _rows_to_csv(
        depth_results,
        [
            "profundidad",
            "entrenamiento_pct",
            "validacion_pct",
            "diferencia_pct",
            "diagnostico",
        ],
    )

    return {
        "split_counts": {
            "total": len(train_rows) + len(val_rows) + len(test_rows),
            "train": len(train_rows),
            "validation": len(val_rows),
            "test": len(test_rows),
            "ratios": "60% Entrenamiento / 20% Validacion / 20% Prueba",
        },
        "depth_comparison": depth_results,
        "selected_depth": best_label,
        "selected_validation_pct": best_row["validacion_pct"],
        "final_test_metrics": final_test_metrics,
        "cross_validation": cv_summary,
        "comparison_csv": csv_comp,
    }


# ============================================================================
# PRACTICA 05: DECISION TREE vs RANDOM FOREST vs KNN (CON STANDARDSCALER)
# ============================================================================


def _fit_standard_scaler(
    rows: list[dict[str, Any]], features: list[str]
) -> dict[str, tuple[float, float]]:
    """Calcula media y desviacion estandar por variable solo con datos de entrenamiento."""
    stats: dict[str, tuple[float, float]] = {}
    n = max(1, len(rows))
    for f in features:
        vals = [float(r[f]) for r in rows]
        mean = sum(vals) / n
        var = sum((v - mean) ** 2 for v in vals) / n
        std = math.sqrt(var) if var > 1e-9 else 1.0
        stats[f] = (mean, std)
    return stats


def _scale_record(
    rec: dict[str, Any],
    scaler: dict[str, tuple[float, float]],
    features: list[str],
) -> list[float]:
    return [(float(rec[f]) - scaler[f][0]) / scaler[f][1] for f in features]


def _predict_knn_weighted(
    train_rows: list[dict[str, Any]],
    query_rec: dict[str, Any],
    scaler: dict[str, tuple[float, float]],
    features: list[str],
    k: int = 7,
) -> tuple[int, float]:
    """KNN con StandardScaler y pesos inversos a la distancia Euclidiana."""
    q_vec = _scale_record(query_rec, scaler, features)
    dists: list[tuple[float, int]] = []
    for tr in train_rows:
        t_vec = _scale_record(tr, scaler, features)
        sq = sum((a - b) ** 2 for a, b in zip(q_vec, t_vec, strict=False))
        d = math.sqrt(sq)
        dists.append((d, int(tr["aprueba"])))
    dists.sort(key=lambda x: x[0])
    neighbors = dists[: max(1, min(k, len(dists)))]
    w0 = 0.0
    w1 = 0.0
    for d, label in neighbors:
        w = 1.0 / (d + 1e-4)
        if label == 1:
            w1 += w
        else:
            w0 += w
    total_w = w0 + w1
    prob_1 = (w1 / total_w) if total_w > 0 else 0.5
    return (1 if w1 >= w0 else 0), round(prob_1 * 100.0, 1)


def _fit_random_forest(
    train_rows: list[dict[str, Any]],
    n_estimators: int = 25,
    max_depth: int = 5,
    min_samples_leaf: int = 2,
    seed: int = 42,
) -> list[dict[str, Any]]:
    """Entrena un bosque aleatorio con bootstrap y subconjunto de variables por nodo."""
    rng = random.Random(seed)
    n = len(train_rows)
    eff_trees = max(5, min(35, n_estimators))
    forest: list[dict[str, Any]] = []
    for _ in range(eff_trees):
        sample = [train_rows[rng.randrange(n)] for _ in range(n)]
        tree = _build_cart_tree(
            sample,
            depth=0,
            max_depth=max_depth,
            features=FEATURES_4,
            min_samples_leaf=min_samples_leaf,
            candidate_thresholds_limit=10,
            rng=rng,
            max_features=2,
        )
        forest.append(tree)
    return forest


def _predict_random_forest(
    forest: list[dict[str, Any]], rec: dict[str, Any]
) -> tuple[int, float]:
    if not forest:
        return 0, 0.0
    votes_1 = sum(1 for t in forest if _predict_cart_single(t, rec)[0] == 1)
    ratio = votes_1 / len(forest)
    return (1 if ratio >= 0.5 else 0), round(ratio * 100.0, 1)


def _run_practice_05_algorithms(
    train_rows: list[dict[str, Any]],
    val_rows: list[dict[str, Any]],
    test_rows: list[dict[str, Any]],
    new_case_4: dict[str, float],
    knn_neighbors: int = 7,
    rf_estimators: int = 100,
    dt_max_depth: int = 5,
) -> dict[str, Any]:
    """Practica 05: Compara Decision Tree, Random Forest y KNN (StandardScaler)."""
    y_val = [int(r["aprueba"]) for r in val_rows]
    y_test = [int(r["aprueba"]) for r in test_rows]

    # 1. Entrenar los 3 modelos en el 60% de Entrenamiento
    dt_model = _build_cart_tree(
        train_rows,
        depth=0,
        max_depth=dt_max_depth,
        features=FEATURES_4,
        min_samples_leaf=4,
        candidate_thresholds_limit=14,
    )
    rf_model = _fit_random_forest(
        train_rows,
        n_estimators=rf_estimators,
        max_depth=6,
        min_samples_leaf=2,
        seed=42,
    )
    scaler_train = _fit_standard_scaler(train_rows, FEATURES_4)

    # 2. Evaluar en el 20% de Validacion
    val_preds = {
        "Decision Tree": [_predict_cart_single(dt_model, r)[0] for r in val_rows],
        "Random Forest": [_predict_random_forest(rf_model, r)[0] for r in val_rows],
        "KNN": [
            _predict_knn_weighted(
                train_rows, r, scaler_train, FEATURES_4, k=knn_neighbors
            )[0]
            for r in val_rows
        ],
    }

    algo_descriptions = {
        "Decision Tree": (
            f"Arbol de decision jerarquico (max_depth={dt_max_depth}, min_samples_leaf=4)."
        ),
        "Random Forest": (
            f"Ensamble de {rf_estimators} arboles con muestreo bootstrap y votacion."
        ),
        "KNN": (
            f"Pipeline StandardScaler + {knn_neighbors} vecinos mas cercanos ponderados por distancia."
        ),
    }

    comparison_rows: list[dict[str, Any]] = []
    for name, preds in val_preds.items():
        m = _compute_classification_metrics(y_val, preds)
        comparison_rows.append(
            {
                "algoritmo": name,
                "descripcion": algo_descriptions[name],
                "exactitud": m["accuracy"],
                "exactitud_pct": m["accuracy_pct"],
                "precision": m["precision"],
                "precision_pct": m["precision_pct"],
                "recall": m["recall"],
                "recall_pct": m["recall_pct"],
                "f1_score": m["f1_score"],
                "f1_pct": m["f1_pct"],
            }
        )

    # Ordenar por F1-score descendente (criterio de seleccion de la Practica 05)
    comparison_rows.sort(key=lambda r: float(r["f1_score"]), reverse=True)
    winner = comparison_rows[0]
    winner_name = str(winner["algoritmo"])

    # 3. Reentrenar el modelo ganador con Entrenamiento + Validacion (80%)
    train_val_rows = train_rows + val_rows
    if winner_name == "Decision Tree":
        dt_final = _build_cart_tree(
            train_val_rows,
            depth=0,
            max_depth=dt_max_depth,
            features=FEATURES_4,
            min_samples_leaf=4,
            candidate_thresholds_limit=14,
        )
        test_preds = [_predict_cart_single(dt_final, r)[0] for r in test_rows]
    elif winner_name == "Random Forest":
        rf_final = _fit_random_forest(
            train_val_rows,
            n_estimators=rf_estimators,
            max_depth=6,
            min_samples_leaf=2,
            seed=42,
        )
        test_preds = [_predict_random_forest(rf_final, r)[0] for r in test_rows]
    else:
        scaler_final = _fit_standard_scaler(train_val_rows, FEATURES_4)
        test_preds = [
            _predict_knn_weighted(
                train_val_rows, r, scaler_final, FEATURES_4, k=knn_neighbors
            )[0]
            for r in test_rows
        ]

    final_test_metrics = _compute_classification_metrics(y_test, test_preds)

    # 4. Validacion cruzada 5-Fold sobre el 80% (Entrenamiento + Validacion) con metrica F1
    def _cv_winner_predict(
        tr_f: list[dict[str, Any]], vl_f: list[dict[str, Any]]
    ) -> list[int]:
        if winner_name == "Decision Tree":
            t = _build_cart_tree(
                tr_f,
                depth=0,
                max_depth=dt_max_depth,
                features=FEATURES_4,
                min_samples_leaf=4,
                candidate_thresholds_limit=12,
            )
            return [_predict_cart_single(t, r)[0] for r in vl_f]
        if winner_name == "Random Forest":
            f_m = _fit_random_forest(
                tr_f, n_estimators=15, max_depth=5, min_samples_leaf=2, seed=42
            )
            return [_predict_random_forest(f_m, r)[0] for r in vl_f]
        sc = _fit_standard_scaler(tr_f, FEATURES_4)
        return [
            _predict_knn_weighted(tr_f, r, sc, FEATURES_4, k=knn_neighbors)[0]
            for r in vl_f
        ]

    cv_f1 = _cross_validate_stratified_5fold(
        train_val_rows, _cv_winner_predict, metric_key="f1_score", seed=42
    )

    # 5. Prediccion del caso nuevo con los 3 algoritmos
    dt_new_pred, dt_new_trace = _predict_cart_single(dt_model, new_case_4)
    rf_new_pred, rf_new_conf = _predict_random_forest(rf_model, new_case_4)
    knn_new_pred, knn_new_conf = _predict_knn_weighted(
        train_rows, new_case_4, scaler_train, FEATURES_4, k=knn_neighbors
    )

    csv_p05 = _rows_to_csv(
        comparison_rows,
        [
            "algoritmo",
            "exactitud_pct",
            "precision_pct",
            "recall_pct",
            "f1_pct",
        ],
    )

    return {
        "hyperparameters": {
            "knn_neighbors": knn_neighbors,
            "rf_estimators": rf_estimators,
            "dt_max_depth": dt_max_depth,
        },
        "validation_comparison": comparison_rows,
        "selected_algorithm": winner_name,
        "selected_validation_f1_pct": winner["f1_pct"],
        "selection_criterion": "Mayor F1-Score en conjunto de validacion (20%)",
        "retrained_samples": len(train_val_rows),
        "final_test_metrics": final_test_metrics,
        "cross_validation_f1": cv_f1,
        "new_case_predictions": {
            "inputs": new_case_4,
            "decision_tree": {
                "prediction": dt_new_pred,
                "label": "Aprueba / Perfil listo (1)" if dt_new_pred == 1 else "Requiere refuerzo (0)",
                "trace": dt_new_trace,
            },
            "random_forest": {
                "prediction": rf_new_pred,
                "label": "Aprueba / Perfil listo (1)" if rf_new_pred == 1 else "Requiere refuerzo (0)",
                "vote_confidence_pct": rf_new_conf,
            },
            "knn": {
                "prediction": knn_new_pred,
                "label": "Aprueba / Perfil listo (1)" if knn_new_pred == 1 else "Requiere refuerzo (0)",
                "distance_confidence_pct": knn_new_conf,
            },
        },
        "comparison_csv": csv_p05,
    }


def run_full_ml_lab(
    horas_estudio: float = 6.0,
    asistencia: float = 80.0,
    actividades_entregadas: float = 75.0,
    participacion: float = 7.5,
    min_horas_rule: float = 5.0,
    min_asistencia_rule: float = 70.0,
    min_actividades_rule: float = 65.0,
    max_depth: int = 3,
    knn_neighbors: int = 7,
    rf_estimators: int = 100,
    dt_max_depth: int = 5,
) -> dict[str, Any]:
    """Ejecuta de extremo a extremo las Practicas 01, 02, 03, 04 y 05."""
    # 1. Practica 01: BFS vs Regla Fija simple
    bfs_res = bfs_find_route()
    simple_rule_examples = [
        {
            "nombre": r["candidato"],
            "horas_estudio": r["horas_estudio"],
            "resultado": predict_single_fixed_rule(float(r["horas_estudio"])),
        }
        for r in CLEAN_DATASET_8[:4]
    ]

    # 2. Practica 02: Exploracion, Calidad, Limpieza y Variables X/y
    data_lab = explore_and_clean_datasets()

    # 3. Practica 03: Reglas Fijas vs Machine Learning (DecisionTree max_depth=3)
    train_rows, test_rows = _stratified_train_test_split(
        PRACTICE_03_DATASET, test_size=0.30, seed=42
    )
    tree = _build_cart_tree(train_rows, depth=0, max_depth=max_depth)

    y_true: list[int] = []
    y_pred_rules: list[int] = []
    y_pred_ml: list[int] = []
    comparison_table: list[dict[str, Any]] = []

    for r in test_rows:
        real_val = int(r["aprueba"])
        rule_val = predict_with_fixed_rules(
            r,
            min_horas=min_horas_rule,
            min_asistencia=min_asistencia_rule,
            min_actividades=min_actividades_rule,
        )
        ml_val, trace = _predict_cart_single(tree, r)
        y_true.append(real_val)
        y_pred_rules.append(rule_val)
        y_pred_ml.append(ml_val)
        comparison_table.append(
            {
                "id": r["id"],
                "horas_estudio": r["horas_estudio"],
                "asistencia": r["asistencia"],
                "actividades_entregadas": r["actividades_entregadas"],
                "resultado_real": real_val,
                "prediccion_reglas": rule_val,
                "prediccion_ml": ml_val,
                "coincide_reglas": rule_val == real_val,
                "coincide_ml": ml_val == real_val,
                "traza_ml": trace,
            }
        )

    metrics_ml = _compute_classification_metrics(y_true, y_pred_ml)
    metrics_rules = _compute_classification_metrics(y_true, y_pred_rules)

    # 4. Evaluacion del caso nuevo (interactivo para Candidato y Empresa)
    new_case = {
        "horas_estudio": horas_estudio,
        "asistencia": asistencia,
        "actividades_entregadas": actividades_entregadas,
    }
    new_rule_pred = predict_with_fixed_rules(
        new_case,
        min_horas=min_horas_rule,
        min_asistencia=min_asistencia_rule,
        min_actividades=min_actividades_rule,
    )
    new_ml_pred, new_ml_trace = _predict_cart_single(tree, new_case)

    class_dist = {
        "no_aprueba_0": sum(1 for r in PRACTICE_03_DATASET if r["aprueba"] == 0),
        "aprueba_1": sum(1 for r in PRACTICE_03_DATASET if r["aprueba"] == 1),
    }

    # 5. Practicas 04 y 05 sobre dataset de 4 variables con split 60% / 20% / 20%
    ds_150 = _get_dataset_150()
    tr_60, vl_20, ts_20 = _split_train_val_test_60_20_20(ds_150, seed=42)
    p04_res = _run_practice_04_overfitting(tr_60, vl_20, ts_20)
    new_case_4 = {
        "horas_estudio": horas_estudio,
        "asistencia": asistencia,
        "actividades_entregadas": actividades_entregadas,
        "participacion": participacion,
    }
    p05_res = _run_practice_05_algorithms(
        tr_60,
        vl_20,
        ts_20,
        new_case_4=new_case_4,
        knn_neighbors=knn_neighbors,
        rf_estimators=rf_estimators,
        dt_max_depth=dt_max_depth,
    )

    return {
        "model_version": MODEL_VERSION,
        "practice_01": {
            "bfs": bfs_res,
            "fixed_rule_batch": simple_rule_examples,
            "new_case_simple_rule": predict_single_fixed_rule(horas_estudio),
        },
        "practice_02": data_lab,
        "practice_03": {
            "total_records": len(PRACTICE_03_DATASET),
            "train_count": len(train_rows),
            "test_count": len(test_rows),
            "class_distribution": class_dist,
            "rule_thresholds": {
                "min_horas": min_horas_rule,
                "min_asistencia": min_asistencia_rule,
                "min_actividades": min_actividades_rule,
            },
            "tree": tree,
            "comparison_table": comparison_table,
            "metrics_rules": metrics_rules,
            "metrics_ml": metrics_ml,
            "new_case": {
                "inputs": new_case,
                "rule_prediction": new_rule_pred,
                "rule_label": (
                    "Perfil listo / Aprueba"
                    if new_rule_pred == 1
                    else "Requiere refuerzo"
                ),
                "ml_prediction": new_ml_pred,
                "ml_label": (
                    "Perfil listo / Aprueba"
                    if new_ml_pred == 1
                    else "Requiere refuerzo"
                ),
                "ml_decision_trace": new_ml_trace,
                "simple_rule_label": predict_single_fixed_rule(horas_estudio),
            },
            "conclusions": [
                "El sistema de reglas utiliza condiciones definidas manualmente.",
                "El modelo de ML utiliza patrones aprendidos durante el entrenamiento (fit).",
                "fit() entrena con el 70% de ejemplos; predict() clasifica el 30% de prueba.",
                "Una mayor exactitud en esta prueba no garantiza mejor desempeño futuro.",
                "En AURA estos indicadores son orientativos y nunca reemplazan al humano.",
            ],
        },
        "practice_04": p04_res,
        "practice_05": p05_res,
    }
