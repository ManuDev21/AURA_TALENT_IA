"""AURA Match: compatibilidad estimada candidato-vacante (reglas transparentes v1).

Principios:
- Cada factor es explicable y muestra su evidencia.
- Un factor que la vacante no pide se excluye y su peso se redistribuye.
- El resultado es un rango (no una verdad): se ensancha cuando faltan datos del perfil.
- No usa atributos protegidos (edad, genero, foto, estado civil, nacionalidad...).
- Nunca decide: es un insumo para una decision humana.
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from datetime import date

MODEL_VERSION = "match-rules-v1"

WEIGHTS = {
    "required_skills": 0.35,
    "preferred_skills": 0.10,
    "text_similarity": 0.15,
    "experience": 0.15,
    "education": 0.05,
    "languages": 0.08,
    "certifications": 0.04,
    "preferences": 0.03,
    "assessments": 0.05,
}
FACTOR_LABELS = {
    "required_skills": "Habilidades requeridas",
    "preferred_skills": "Habilidades deseables",
    "text_similarity": "Similitud entre perfil y vacante",
    "experience": "Experiencia",
    "education": "Educacion",
    "languages": "Idiomas",
    "certifications": "Certificaciones",
    "preferences": "Preferencias de modalidad",
    "assessments": "Evaluaciones tecnicas",
}
EDUCATION_RANK = {
    "none": 0,
    "secondary": 1,
    "technical": 2,
    "bootcamp": 2,
    "certificate": 2,
    "other": 1,
    "bachelor": 3,
    "master": 4,
    "doctorate": 5,
}
CEFR_RANK = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6, "native": 7}
STOPWORDS = frozenset(
    {
        "para",
        "con",
        "por",
        "los",
        "las",
        "del",
        "una",
        "uno",
        "unos",
        "unas",
        "que",
        "como",
        "mas",
        "sus",
        "sobre",
        "entre",
        "desde",
        "este",
        "esta",
        "estos",
        "estas",
        "donde",
        "cuando",
        "tambien",
        "muy",
        "ser",
        "son",
        "fue",
        "han",
        "hay",
        "tiene",
        "tener",
        "the",
        "and",
        "for",
        "with",
        "from",
        "that",
        "this",
        "are",
        "you",
        "your",
        "our",
        "will",
        "can",
        "job",
        "team",
        "trabajo",
        "equipo",
        "empresa",
        "buscamos",
        "persona",
        "experiencia",
        "anos",
    }
)


# ------------------------------------------------------------------ entradas
@dataclass(frozen=True)
class CandidateSkillIn:
    skill_id: str
    name: str
    proficiency: int


@dataclass(frozen=True)
class JobSkillIn:
    skill_id: str
    name: str
    importance: str
    min_proficiency: int
    weight: float = 1.0


@dataclass(frozen=True)
class Period:
    start: date
    end: date | None
    current: bool


@dataclass
class CandidateIn:
    skills: list[CandidateSkillIn]
    experiences: list[Period]
    education_levels: list[str]
    languages: dict[str, str]
    certifications: list[str]
    modality: str | None
    text: str
    assessment_scores: list[float] = field(default_factory=list)


@dataclass
class JobIn:
    skills: list[JobSkillIn]
    experience_min_years: float
    education_level: str | None
    languages: list[tuple[str, str, bool]]
    certification_requirements: list[str]
    modality: str
    text: str


# ------------------------------------------------------------------- salida
@dataclass
class Factor:
    code: str
    label: str
    weight: float
    score: float
    detail: str
    evidence: list[str]


@dataclass
class Requirement:
    kind: str
    label: str
    status: str
    detail: str
    required: bool


@dataclass
class MatchOutcome:
    score: float
    score_low: float
    score_high: float
    factors: list[Factor]
    requirements: list[Requirement]
    strengths: list[str]
    gaps: list[dict[str, object]]
    data_completeness: float
    model_version: str = MODEL_VERSION


# ---------------------------------------------------------------- utilidades
def _norm(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))


def _tokens(text: str) -> Counter[str]:
    words = re.findall(r"[a-z0-9+#.]{3,}", _norm(text))
    return Counter(w.strip(".") for w in words if w.strip(".") not in STOPWORDS)


def text_similarity(a: str, b: str) -> float:
    """Coseno sobre bolsa de palabras con tf logaritmica (sin datos externos)."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    wa = {t: 1 + math.log(c) for t, c in ta.items()}
    wb = {t: 1 + math.log(c) for t, c in tb.items()}
    dot = sum(wa[t] * wb[t] for t in wa.keys() & wb.keys())
    return dot / (math.sqrt(sum(v * v for v in wa.values())) * math.sqrt(sum(v * v for v in wb.values())))


def experience_years(periods: list[Period], today: date | None = None) -> float:
    """Suma de periodos sin contar dos veces los que se traslapan."""
    today = today or date.today()
    spans = sorted((p.start, p.end or today if not p.current else today) for p in periods if p.start)
    total, cur_start, cur_end = 0, None, None
    for start, end in spans:
        if end < start:
            continue
        if cur_end is None or start > cur_end:
            if cur_end is not None:
                total += (cur_end - cur_start).days
            cur_start, cur_end = start, end
        else:
            cur_end = max(cur_end, end)
    if cur_end is not None:
        total += (cur_end - cur_start).days
    return total / 365.25


# ------------------------------------------------------------------- motor
def compute_match(candidate: CandidateIn, job: JobIn, today: date | None = None) -> MatchOutcome:
    owned = {s.skill_id: s for s in candidate.skills}
    factors: list[Factor] = []
    requirements: list[Requirement] = []
    strengths: list[str] = []
    gaps: list[dict[str, object]] = []

    def skill_factor(code: str, importance: str) -> None:
        items = [s for s in job.skills if s.importance == importance]
        if not items:
            return
        earned, total, evidence = 0.0, 0.0, []
        for js in items:
            total += js.weight
            mine = owned.get(js.skill_id)
            if mine is None:
                status, part = "missing", 0.0
                gaps.append(
                    {
                        "kind": "skill",
                        "skill_id": js.skill_id,
                        "name": js.name,
                        "required": importance == "required",
                        "detail": f"No declarada (nivel minimo {js.min_proficiency})",
                    }
                )
            elif mine.proficiency >= js.min_proficiency:
                status, part = "met", 1.0
                if importance == "required":
                    strengths.append(js.name)
            else:
                status, part = "partial", mine.proficiency / js.min_proficiency
                gaps.append(
                    {
                        "kind": "skill",
                        "skill_id": js.skill_id,
                        "name": js.name,
                        "required": importance == "required",
                        "detail": f"Nivel {mine.proficiency} de {js.min_proficiency} requerido",
                    }
                )
            earned += js.weight * part
            requirements.append(
                Requirement(
                    "skill",
                    js.name,
                    status,
                    f"Tu nivel: {mine.proficiency if mine else '-'} / minimo: {js.min_proficiency}",
                    importance == "required",
                )
            )
            evidence.append(f"{js.name}: {status}")
        met = sum(
            1
            for r in requirements
            if r.kind == "skill" and r.required == (importance == "required") and r.status == "met"
        )
        factors.append(
            Factor(
                code,
                FACTOR_LABELS[code],
                WEIGHTS[code],
                earned / total,
                f"{met} de {len(items)} cumplidas",
                evidence,
            )
        )

    skill_factor("required_skills", "required")
    skill_factor("preferred_skills", "preferred")

    sim = text_similarity(candidate.text, job.text)
    # El coseno entre textos distintos rara vez supera 0.5; se reescala para que sea interpretable
    sim_score = min(1.0, sim / 0.45)
    shared = sorted((_tokens(candidate.text).keys() & _tokens(job.text).keys()), key=len, reverse=True)[:8]
    factors.append(
        Factor(
            "text_similarity",
            FACTOR_LABELS["text_similarity"],
            WEIGHTS["text_similarity"],
            sim_score,
            f"Coincidencia de terminos {round(sim * 100)}%",
            shared,
        )
    )

    years = experience_years(candidate.experiences, today)
    if job.experience_min_years > 0:
        score = min(1.0, years / job.experience_min_years)
        status = "met" if score >= 1 else "partial" if years > 0 else "missing"
        requirements.append(
            Requirement(
                "experience",
                f"{job.experience_min_years:g}+ anos de experiencia",
                status,
                f"Registras {years:.1f} anos",
                True,
            )
        )
        if status == "met":
            strengths.append("Experiencia suficiente")
        else:
            gaps.append(
                {
                    "kind": "experience",
                    "name": "Experiencia",
                    "required": True,
                    "detail": f"{years:.1f} de {job.experience_min_years:g} anos",
                }
            )
        factors.append(
            Factor(
                "experience",
                FACTOR_LABELS["experience"],
                WEIGHTS["experience"],
                score,
                f"{years:.1f} de {job.experience_min_years:g} anos",
                [],
            )
        )

    if job.education_level and job.education_level != "none":
        need = EDUCATION_RANK.get(job.education_level, 0)
        have = max((EDUCATION_RANK.get(e, 0) for e in candidate.education_levels), default=0)
        score = 1.0 if have >= need else 0.5 if have == need - 1 else 0.0
        status = "met" if score == 1 else "partial" if score else "missing"
        requirements.append(
            Requirement(
                "education",
                f"Educacion: {job.education_level}",
                status,
                "Cumple el nivel" if score == 1 else "Nivel registrado menor",
                True,
            )
        )
        if status != "met":
            gaps.append(
                {
                    "kind": "education",
                    "name": "Educacion",
                    "required": True,
                    "detail": "Nivel menor al solicitado",
                }
            )
        factors.append(
            Factor("education", FACTOR_LABELS["education"], WEIGHTS["education"], score, status, [])
        )

    if job.languages:
        earned, total, evidence = 0.0, 0.0, []
        for code, min_level, required in job.languages:
            w = 1.0 if required else 0.5
            total += w
            have = CEFR_RANK.get(candidate.languages.get(code, ""), 0)
            need = CEFR_RANK.get(min_level, 1)
            part = 1.0 if have >= need else have / need
            earned += w * part
            status = "met" if part >= 1 else "partial" if have else "missing"
            requirements.append(
                Requirement(
                    "language",
                    f"Idioma {code.upper()} {min_level}",
                    status,
                    f"Tu nivel: {candidate.languages.get(code, 'no registrado')}",
                    required,
                )
            )
            if status == "met":
                strengths.append(f"Idioma {code.upper()}")
            elif required:
                gaps.append(
                    {
                        "kind": "language",
                        "name": f"Idioma {code.upper()}",
                        "required": True,
                        "detail": f"Se pide {min_level}",
                    }
                )
            evidence.append(f"{code.upper()}: {status}")
        factors.append(
            Factor(
                "languages",
                FACTOR_LABELS["languages"],
                WEIGHTS["languages"],
                earned / total,
                f"{sum(1 for e in evidence if e.endswith('met'))} de {len(job.languages)}",
                evidence,
            )
        )

    if job.certification_requirements:
        owned_certs = [_norm(c) for c in candidate.certifications]
        hits = 0
        for req in job.certification_requirements:
            words = [w for w in _tokens(req) if len(w) > 3]
            ok = (
                any(sum(w in c for w in words) >= max(1, len(words) // 2) for c in owned_certs)
                if words
                else False
            )
            hits += ok
            requirements.append(
                Requirement(
                    "certification",
                    req,
                    "met" if ok else "missing",
                    "Certificacion relacionada registrada" if ok else "No registrada",
                    True,
                )
            )
        factors.append(
            Factor(
                "certifications",
                FACTOR_LABELS["certifications"],
                WEIGHTS["certifications"],
                hits / len(job.certification_requirements),
                f"{hits} de {len(job.certification_requirements)}",
                [],
            )
        )

    if candidate.modality:
        ok = candidate.modality in (job.modality, "any")
        factors.append(
            Factor(
                "preferences",
                FACTOR_LABELS["preferences"],
                WEIGHTS["preferences"],
                1.0 if ok else 0.3,
                "Modalidad compatible"
                if ok
                else f"Prefieres {candidate.modality}; la vacante es {job.modality}",
                [],
            )
        )

    if candidate.assessment_scores:
        avg = sum(candidate.assessment_scores) / len(candidate.assessment_scores)
        factors.append(
            Factor(
                "assessments",
                FACTOR_LABELS["assessments"],
                WEIGHTS["assessments"],
                avg / 100,
                f"Promedio {round(avg)} en {len(candidate.assessment_scores)} evaluacion(es)",
                [],
            )
        )

    total_weight = sum(f.weight for f in factors)
    for f in factors:
        f.weight = f.weight / total_weight
    score = sum(f.weight * f.score for f in factors) * 100

    # Completitud de los datos que sustentan el calculo -> amplitud del rango
    checks = [
        bool(candidate.skills),
        bool(candidate.experiences),
        bool(candidate.education_levels),
        bool(candidate.languages),
        bool(candidate.text.strip()),
        candidate.modality is not None,
    ]
    completeness = sum(checks) / len(checks)
    half = 5 + 15 * (1 - completeness)
    return MatchOutcome(
        score=round(score, 1),
        score_low=round(max(0.0, score - half), 1),
        score_high=round(min(100.0, score + half), 1),
        factors=sorted(factors, key=lambda f: f.weight, reverse=True),
        requirements=requirements,
        strengths=list(dict.fromkeys(strengths)),
        gaps=gaps,
        data_completeness=round(completeness, 2),
    )
