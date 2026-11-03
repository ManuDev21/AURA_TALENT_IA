"""Deteccion de intenciones del AURA Orchestrator (reglas en espanol, sin LLM).

Cada regla asocia frases clave a un comando del catalogo `ai_commands`. La confianza crece con la
cantidad y especificidad de las frases encontradas. Si nada coincide se devuelve `unknown` y el cliente
puede resolver navegacion simple de forma local.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Rule:
    code: str
    phrases: tuple[str, ...]
    boost: tuple[str, ...] = ()


@dataclass
class Intent:
    code: str
    confidence: float
    entities: dict[str, str] = field(default_factory=dict)


RULES: tuple[Rule, ...] = (
    Rule("aura.help", ("ayuda", "que puedes hacer", "que sabes hacer", "comandos", "como funcionas")),
    Rule(
        "skills.gaps",
        (
            "habilidades necesito",
            "que necesito mejorar",
            "que me falta",
            "mis brechas",
            "brechas de habilidades",
            "que debo aprender",
            "que deberia aprender",
        ),
        ("mejorar", "aprender", "falta"),
    ),
    Rule(
        "match.compare",
        (
            "compara mi perfil",
            "mi compatibilidad",
            "que tan compatible",
            "compatibilidad con",
            "encajo en",
            "soy compatible",
        ),
        ("vacante", "puesto"),
    ),
    Rule(
        "profile.analyze",
        (
            "analiza mi perfil",
            "como esta mi perfil",
            "revisa mi perfil",
            "evalua mi perfil",
            "mi perfil esta completo",
        ),
    ),
    Rule("cv.analyze", ("analiza mi cv", "revisa mi cv", "mejora mi cv", "analiza mi curriculum")),
    Rule("cv.create", ("crea mi cv", "crear un cv", "genera mi cv", "nuevo cv", "crea un cv")),
    Rule(
        "career.generate",
        ("genera una ruta", "ruta profesional", "plan de carrera", "crea una ruta", "ruta de carrera"),
    ),
    Rule(
        "jobs.search",
        (
            "busca vacantes",
            "buscar vacantes",
            "busca empleos",
            "busca trabajo",
            "vacantes de",
            "empleos de",
            "ofertas de",
        ),
    ),
    Rule("candidates.filter_minimum", ("requisitos minimos", "cumplen los requisitos", "cumplen requisitos")),
    Rule(
        "candidates.analyze",
        (
            "analiza los candidatos",
            "resume los candidatos",
            "como van los candidatos",
            "resumen de candidatos",
            "analiza candidatos",
        ),
    ),
    Rule("job.create", ("crea una vacante", "nueva vacante", "publicar una vacante", "crear vacante")),
    Rule("gaps.aggregate", ("principales brechas", "brechas entre candidatos")),
    Rule("report.generate", ("reporte de mi perfil", "informe de mi perfil")),
    Rule("vacancy.report", ("reporte de esta vacante", "reporte de la vacante", "informe de la vacante")),
)

_SEARCH_TAIL = re.compile(r"(?:vacantes|empleos|trabajo|ofertas)\s+(?:de|para|como|en)\s+(.+)$")


def normalize(text: str) -> str:
    text = "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))
    text = re.sub(r"[¿?¡!.,;:\"']", " ", text)
    text = re.sub(r"^\s*(oye\s+|hola\s+)?aura\b", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _contains(text: str, phrase: str) -> bool:
    return re.search(rf"(^|\s){re.escape(phrase)}(\s|$)", text) is not None


def detect(text: str) -> Intent:
    clean = normalize(text)
    if not clean:
        return Intent("unknown", 0.0)
    best: tuple[float, Rule] | None = None
    for rule in RULES:
        hits = [p for p in rule.phrases if _contains(clean, p)]
        if not hits:
            continue
        score = (
            0.6
            + min(0.3, sum(len(p) for p in hits) / 60)
            + 0.05 * sum(_contains(clean, b) for b in rule.boost)
        )
        if best is None or score > best[0]:
            best = (score, rule)
    if best is None:
        return Intent("unknown", 0.0)
    intent = Intent(best[1].code, round(min(0.99, best[0]), 2))
    if intent.code == "jobs.search":
        m = _SEARCH_TAIL.search(clean)
        if m:
            intent.entities["query"] = m.group(1).strip()[:80]
    return intent
