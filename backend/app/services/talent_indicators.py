"""Indicadores de talento por categoria (reglas v1).

Son indicadores generados por el sistema a partir de lo que la persona declara;
no miden desempeno real y no deben presentarse como verdades sobre la persona.
"""

import math
from collections import defaultdict
from decimal import Decimal

from app.models import CandidateSkill
from app.schemas.skills import Indicator, IndicatorFactor, IndicatorsRead

METHOD = "rules-v1"
_SATURATION = 2.5


def _skill_weight(proficiency: int, years: Decimal | None) -> float:
    years_factor = min(float(years or 0), 5.0) / 5.0
    return (proficiency / 5.0) * (1.0 + years_factor)


def compute_indicators(skills: list[CandidateSkill]) -> IndicatorsRead:
    grouped: dict[tuple[str, str], list[CandidateSkill]] = defaultdict(list)
    for cs in skills:
        category = cs.skill.category
        key = (category.code, category.name) if category else ("other", "Otras")
        grouped[key].append(cs)

    indicators = []
    for (code, name), items in grouped.items():
        total = sum(_skill_weight(cs.proficiency, cs.years_experience) for cs in items)
        score = round(100 * (1 - math.exp(-total / _SATURATION)))
        top = sorted(items, key=lambda cs: _skill_weight(cs.proficiency, cs.years_experience), reverse=True)[
            :5
        ]
        indicators.append(
            Indicator(
                category_code=code,
                category_name=name,
                score=score,
                skills_count=len(items),
                factors=[
                    IndicatorFactor(
                        skill=cs.skill.name, proficiency=cs.proficiency, years_experience=cs.years_experience
                    )
                    for cs in top
                ],
            )
        )
    indicators.sort(key=lambda i: i.score, reverse=True)

    return IndicatorsRead(
        indicators=indicators,
        method=(
            "Cada habilidad aporta segun el nivel declarado (1-5) y los anos de experiencia (hasta 5). "
            "La suma por categoria se transforma en una escala 0-100 que crece mas despacio conforme aumenta."
        ),
        data_used=["Habilidades declaradas", "Nivel autoevaluado", "Anos de experiencia por habilidad"],
        limitations=[
            "Se basa en autoevaluacion; no verifica el dominio real.",
            "No considera evaluaciones, proyectos ni experiencia laboral en esta version.",
            "Categorias con pocas habilidades registradas pueden verse subestimadas.",
        ],
        disclaimer="Indicadores generados por el sistema. No son una medicion definitiva de tus capacidades.",
    )
