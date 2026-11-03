"""Construye las secciones de un CV a partir del perfil del candidato.

El CV solo usa datos que la persona registro en su perfil: nunca inventa experiencia,
habilidades, certificaciones ni educacion.
"""

from collections import defaultdict
from datetime import date
from typing import Any

from app.models import Project
from app.schemas.candidate import CandidateOverview

TITLES: dict[str, str | None] = {
    "header": None,
    "summary": "Perfil profesional",
    "experience": "Experiencia",
    "education": "Educación",
    "projects": "Proyectos",
    "skills": "Habilidades",
    "certifications": "Certificaciones",
    "languages": "Idiomas",
    "links": "Enlaces",
    "portfolio": "Portfolio",
    "custom": "Información adicional",
}

ORDER_BY_TARGET: dict[str, list[str]] = {
    "general": [
        "header",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "certifications",
        "languages",
    ],
    "internship": [
        "header",
        "summary",
        "education",
        "projects",
        "skills",
        "experience",
        "certifications",
        "languages",
    ],
    "technical": [
        "header",
        "summary",
        "skills",
        "experience",
        "projects",
        "education",
        "certifications",
        "languages",
    ],
}

SKILL_PRIORITY: dict[str, list[str]] = {
    "frontend": ["frontend", "design", "testing"],
    "backend": ["backend", "database", "devops"],
    "data": ["data", "ai_ml", "database"],
    "software": ["backend", "frontend", "devops", "testing"],
}

LANGUAGE_NAMES = {
    "es": "Español",
    "en": "Inglés",
    "pt": "Portugués",
    "fr": "Francés",
    "de": "Alemán",
    "it": "Italiano",
    "zh": "Chino",
    "ja": "Japonés",
    "ko": "Coreano",
}
LEVEL_NAMES = {"native": "Nativo"}


def _month(value: date | None) -> str | None:
    return value.strftime("%Y-%m") if value else None


def section_order(target: str) -> list[str]:
    if target == "internship":
        return ORDER_BY_TARGET["internship"]
    if target in SKILL_PRIORITY:
        return ORDER_BY_TARGET["technical"]
    return ORDER_BY_TARGET["general"]


def build_content(
    section_type: str,
    data: CandidateOverview,
    projects: list[Project],
    target: str,
    portfolio_url: str | None = None,
) -> dict[str, Any]:
    profile = data.profile
    if section_type == "header":
        location = ", ".join(p for p in (profile.location_city, profile.location_country) if p) or None
        links = [
            {"label": link.label or link.link_type.capitalize(), "url": link.url} for link in data.links[:6]
        ]
        if portfolio_url:
            links.append({"label": "Portfolio", "url": portfolio_url})
        return {
            "full_name": data.full_name,
            "headline": profile.headline,
            "email": data.email,
            "phone": None,
            "location": location,
            "links": links,
        }
    if section_type == "summary":
        return {"text": profile.summary or ""}
    if section_type == "experience":
        return {
            "items": [
                {
                    "title": e.title,
                    "company": e.company_name,
                    "location": e.location,
                    "start": _month(e.start_date),
                    "end": _month(e.end_date),
                    "current": e.is_current,
                    "description": e.description,
                    "achievements": e.achievements,
                }
                for e in data.experiences
            ]
        }
    if section_type == "education":
        return {
            "items": [
                {
                    "institution": e.institution,
                    "degree": e.degree,
                    "field": e.field_of_study,
                    "start": _month(e.start_date),
                    "end": _month(e.end_date),
                    "current": e.is_current,
                    "description": e.description,
                }
                for e in data.education
            ]
        }
    if section_type == "projects":
        return {
            "items": [
                {
                    "title": p.title,
                    "role": p.role,
                    "description": p.description,
                    "url": p.demo_url or p.repo_url,
                    "technologies": [s.name for s in p.skills],
                }
                for p in projects
            ]
        }
    if section_type == "skills":
        grouped: dict[tuple[str, str], list[tuple[int, str]]] = defaultdict(list)
        for entry in data.skills:
            category = entry.skill.category
            key = (category.code, category.name) if category else ("other", "Otras")
            grouped[key].append((entry.proficiency, entry.skill.name))
        priority = SKILL_PRIORITY.get(target, [])

        def rank(key: tuple[str, str]) -> tuple[int, int]:
            code = key[0]
            return (priority.index(code) if code in priority else len(priority), -len(grouped[key]))

        return {
            "groups": [
                {"category": name, "skills": [s for _, s in sorted(grouped[(code, name)], reverse=True)]}
                for code, name in sorted(grouped, key=rank)
            ]
        }
    if section_type == "certifications":
        return {
            "items": [
                {"name": c.name, "issuer": c.issuer, "date": _month(c.issued_at), "url": c.credential_url}
                for c in data.certifications
            ]
        }
    if section_type == "languages":
        return {
            "items": [
                {
                    "language": LANGUAGE_NAMES.get(lang.language_code, lang.language_code.upper()),
                    "level": LEVEL_NAMES.get(lang.level, lang.level),
                }
                for lang in data.languages
            ]
        }
    return {"items": []} if section_type in {"links", "portfolio"} else {"text": ""}


def _has_data(section_type: str, content: dict[str, Any]) -> bool:
    if section_type in {"header", "summary"}:
        return True
    if section_type == "skills":
        return bool(content.get("groups"))
    return bool(content.get("items") or content.get("text"))


def build_sections(
    data: CandidateOverview, projects: list[Project], target: str, portfolio_url: str | None = None
) -> list[dict[str, Any]]:
    sections = []
    for section_type in section_order(target):
        content = build_content(section_type, data, projects, target, portfolio_url)
        if _has_data(section_type, content):
            sections.append(
                {
                    "section_type": section_type,
                    "title": TITLES[section_type],
                    "is_visible": True,
                    "content": content,
                }
            )
    return sections
