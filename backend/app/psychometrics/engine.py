"""Motor de puntuacion de evaluaciones.

Funciones puras (sin base de datos) para que las reglas sean verificables:
- correct_count: evaluaciones tecnicas y de razonamiento (respuesta correcta/incorrecta).
- rubric: evaluaciones situacionales con rubricas definidas de antemano.
- mean / weighted_mean: instrumentos psicometricos experimentales (tendencias por dimension).

Los resultados describen TENDENCIAS observadas en las respuestas, nunca diagnosticos.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from typing import Any

ENGINE_VERSION = "engine-v1"
MIN_ITEM_MS = 1200


@dataclass(frozen=True)
class OptionDef:
    id: str
    label: str
    is_correct: bool | None = None
    rubric_score: float | None = None
    rubric_rationale: str | None = None


@dataclass(frozen=True)
class QuestionDef:
    id: str
    question_type: str
    stem: str
    dimension_id: str | None = None
    reverse_keyed: bool = False
    weight: float = 1.0
    is_attention_check: bool = False
    expected_value: float | None = None
    scale_min: float = 1
    scale_max: float = 5
    scale_labels: dict[str, str] = field(default_factory=dict)
    options: tuple[OptionDef, ...] = ()
    explanation: str | None = None


@dataclass(frozen=True)
class AnswerDef:
    option_id: str | None = None
    numeric_value: float | None = None
    time_ms: int | None = None


@dataclass(frozen=True)
class RuleDef:
    dimension_id: str | None
    method: str
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class BandDef:
    dimension_id: str | None
    min_score: float
    max_score: float
    band: str
    text: str
    recommendations: tuple[str, ...] = ()


@dataclass
class DimensionOutcome:
    dimension_id: str
    raw: float
    normalized: float
    band: str
    interpretation: str
    recommendations: list[str]
    evidence: list[dict[str, Any]]


@dataclass
class ScoreOutcome:
    overall_score: float | None
    overall_band: str | None
    overall_interpretation: str | None
    overall_recommendations: list[str]
    dimensions: list[DimensionOutcome]
    quality_flags: dict[str, Any]
    answered: int
    total: int


class IncompleteAttemptError(ValueError):
    pass


def _band(bands: list[BandDef], dimension_id: str | None, score: float) -> BandDef | None:
    rounded = round(score, 2)
    return next(
        (b for b in bands if b.dimension_id == dimension_id and b.min_score <= rounded <= b.max_score),
        None,
    )


def _adjusted(question: QuestionDef, value: float) -> float:
    return question.scale_min + question.scale_max - value if question.reverse_keyed else value


def _label(question: QuestionDef, answer: AnswerDef | None) -> str | None:
    if answer is None:
        return None
    if answer.option_id:
        return next((o.label for o in question.options if o.id == answer.option_id), None)
    if answer.numeric_value is not None:
        key = str(int(answer.numeric_value))
        return question.scale_labels.get(key, key)
    return None


def quality_checks(questions: list[QuestionDef], answers: dict[str, AnswerDef]) -> dict[str, Any]:
    """Senales de calidad de respuesta. Se informan, no se usan para castigar ni descartar."""
    flags: dict[str, Any] = {}
    likert = [q for q in questions if q.question_type == "likert" and not q.is_attention_check]
    values = [
        answers[q.id].numeric_value
        for q in likert
        if q.id in answers and answers[q.id].numeric_value is not None
    ]
    if len(values) >= 8 and len(set(values)) == 1:
        flags["straightlining"] = True
    for q in questions:
        if q.is_attention_check and q.expected_value is not None:
            given = answers.get(q.id)
            if given is None or given.numeric_value != q.expected_value:
                flags["attention_check_failed"] = True
    times = [a.time_ms for a in answers.values() if a.time_ms]
    if len(times) >= 5 and statistics.median(times) < MIN_ITEM_MS:
        flags["too_fast"] = True
    return flags


def score(
    questions: list[QuestionDef],
    answers: dict[str, AnswerDef],
    rules: list[RuleDef],
    bands: list[BandDef],
) -> ScoreOutcome:
    scored_items = [q for q in questions if not q.is_attention_check]
    dimensions: list[DimensionOutcome] = []
    overall: float | None = None

    for rule in rules:
        if rule.method in {"mean", "weighted_mean", "sum"} and rule.dimension_id:
            dimensions.append(_likert_dimension(rule, scored_items, answers, bands))
        elif rule.method == "correct_count":
            overall = _correct_count(scored_items, answers)
        elif rule.method == "rubric":
            overall = _rubric(scored_items, answers, float(rule.params.get("max_per_question", 3)))

    band = _band(bands, None, overall) if overall is not None else None
    return ScoreOutcome(
        overall_score=round(overall, 2) if overall is not None else None,
        overall_band=band.band if band else None,
        overall_interpretation=band.text if band else None,
        overall_recommendations=list(band.recommendations) if band else [],
        dimensions=dimensions,
        quality_flags=quality_checks(questions, answers),
        answered=sum(1 for q in questions if q.id in answers),
        total=len(questions),
    )


def _likert_dimension(
    rule: RuleDef, items: list[QuestionDef], answers: dict[str, AnswerDef], bands: list[BandDef]
) -> DimensionOutcome:
    dim_items = [q for q in items if q.dimension_id == rule.dimension_id]
    answered = [
        (q, answers[q.id]) for q in dim_items if q.id in answers and answers[q.id].numeric_value is not None
    ]
    required = float(rule.params.get("min_answered_ratio", 1.0))
    if not dim_items or len(answered) / len(dim_items) < required:
        raise IncompleteAttemptError("Faltan respuestas para calcular todas las dimensiones.")

    adjusted = [(q, _adjusted(q, float(a.numeric_value or 0)), a) for q, a in answered]
    lo, hi = dim_items[0].scale_min, dim_items[0].scale_max
    if rule.method == "weighted_mean":
        total_w = sum(q.weight for q, _, _ in adjusted)
        raw = sum(v * q.weight for q, v, _ in adjusted) / total_w
    elif rule.method == "sum":
        raw = sum(v for _, v, _ in adjusted) / len(adjusted)
    else:
        raw = statistics.fmean(v for _, v, _ in adjusted)
    normalized = max(0.0, min(100.0, (raw - lo) / (hi - lo) * 100))
    band = _band(bands, rule.dimension_id, normalized)

    # Evidencia: los items que mas empujan hacia la banda obtenida
    ordered = sorted(adjusted, key=lambda t: t[1], reverse=normalized >= 50)
    evidence = [
        {
            "stem": q.stem,
            "answer": _label(q, a),
            "reverse_keyed": q.reverse_keyed,
            "contribution": round((v - lo) / (hi - lo) * 100),
        }
        for q, v, a in ordered[:2]
    ]
    return DimensionOutcome(
        dimension_id=str(rule.dimension_id),
        raw=round(raw, 3),
        normalized=round(normalized, 2),
        band=band.band if band else "moderate",
        interpretation=band.text if band else "",
        recommendations=list(band.recommendations) if band else [],
        evidence=evidence,
    )


def _correct_count(items: list[QuestionDef], answers: dict[str, AnswerDef]) -> float:
    total = sum(q.weight for q in items) or 1
    earned = 0.0
    for q in items:
        answer = answers.get(q.id)
        chosen = next((o for o in q.options if answer and o.id == answer.option_id), None)
        if chosen and chosen.is_correct:
            earned += q.weight
    return earned / total * 100


def _rubric(items: list[QuestionDef], answers: dict[str, AnswerDef], max_per_question: float) -> float:
    if not items:
        return 0.0
    earned = 0.0
    for q in items:
        answer = answers.get(q.id)
        chosen = next((o for o in q.options if answer and o.id == answer.option_id), None)
        earned += float(chosen.rubric_score or 0) if chosen else 0.0
    return earned / (max_per_question * len(items)) * 100


def review(questions: list[QuestionDef], answers: dict[str, AnswerDef]) -> list[dict[str, Any]]:
    """Retroalimentacion por pregunta (solo para evaluaciones con respuesta correcta o rubrica)."""
    items = []
    for q in questions:
        if q.question_type == "likert":
            continue
        answer = answers.get(q.id)
        chosen = next((o for o in q.options if answer and o.id == answer.option_id), None)
        correct = next((o for o in q.options if o.is_correct), None)
        best = max(q.options, key=lambda o: o.rubric_score or 0, default=None)
        items.append(
            {
                "question_id": q.id,
                "stem": q.stem,
                "selected": chosen.label if chosen else None,
                "is_correct": bool(chosen and chosen.is_correct) if correct else None,
                "correct": correct.label if correct else None,
                "rubric_score": chosen.rubric_score if chosen and chosen.rubric_score is not None else None,
                "rationale": chosen.rubric_rationale if chosen else None,
                "best_option": best.label if best and best.rubric_score is not None else None,
                "explanation": q.explanation,
            }
        )
    return items
