"""Metricas de reclutamiento (logica pura): embudo, tiempo por etapa y tendencia semanal."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta

PIPELINE = ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "FINAL_REVIEW", "HIRED"]
STAGE_NAMES = {
    "APPLIED": "Postulado",
    "SCREENING": "Revision de perfil",
    "ASSESSMENT": "Evaluacion",
    "INTERVIEW": "Entrevista",
    "FINAL_REVIEW": "Revision final",
    "HIRED": "Seleccionado",
    "CLOSED": "Proceso concluido",
}
MIN_GROUP = 5
# Etapas que se pueden saltar: no sirven como base para la conversion de la etapa siguiente
OPTIONAL_STAGES = {"ASSESSMENT"}


@dataclass(frozen=True)
class AppRow:
    id: str
    applied_at: datetime
    current_stage: str
    status: str


@dataclass(frozen=True)
class HistoryRow:
    application_id: str
    to_stage: str
    created_at: datetime


def funnel(apps: list[AppRow], history: list[HistoryRow]) -> list[dict]:
    """Cuantas postulaciones alcanzaron cada etapa (aunque luego avanzaran o se cerraran)."""
    reached: dict[str, set[str]] = defaultdict(set)
    for a in apps:
        reached["APPLIED"].add(a.id)
        reached[a.current_stage].add(a.id)
    for h in history:
        reached[h.to_stage].add(h.application_id)
    total = len(apps)
    out, prev = [], total
    for stage in PIPELINE:
        n = len(reached[stage])
        out.append(
            {
                "stage": stage,
                "label": STAGE_NAMES[stage],
                "count": n,
                "rate_from_start": round(n / total * 100, 1) if total else 0.0,
                "rate_from_previous": round(n / prev * 100, 1) if prev else 0.0,
            }
        )
        if stage not in OPTIONAL_STAGES:
            prev = n or prev
    return out


def stage_durations(apps: list[AppRow], history: list[HistoryRow], now: datetime) -> list[dict]:
    """Dias promedio en cada etapa: desde que se entra hasta el siguiente cambio (o hoy si sigue ahi)."""
    by_app: dict[str, list[HistoryRow]] = defaultdict(list)
    for h in history:
        by_app[h.application_id].append(h)
    spans: dict[str, list[float]] = defaultdict(list)
    for a in apps:
        events = [("APPLIED", a.applied_at)] + [
            (h.to_stage, h.created_at) for h in sorted(by_app[a.id], key=lambda x: x.created_at)
        ]
        for i, (stage, start) in enumerate(events):
            if stage in ("HIRED", "CLOSED"):
                break
            end = events[i + 1][1] if i + 1 < len(events) else (now if a.status == "active" else None)
            if end is not None:
                spans[stage].append(max(0.0, (end - start).total_seconds() / 86400))
    return [
        {"stage": s, "label": STAGE_NAMES[s], "avg_days": round(sum(v) / len(v), 1), "samples": len(v)}
        for s in PIPELINE[:-1]
        if (v := spans.get(s))
    ]


def weekly(apps: list[AppRow], now: datetime, weeks: int = 8) -> list[dict]:
    """Postulaciones recibidas por semana en las ultimas `weeks` semanas (para la tendencia)."""
    start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    buckets = [start - timedelta(weeks=i) for i in range(weeks - 1, -1, -1)]
    counts = Counter()
    for a in apps:
        for b in reversed(buckets):
            if a.applied_at >= b:
                counts[b] += 1
                break
    return [{"week_start": b.date().isoformat(), "count": counts[b]} for b in buckets]


def outcomes(apps: list[AppRow]) -> dict[str, int]:
    """Resumen de resultados: activas, contratados, procesos cerrados y retiros."""
    return {
        "active": sum(1 for a in apps if a.status == "active" and a.current_stage not in ("HIRED", "CLOSED")),
        "hired": sum(1 for a in apps if a.current_stage == "HIRED"),
        "closed": sum(1 for a in apps if a.current_stage == "CLOSED"),
        "withdrawn": sum(1 for a in apps if a.status == "withdrawn"),
    }
