"""Motor de Aprendizaje No Supervisado: K-Means, Estabilidad, Atipicos y PCA.

Adapta las Practicas 07, 08 y 09 al dominio de AURA Talent AI:
- Practica 07 (Segmentacion K-Means): dataset sintetico de 500 perfiles con
  3 segmentos, limpieza de datos (valores faltantes -> mediana, rangos ->
  clip, duplicados exactos -> eliminados), StandardScaler, metodo del codo
  (inercia WCSS para K=1..8), Silhouette Score (K=2..8), modelo final,
  centroides en escala original y perfiles descriptivos.
- Practica 08 (Analisis avanzado de clusters): comparacion de
  inicializaciones (k-means++ vs random), comparacion de escaladores
  (StandardScaler vs MinMaxScaler), estabilidad por Adjusted Rand Index
  entre 6 semillas, distancias a centroides y deteccion de posibles casos
  atipicos por percentil 95 con silhouette individual.
- Practica 09 (PCA): matriz de covarianza y autovalores/autovectores por
  el metodo de Jacobi, varianza explicada y acumulada, cargas (loadings),
  proyeccion 2D coloreada por cluster y error de reconstruccion (MSE).

IMPORTANTE: Este motor es exclusivamente formativo, analitico y de apoyo
humano. Los segmentos describen patrones; no predicen contratacion ni
reemplazan decisiones humanas.
"""

from __future__ import annotations

import math
import random
from typing import Any

from app.analytics.ml_pipeline import _rows_to_csv, _run_practice_06_optimization

SEG_FEATURES = ["horas_estudio", "asistencia", "actividades", "participacion"]

SEG_RANGES: dict[str, tuple[float, float]] = {
    "horas_estudio": (0.0, 12.0),
    "asistencia": (0.0, 100.0),
    "actividades": (0.0, 30.0),
    "participacion": (0.0, 100.0),
}

SEG_PERFIL_NAMES = [
    "Requiere acompanamiento",
    "Compromiso intermedio",
    "Alto compromiso",
]

CLUSTER_COLORS = ["#38bdf8", "#a855f7", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"]


# ============================================================================
# GENERACION Y LIMPIEZA DEL DATASET DE SEGMENTACION (500 PERFILES, 3 GRUPOS)
# ============================================================================


def _generate_segmentation_raw(seed: int = 42) -> list[dict[str, Any]]:
    """Genera 500 registros sinteticos con 3 perfiles simulados (Practica 07/08)."""
    rng = random.Random(seed)
    profiles = [
        (180, 8.0, 1.0, 92.0, 5.0, 27.0, 2.0, 90.0, 6.0),
        (170, 5.0, 1.0, 75.0, 7.0, 20.0, 3.0, 65.0, 8.0),
        (150, 2.5, 1.0, 55.0, 8.0, 12.0, 4.0, 40.0, 10.0),
    ]
    rows: list[dict[str, Any]] = []
    for count, hm, hs, am, a_s, cm, cs, pm, ps in profiles:
        for _ in range(count):
            rows.append(
                {
                    "horas_estudio": rng.gauss(hm, hs),
                    "asistencia": rng.gauss(am, a_s),
                    "actividades": rng.gauss(cm, cs),
                    "participacion": rng.gauss(pm, ps),
                }
            )
    rng.shuffle(rows)
    for i, r in enumerate(rows):
        r["id"] = f"PER-{i + 1:04d}"
    return rows


def _inject_quality_issues(rows: list[dict[str, Any]], seed: int = 7) -> list[dict[str, Any]]:
    """Inyecta anomalias controladas para demostrar la limpieza completa:
    valores faltantes (NaN), valores fuera de rango y duplicados exactos."""
    rng = random.Random(seed)
    dirty = [dict(r) for r in rows]

    miss_idx = rng.sample(range(len(dirty)), 9)
    for pos, idx in enumerate(miss_idx):
        dirty[idx][SEG_FEATURES[pos % len(SEG_FEATURES)]] = None

    oor_specs = [
        (miss_idx[0], "asistencia", 118.0),
        (miss_idx[3], "horas_estudio", -2.4),
        (miss_idx[6], "participacion", 132.0),
        (miss_idx[8], "actividades", 41.0),
    ]
    for idx, feat, val in oor_specs:
        dirty[idx][feat] = val

    dup_src = [dirty[10], dirty[250]]
    dirty.extend(dict(r) for r in dup_src)
    return dirty


def _clean_segmentation_dataset(
    dirty_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Pipeline de limpieza completo y auditable (Practica 08, preparar_datos):
    1) eliminar duplicados exactos, 2) faltantes -> mediana, 3) recorte de rangos."""
    # Paso 1: duplicados exactos
    seen: set[tuple] = set()
    dedup: list[dict[str, Any]] = []
    duplicates_removed = 0
    for r in dirty_rows:
        sig = tuple(r.get(f) for f in SEG_FEATURES)
        if sig in seen:
            duplicates_removed += 1
            continue
        seen.add(sig)
        dedup.append(r)

    # Paso 2: valores faltantes por columna -> mediana de cada variable
    missing_by_column: dict[str, int] = {f: 0 for f in SEG_FEATURES}
    for r in dedup:
        for f in SEG_FEATURES:
            if r.get(f) is None:
                missing_by_column[f] += 1

    medians: dict[str, float] = {}
    for f in SEG_FEATURES:
        vals = sorted(float(r[f]) for r in dedup if r.get(f) is not None)
        medians[f] = vals[len(vals) // 2] if vals else 0.0

    imputations: list[dict[str, Any]] = []
    for r in dedup:
        for f in SEG_FEATURES:
            if r.get(f) is None:
                imputations.append(
                    {"id": r["id"], "variable": f, "mediana_usada": round(medians[f], 3)}
                )
                r[f] = medians[f]

    # Paso 3: recorte a rangos plausibles (clip)
    range_corrections: list[dict[str, Any]] = []
    for r in dedup:
        for f in SEG_FEATURES:
            lo, hi = SEG_RANGES[f]
            v = float(r[f])
            clipped = min(hi, max(lo, v))
            if clipped != v:
                range_corrections.append(
                    {
                        "id": r["id"],
                        "variable": f,
                        "valor_original": round(v, 3),
                        "valor_ajustado": round(clipped, 3),
                    }
                )
            r[f] = round(clipped, 3)

    clean = dedup
    report = {
        "registros_iniciales": len(dirty_rows),
        "registros_finales": len(clean),
        "duplicados_eliminados": duplicates_removed,
        "missing_by_column": missing_by_column,
        "total_faltantes": sum(missing_by_column.values()),
        "imputaciones_mediana": imputations,
        "correcciones_rango": range_corrections,
        "estrategia": (
            "duplicated -> eliminados; isnull -> mediana por columna; "
            "clip a rangos plausibles por variable"
        ),
    }
    return clean, report


_CLEAN_SEG: tuple[list[dict[str, Any]], dict[str, Any]] | None = None


def _get_clean_segmentation() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    global _CLEAN_SEG
    if _CLEAN_SEG is None:
        raw = _generate_segmentation_raw(seed=42)
        dirty = _inject_quality_issues(raw, seed=7)
        _CLEAN_SEG = _clean_segmentation_dataset(dirty)
    return _CLEAN_SEG


# ============================================================================
# ESCALADORES (STANDARDSCALER Y MINMAXSCALER)
# ============================================================================


def _fit_standard(X: list[list[float]]) -> list[tuple[float, float]]:
    stats: list[tuple[float, float]] = []
    n = max(1, len(X))
    d = len(X[0])
    for j in range(d):
        vals = [row[j] for row in X]
        mean = sum(vals) / n
        var = sum((v - mean) ** 2 for v in vals) / n
        std = math.sqrt(var) if var > 1e-12 else 1.0
        stats.append((mean, std))
    return stats


def _fit_minmax(X: list[list[float]]) -> list[tuple[float, float]]:
    stats: list[tuple[float, float]] = []
    d = len(X[0])
    for j in range(d):
        vals = [row[j] for row in X]
        lo, hi = min(vals), max(vals)
        span = (hi - lo) if (hi - lo) > 1e-12 else 1.0
        stats.append((lo, span))
    return stats


def _apply_scaler(
    X: list[list[float]], stats: list[tuple[float, float]], kind: str
) -> list[list[float]]:
    out: list[list[float]] = []
    for row in X:
        if kind == "minmax":
            out.append([(v - stats[j][0]) / stats[j][1] for j, v in enumerate(row)])
        else:
            out.append([(v - stats[j][0]) / stats[j][1] for j, v in enumerate(row)])
    return out


def _inverse_standard(
    pts: list[list[float]], stats: list[tuple[float, float]]
) -> list[list[float]]:
    return [
        [v * stats[j][1] + stats[j][0] for j, v in enumerate(row)] for row in pts
    ]


def _rows_to_matrix(rows: list[dict[str, Any]]) -> list[list[float]]:
    return [[float(r[f]) for f in SEG_FEATURES] for r in rows]


# ============================================================================
# K-MEANS (k-means++ / random, n_init, inercia WCSS)
# ============================================================================


def _dist_sq(a: list[float], b: list[float]) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b, strict=False))


def _init_kmeans_pp(pts: list[list[float]], k: int, rng: random.Random) -> list[list[float]]:
    """k-means++: elige centroides iniciales separados proporcional a D^2."""
    centroids = [list(pts[rng.randrange(len(pts))])]
    while len(centroids) < k:
        d2 = [min(_dist_sq(p, c) for c in centroids) for p in pts]
        total = sum(d2)
        if total <= 1e-12:
            centroids.append(list(pts[rng.randrange(len(pts))]))
            continue
        target = rng.random() * total
        acc = 0.0
        chosen = pts[-1]
        for p, w in zip(pts, d2, strict=False):
            acc += w
            if acc >= target:
                chosen = p
                break
        centroids.append(list(chosen))
    return centroids


def _kmeans_single(
    pts: list[list[float]],
    k: int,
    rng: random.Random,
    init: str = "k-means++",
    max_iter: int = 60,
) -> tuple[list[int], list[list[float]], float, int]:
    if init == "random":
        idxs = rng.sample(range(len(pts)), k)
        centroids = [list(pts[i]) for i in idxs]
    else:
        centroids = _init_kmeans_pp(pts, k, rng)

    labels = [0] * len(pts)
    iters_run = 0
    for it in range(max_iter):
        iters_run = it + 1
        changed = False
        for i, p in enumerate(pts):
            best_c = 0
            best_d = _dist_sq(p, centroids[0])
            for c in range(1, k):
                d = _dist_sq(p, centroids[c])
                if d < best_d:
                    best_d = d
                    best_c = c
            if labels[i] != best_c or it == 0:
                labels[i] = best_c
                changed = True
        new_centroids: list[list[float]] = []
        for c in range(k):
            members = [pts[i] for i in range(len(pts)) if labels[i] == c]
            if not members:
                new_centroids.append(list(pts[rng.randrange(len(pts))]))
                continue
            d = len(pts[0])
            new_centroids.append(
                [sum(m[j] for m in members) / len(members) for j in range(d)]
            )
        shift = max(
            math.sqrt(_dist_sq(a, b)) for a, b in zip(centroids, new_centroids, strict=False)
        )
        centroids = new_centroids
        if not changed or shift < 1e-4:
            break

    inertia = sum(
        _dist_sq(p, centroids[labels[i]]) for i, p in enumerate(pts)
    )
    return labels, centroids, inertia, iters_run


def _kmeans_fit(
    pts: list[list[float]],
    k: int,
    seed: int = 42,
    init: str = "k-means++",
    n_init: int = 10,
) -> dict[str, Any]:
    """Ejecuta n_init arranques y conserva el de menor inercia (como sklearn)."""
    best: dict[str, Any] | None = None
    for i in range(n_init):
        rng = random.Random(seed * 1000 + i)
        labels, centroids, inertia, iters = _kmeans_single(pts, k, rng, init=init)
        if best is None or inertia < float(best["inertia"]):
            best = {
                "labels": labels,
                "centroids": centroids,
                "inertia": inertia,
                "iters": iters,
            }
    assert best is not None
    return best


# ============================================================================
# SILHOUETTE (score global y por muestra, con matriz de distancias precalculada)
# ============================================================================


def _pairwise_dist_matrix(pts: list[list[float]]) -> list[list[float]]:
    n = len(pts)
    dm = [[0.0] * n for _ in range(n)]
    for i in range(n):
        pi = pts[i]
        for j in range(i + 1, n):
            d = math.sqrt(_dist_sq(pi, pts[j]))
            dm[i][j] = d
            dm[j][i] = d
    return dm


def _silhouette_samples_dm(dm: list[list[float]], labels: list[int]) -> list[float]:
    n = len(labels)
    clusters: dict[int, list[int]] = {}
    for i, c in enumerate(labels):
        clusters.setdefault(c, []).append(i)

    samples: list[float] = []
    for i in range(n):
        own = clusters[labels[i]]
        if len(own) <= 1:
            samples.append(0.0)
            continue
        a = sum(dm[i][j] for j in own if j != i) / (len(own) - 1)
        b = math.inf
        for c, members in clusters.items():
            if c == labels[i]:
                continue
            mean_d = sum(dm[i][j] for j in members) / len(members)
            if mean_d < b:
                b = mean_d
        denom = max(a, b)
        samples.append((b - a) / denom if denom > 1e-12 and b != math.inf else 0.0)
    return samples


# ============================================================================
# ADJUSTED RAND INDEX (ARI) - estabilidad entre particiones
# ============================================================================


def _comb2(n: int) -> float:
    return n * (n - 1) / 2.0


def _adjusted_rand_index(labels_a: list[int], labels_b: list[int]) -> float:
    n = len(labels_a)
    if n < 2:
        return 1.0
    contingency: dict[tuple[int, int], int] = {}
    count_a: dict[int, int] = {}
    count_b: dict[int, int] = {}
    for a, b in zip(labels_a, labels_b, strict=False):
        contingency[(a, b)] = contingency.get((a, b), 0) + 1
        count_a[a] = count_a.get(a, 0) + 1
        count_b[b] = count_b.get(b, 0) + 1

    sum_comb_ij = sum(_comb2(c) for c in contingency.values())
    sum_comb_a = sum(_comb2(c) for c in count_a.values())
    sum_comb_b = sum(_comb2(c) for c in count_b.values())
    total = _comb2(n)
    if total <= 0:
        return 1.0
    expected = (sum_comb_a * sum_comb_b) / total
    max_index = 0.5 * (sum_comb_a + sum_comb_b)
    denom = max_index - expected
    if abs(denom) < 1e-12:
        return 1.0
    return (sum_comb_ij - expected) / denom


# ============================================================================
# PCA: matriz de covarianza + descomposicion de Jacobi (autovalores/autovectores)
# ============================================================================


def _covariance_matrix(X: list[list[float]]) -> list[list[float]]:
    n = len(X)
    d = len(X[0])
    means = [sum(row[j] for row in X) / n for j in range(d)]
    cov = [[0.0] * d for _ in range(d)]
    denom = max(1, n - 1)
    for row in X:
        centered = [row[j] - means[j] for j in range(d)]
        for a in range(d):
            for b in range(a, d):
                cov[a][b] += centered[a] * centered[b] / denom
    for a in range(d):
        for b in range(a):
            cov[a][b] = cov[b][a]
    return cov


def _jacobi_eigen(
    matrix: list[list[float]], max_sweeps: int = 80, eps: float = 1e-12
) -> tuple[list[float], list[list[float]]]:
    """Autovalores y autovectores de una matriz simetrica por rotaciones de Jacobi."""
    n = len(matrix)
    a = [row[:] for row in matrix]
    v = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]

    for _ in range(max_sweeps):
        off = math.sqrt(sum(a[i][j] ** 2 for i in range(n) for j in range(n) if i != j))
        if off < eps:
            break
        for p in range(n - 1):
            for q in range(p + 1, n):
                if abs(a[p][q]) < eps:
                    continue
                theta = (a[q][q] - a[p][p]) / (2.0 * a[p][q])
                if theta >= 0:
                    t = 1.0 / (theta + math.sqrt(theta * theta + 1.0))
                else:
                    t = -1.0 / (-theta + math.sqrt(theta * theta + 1.0))
                c = 1.0 / math.sqrt(t * t + 1.0)
                s = t * c

                app = a[p][p]
                aqq = a[q][q]
                apq = a[p][q]
                a[p][p] = c * c * app - 2.0 * s * c * apq + s * s * aqq
                a[q][q] = s * s * app + 2.0 * s * c * apq + c * c * aqq
                a[p][q] = 0.0
                a[q][p] = 0.0
                for k in range(n):
                    if k in (p, q):
                        continue
                    akp = a[k][p]
                    akq = a[k][q]
                    a[k][p] = c * akp - s * akq
                    a[p][k] = a[k][p]
                    a[k][q] = s * akp + c * akq
                    a[q][k] = a[k][q]
                for k in range(n):
                    vkp = v[k][p]
                    vkq = v[k][q]
                    v[k][p] = c * vkp - s * vkq
                    v[k][q] = s * vkp + c * vkq

    eig = [(a[i][i], [v[r][i] for r in range(n)]) for i in range(n)]
    eig.sort(key=lambda x: x[0], reverse=True)
    values = [e[0] for e in eig]
    vectors = [e[1] for e in eig]
    return values, vectors


def _run_pca(
    X_scaled: list[list[float]],
) -> dict[str, Any]:
    cov = _covariance_matrix(X_scaled)
    values, vectors = _jacobi_eigen(cov)
    total_var = sum(values) if sum(values) > 1e-12 else 1.0
    ratios = [v / total_var for v in values]
    acumulada: list[float] = []
    acc = 0.0
    for r in ratios:
        acc += r
        acumulada.append(acc)
    return {
        "eigenvalues": values,
        "components": vectors,
        "explained_ratio": ratios,
        "cumulative": acumulada,
    }


def _pca_transform(
    X: list[list[float]], components: list[list[float]], n_comp: int
) -> list[list[float]]:
    out: list[list[float]] = []
    for row in X:
        coords = []
        for c in range(n_comp):
            coords.append(
                sum(row[j] * components[c][j] for j in range(len(row)))
            )
        out.append(coords)
    return out


def _pca_reconstruction_mse(
    X: list[list[float]], components: list[list[float]], n_comp: int
) -> float:
    n = len(X)
    d = len(X[0])
    if n == 0:
        return 0.0
    sq = 0.0
    for row in X:
        coords = [sum(row[j] * components[c][j] for j in range(d)) for c in range(n_comp)]
        rec = [sum(coords[c] * components[c][j] for c in range(n_comp)) for j in range(d)]
        sq += sum((rec[j] - row[j]) ** 2 for j in range(d))
    return sq / (n * d)


# ============================================================================
# HELPERS DE PERFILES Y ETIQUETAS
# ============================================================================


def _cluster_profiles(
    rows: list[dict[str, Any]], labels: list[int], k: int
) -> list[dict[str, Any]]:
    profiles: list[dict[str, Any]] = []
    for c in range(k):
        members = [rows[i] for i in range(len(rows)) if labels[i] == c]
        n = max(1, len(members))
        profile = {
            "cluster": c,
            "cantidad": len(members),
        }
        for f in SEG_FEATURES:
            profile[f] = round(sum(float(m[f]) for m in members) / n, 2)
        profiles.append(profile)
    return profiles


def _assign_profile_names(profiles: list[dict[str, Any]], k: int) -> dict[int, str]:
    """Ordena los clusters por horas_estudio promedio y asigna nombres."""
    orden = sorted(profiles, key=lambda p: float(p["horas_estudio"]))
    names: dict[int, str] = {}
    for i, p in enumerate(orden):
        c = int(p["cluster"])
        if k == 3:
            names[c] = SEG_PERFIL_NAMES[i]
        else:
            names[c] = f"Segmento {i + 1} de {k}"
    return names


def _nearest_centroid(
    vec: list[float], centroids: list[list[float]]
) -> tuple[int, float]:
    best_c = 0
    best_d = math.inf
    for c, centroid in enumerate(centroids):
        d = math.sqrt(_dist_sq(vec, centroid))
        if d < best_d:
            best_d = d
            best_c = c
    return best_c, round(best_d, 4)


# ============================================================================
# PRACTICA 07: SEGMENTACION K-MEANS (codo, silhouette, perfiles, centroides)
# ============================================================================


def _run_practice_07(
    clean_rows: list[dict[str, Any]],
    cleaning_report: dict[str, Any],
    X_scaled: list[list[float]],
    scaler_stats: list[tuple[float, float]],
    dm: list[list[float]],
    kmeans_k: int = 3,
    seed: int = 42,
    new_case_vec: list[float] | None = None,
) -> dict[str, Any]:
    elbow: list[dict[str, Any]] = []
    for k in range(1, 9):
        res = _kmeans_fit(X_scaled, k, seed=seed, init="k-means++", n_init=6)
        elbow.append({"k": k, "inercia": round(float(res["inertia"]), 2)})

    silhouette_rows: list[dict[str, Any]] = []
    for k in range(2, 9):
        res = _kmeans_fit(X_scaled, k, seed=seed, init="k-means++", n_init=6)
        s_samples = _silhouette_samples_dm(dm, res["labels"])
        s_mean = sum(s_samples) / len(s_samples)
        silhouette_rows.append(
            {"k": k, "silhouette": round(s_mean, 4), "inercia": round(float(res["inertia"]), 2)}
        )

    final = _kmeans_fit(X_scaled, kmeans_k, seed=seed, init="k-means++", n_init=12)
    labels = final["labels"]
    centroids_scaled = final["centroids"]
    centroids_orig = _inverse_standard(centroids_scaled, scaler_stats)

    final_sil_samples = _silhouette_samples_dm(dm, labels)
    final_silhouette = sum(final_sil_samples) / len(final_sil_samples)

    profiles = _cluster_profiles(clean_rows, labels, kmeans_k)
    name_map = _assign_profile_names(profiles, kmeans_k)
    for p in profiles:
        c = int(p["cluster"])
        p["perfil"] = name_map[c]
        p["color"] = CLUSTER_COLORS[c % len(CLUSTER_COLORS)]

    scatter = [
        {
            "x": round(float(r["horas_estudio"]), 2),
            "y": round(float(r["asistencia"]), 2),
            "cluster": labels[i],
        }
        for i, r in enumerate(clean_rows)
    ]
    centroid_points = [
        {
            "cluster": c,
            "x": round(centroids_orig[c][0], 2),
            "y": round(centroids_orig[c][1], 2),
            "perfil": name_map[c],
            "valores": {
                f: round(centroids_orig[c][j], 2) for j, f in enumerate(SEG_FEATURES)
            },
        }
        for c in range(kmeans_k)
    ]

    new_case_segment: dict[str, Any] | None = None
    if new_case_vec is not None:
        c_idx, dist = _nearest_centroid(new_case_vec, centroids_scaled)
        new_case_segment = {
            "cluster": c_idx,
            "perfil": name_map[c_idx],
            "distancia_centroide": dist,
            "color": CLUSTER_COLORS[c_idx % len(CLUSTER_COLORS)],
            "centroide": {
                f: round(centroids_orig[c_idx][j], 2) for j, f in enumerate(SEG_FEATURES)
            },
        }

    stats_describe: dict[str, dict[str, float]] = {}
    for f in SEG_FEATURES:
        vals = sorted(float(r[f]) for r in clean_rows)
        n = len(vals)
        mean = sum(vals) / n
        var = sum((v - mean) ** 2 for v in vals) / n
        stats_describe[f] = {
            "mean": round(mean, 2),
            "std": round(math.sqrt(var), 2),
            "min": round(vals[0], 2),
            "max": round(vals[-1], 2),
        }

    segmentados_csv = _rows_to_csv(
        [
            {
                "id": clean_rows[i]["id"],
                "horas_estudio": clean_rows[i]["horas_estudio"],
                "asistencia": clean_rows[i]["asistencia"],
                "actividades": clean_rows[i]["actividades"],
                "participacion": clean_rows[i]["participacion"],
                "cluster": labels[i],
                "perfil": name_map[labels[i]],
            }
            for i in range(len(clean_rows))
        ],
        ["id", "horas_estudio", "asistencia", "actividades", "participacion", "cluster", "perfil"],
    )
    perfiles_csv = _rows_to_csv(
        profiles,
        ["cluster", "perfil", "cantidad", *SEG_FEATURES],
    )

    return {
        "result": {
            "limpieza": cleaning_report,
            "describe": stats_describe,
            "elbow": elbow,
            "silhouette_por_k": silhouette_rows,
            "k_final": kmeans_k,
            "inercia_final": round(float(final["inertia"]), 2),
            "silhouette_final": round(final_silhouette, 4),
            "iteraciones": final["iters"],
            "perfiles": profiles,
            "scatter": scatter,
            "centroides": centroid_points,
            "new_case_segment": new_case_segment,
            "segmentados_csv": segmentados_csv,
            "perfiles_csv": perfiles_csv,
        },
        "labels": labels,
        "centroids_scaled": centroids_scaled,
        "name_map": name_map,
    }


# ============================================================================
# PRACTICA 08: INICIALIZACIONES, ESCALADORES, ARI, ATIPICOS (P95)
# ============================================================================


def _run_practice_08(
    clean_rows: list[dict[str, Any]],
    X: list[list[float]],
    X_scaled: list[list[float]],
    scaler_stats: list[tuple[float, float]],
    dm: list[list[float]],
    kmeans_k: int = 3,
    seed: int = 42,
) -> dict[str, Any]:
    # A. Comparacion de inicializaciones (k-means++ vs random)
    init_rows: list[dict[str, Any]] = []
    for init in ("k-means++", "random"):
        res = _kmeans_fit(X_scaled, kmeans_k, seed=seed, init=init, n_init=10)
        s = _silhouette_samples_dm(dm, res["labels"])
        init_rows.append(
            {
                "inicializacion": init,
                "inercia": round(float(res["inertia"]), 2),
                "silhouette": round(sum(s) / len(s), 4),
            }
        )

    # B. Comparacion de escaladores (StandardScaler vs MinMaxScaler)
    scaler_rows: list[dict[str, Any]] = []
    for nombre, stats, kind in (
        ("StandardScaler", scaler_stats, "standard"),
        ("MinMaxScaler", _fit_minmax(X), "minmax"),
    ):
        X_t = _apply_scaler(X, stats, kind)
        res = _kmeans_fit(X_t, kmeans_k, seed=seed, init="k-means++", n_init=10)
        dm_t = _pairwise_dist_matrix(X_t)
        s = _silhouette_samples_dm(dm_t, res["labels"])
        scaler_rows.append(
            {
                "escalador": nombre,
                "inercia": round(float(res["inertia"]), 2),
                "silhouette": round(sum(s) / len(s), 4),
            }
        )

    # C. Estabilidad mediante ARI entre 6 semillas
    semillas = [10, 20, 30, 40, 50, 42]
    particiones: dict[int, list[int]] = {}
    for s in semillas:
        res = _kmeans_fit(X_scaled, kmeans_k, seed=s, init="k-means++", n_init=6)
        particiones[s] = res["labels"]

    ari_pairs: list[dict[str, Any]] = []
    matriz = [[1.0 if i == j else 0.0 for j in range(len(semillas))] for i in range(len(semillas))]
    for i in range(len(semillas)):
        for j in range(i + 1, len(semillas)):
            ari = _adjusted_rand_index(particiones[semillas[i]], particiones[semillas[j]])
            ari_pairs.append(
                {"semilla_a": semillas[i], "semilla_b": semillas[j], "ari": round(ari, 4)}
            )
            matriz[i][j] = round(ari, 4)
            matriz[j][i] = round(ari, 4)
    ari_mean = sum(p["ari"] for p in ari_pairs) / len(ari_pairs) if ari_pairs else 0.0

    # D. Modelo final + centroides + deteccion de atipicos por percentil 95
    final = _kmeans_fit(X_scaled, kmeans_k, seed=seed, init="k-means++", n_init=12)
    labels = final["labels"]
    centroids_scaled = final["centroids"]
    centroids_orig = _inverse_standard(centroids_scaled, scaler_stats)
    sil_samples = _silhouette_samples_dm(dm, labels)

    distancias = [
        math.sqrt(_dist_sq(X_scaled[i], centroids_scaled[labels[i]]))
        for i in range(len(X_scaled))
    ]
    sorted_d = sorted(distancias)
    umbral = sorted_d[int(len(sorted_d) * 0.95)] if sorted_d else 0.0

    distances_out: list[dict[str, Any]] = []
    candidatos: list[dict[str, Any]] = []
    for i, r in enumerate(clean_rows):
        atipico = distancias[i] > umbral
        rec = {
            "id": r["id"],
            "cluster": labels[i],
            "distancia": round(distancias[i], 4),
            "silhouette": round(sil_samples[i], 4),
            "atipico": atipico,
        }
        distances_out.append(rec)
        if atipico:
            candidatos.append(rec)
    candidatos.sort(key=lambda r: float(r["distancia"]), reverse=True)

    profiles = _cluster_profiles(clean_rows, labels, kmeans_k)
    name_map = _assign_profile_names(profiles, kmeans_k)
    for p in profiles:
        p["perfil"] = name_map[int(p["cluster"])]

    centroids_table = [
        {
            "cluster": c,
            "perfil": name_map[c],
            **{f: round(centroids_orig[c][j], 2) for j, f in enumerate(SEG_FEATURES)},
        }
        for c in range(kmeans_k)
    ]

    reporte_csv = _rows_to_csv(
        [
            {
                "id": clean_rows[i]["id"],
                "horas_estudio": clean_rows[i]["horas_estudio"],
                "asistencia": clean_rows[i]["asistencia"],
                "actividades": clean_rows[i]["actividades"],
                "participacion": clean_rows[i]["participacion"],
                "cluster": labels[i],
                "perfil_academico": name_map[labels[i]],
                "silhouette_individual": round(sil_samples[i], 4),
                "posible_atipico": 1 if distancias[i] > umbral else 0,
            }
            for i in range(len(clean_rows))
        ],
        [
            "id",
            "horas_estudio",
            "asistencia",
            "actividades",
            "participacion",
            "cluster",
            "perfil_academico",
            "silhouette_individual",
            "posible_atipico",
        ],
    )

    return {
        "inicializaciones": init_rows,
        "escaladores": scaler_rows,
        "estabilidad": {
            "semillas": semillas,
            "matriz_ari": matriz,
            "pares": ari_pairs,
            "ari_promedio": round(ari_mean, 4),
            "interpretacion": (
                "ARI cercano a 1 = agrupaciones muy estables; cercano a 0 = "
                "coincidencia similar al azar"
            ),
        },
        "centroides": centroids_table,
        "perfiles": profiles,
        "atipicos": {
            "percentil": 95,
            "umbral_distancia": round(umbral, 4),
            "total_candidatos": len(candidatos),
            "porcentaje": round(len(candidatos) / len(distancias) * 100.0, 2),
            "distancias": distances_out,
            "top_candidatos": candidatos[:12],
        },
        "silhouette_final": round(sum(sil_samples) / len(sil_samples), 4),
        "reporte_csv": reporte_csv,
        "nota_atipicos": (
            "Una distancia alta solo indica comportamiento distante del centro "
            "de su segmento; no demuestra bajo rendimiento ni error de grupo."
        ),
    }


# ============================================================================
# PRACTICA 09: PCA (varianza, cargas, proyeccion 2D, reconstruccion)
# ============================================================================


def _run_practice_09(
    clean_rows: list[dict[str, Any]],
    X_scaled: list[list[float]],
    labels: list[int],
    name_map: dict[int, str],
    varianza_objetivo: float = 0.85,
) -> dict[str, Any]:
    pca = _run_pca(X_scaled)
    components = pca["components"]
    ratios = pca["explained_ratio"]
    acumulada = pca["cumulative"]

    variance_table = [
        {
            "componente": f"PC{i + 1}",
            "varianza_pct": round(ratios[i] * 100.0, 2),
            "acumulada_pct": round(acumulada[i] * 100.0, 2),
        }
        for i in range(len(ratios))
    ]

    needed = len(ratios)
    for i, acc in enumerate(acumulada):
        if acc >= varianza_objetivo:
            needed = i + 1
            break

    loadings = [
        {
            "componente": f"PC{r + 1}",
            **{f: round(components[r][j], 4) for j, f in enumerate(SEG_FEATURES)},
        }
        for r in range(len(components))
    ]

    coords = _pca_transform(X_scaled, components, len(components))
    scatter_2d = [
        {
            "x": round(coords[i][0], 3),
            "y": round(coords[i][1], 3),
            "cluster": labels[i],
        }
        for i in range(len(coords))
    ]

    mse = _pca_reconstruction_mse(X_scaled, components, needed)

    coords_csv = _rows_to_csv(
        [
            {
                "id": clean_rows[i]["id"],
                "cluster": labels[i],
                "perfil": name_map.get(labels[i], f"Segmento {labels[i]}"),
                "PC1": round(coords[i][0], 4),
                "PC2": round(coords[i][1], 4),
                "PC3": round(coords[i][2], 4),
                "PC4": round(coords[i][3], 4),
            }
            for i in range(len(coords))
        ],
        ["id", "cluster", "perfil", "PC1", "PC2", "PC3", "PC4"],
    )
    varianza_csv = _rows_to_csv(variance_table, ["componente", "varianza_pct", "acumulada_pct"])

    return {
        "varianza_objetivo_pct": round(varianza_objetivo * 100.0, 2),
        "variance_table": variance_table,
        "componentes_necesarias": needed,
        "varianza_conservada_pct": round(acumulada[needed - 1] * 100.0, 2),
        "loadings": loadings,
        "variables": SEG_FEATURES,
        "scatter_2d": scatter_2d,
        "reconstruccion_mse": round(mse, 6),
        "coords_csv": coords_csv,
        "varianza_csv": varianza_csv,
        "nota_pca": (
            "PCA conserva varianza, no garantiza separar clusters; si los grupos "
            "se mezclan en 2D, parte de la informacion puede estar en PC3 o PC4."
        ),
    }


# ============================================================================
# ORQUESTADOR DE PRACTICAS AVANZADAS (06, 07, 08 y 09)
# ============================================================================


def run_advanced_ml_lab(
    kmeans_k: int = 3,
    horas_estudio: float = 6.0,
    asistencia: float = 80.0,
    actividades_entregadas: float = 75.0,
    participacion: float = 7.5,
    seed: int = 42,
) -> dict[str, Any]:
    """Ejecuta las Practicas 06 (optimizacion), 07 (K-Means), 08 (estabilidad
    y atipicos) y 09 (PCA) de forma determinista y auditable."""
    clean_rows, cleaning_report = _get_clean_segmentation()
    X = _rows_to_matrix(clean_rows)
    scaler_stats = _fit_standard(X)
    X_scaled = _apply_scaler(X, scaler_stats, "standard")
    dm = _pairwise_dist_matrix(X_scaled)

    # Caso nuevo del laboratorio: se mapea al espacio de segmentacion
    # (actividades 0-100 -> 0-30; participacion 0-10 -> 0-100).
    seg_case = [
        min(12.0, max(0.0, horas_estudio)),
        min(100.0, max(0.0, asistencia)),
        min(30.0, max(0.0, actividades_entregadas * 0.3)),
        min(100.0, max(0.0, participacion * 10.0)),
    ]
    new_case_vec = [
        (seg_case[j] - scaler_stats[j][0]) / scaler_stats[j][1]
        for j in range(len(SEG_FEATURES))
    ]

    p06 = _run_practice_06_optimization(seed=seed)
    p07_pack = _run_practice_07(
        clean_rows,
        cleaning_report,
        X_scaled,
        scaler_stats,
        dm,
        kmeans_k=kmeans_k,
        seed=seed,
        new_case_vec=new_case_vec,
    )
    p08 = _run_practice_08(
        clean_rows, X, X_scaled, scaler_stats, dm, kmeans_k=kmeans_k, seed=seed
    )
    p09 = _run_practice_09(
        clean_rows,
        X_scaled,
        p07_pack["labels"],
        p07_pack["name_map"],
        varianza_objetivo=0.85,
    )

    return {
        "model_version": "ml-advanced-p06-p09-v1",
        "practice_06": p06,
        "practice_07": p07_pack["result"],
        "practice_08": p08,
        "practice_09": p09,
    }


# ============================================================================
# SEGMENTO DEL CANDIDATO (asignacion rapida al centroide mas cercano)
# ============================================================================


_DEFAULT_SEG_MODEL: dict[str, Any] | None = None


def _get_default_seg_model() -> dict[str, Any]:
    """Modelo K-Means por defecto (k=3) cacheado para asignaciones rapidas."""
    global _DEFAULT_SEG_MODEL
    if _DEFAULT_SEG_MODEL is None:
        clean_rows, _report = _get_clean_segmentation()
        X = _rows_to_matrix(clean_rows)
        stats = _fit_standard(X)
        X_scaled = _apply_scaler(X, stats, "standard")
        res = _kmeans_fit(X_scaled, 3, seed=42, init="k-means++", n_init=12)
        profiles = _cluster_profiles(clean_rows, res["labels"], 3)
        name_map = _assign_profile_names(profiles, 3)
        _DEFAULT_SEG_MODEL = {
            "scaler": stats,
            "centroids_scaled": res["centroids"],
            "centroids_orig": _inverse_standard(res["centroids"], stats),
            "name_map": name_map,
        }
    return _DEFAULT_SEG_MODEL


def assign_candidate_segment(
    horas_estudio: float,
    asistencia: float,
    actividades_entregadas: float,
    participacion: float,
) -> dict[str, Any]:
    """Asigna el caso del candidato al segmento K-Means mas cercano.

    Las entradas del laboratorio (actividades 0-100, participacion 0-10) se
    convierten al espacio de segmentacion (actividades 0-30, participacion
    0-100) antes de estandarizar y medir distancia al centroide."""
    model = _get_default_seg_model()
    seg_case = [
        min(12.0, max(0.0, horas_estudio)),
        min(100.0, max(0.0, asistencia)),
        min(30.0, max(0.0, actividades_entregadas * 0.3)),
        min(100.0, max(0.0, participacion * 10.0)),
    ]
    stats = model["scaler"]
    vec = [(seg_case[j] - stats[j][0]) / stats[j][1] for j in range(len(SEG_FEATURES))]
    c_idx, dist = _nearest_centroid(vec, model["centroids_scaled"])
    orig = model["centroids_orig"][c_idx]
    return {
        "cluster": c_idx,
        "perfil": model["name_map"][c_idx],
        "distancia_centroide": dist,
        "color": CLUSTER_COLORS[c_idx % len(CLUSTER_COLORS)],
        "promedios_grupo": {
            f: round(orig[j], 2) for j, f in enumerate(SEG_FEATURES)
        },
    }
