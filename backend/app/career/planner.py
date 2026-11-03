"""Planificador de carrera: cobertura de roles y construccion de rutas (grafo) hacia un rol objetivo.

Logica pura: recibe habilidades del candidato y recursos disponibles; devuelve estructuras de datos.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.career.roles import ROLES, RoleDef


@dataclass(frozen=True)
class OwnedSkill:
    slug: str
    name: str
    level: int


@dataclass(frozen=True)
class Resource:
    id: str
    title: str
    url: str
    level: str | None
    hours: float | None
    skill_slugs: tuple[str, ...]


@dataclass
class RoleCoverage:
    code: str
    title: str
    description: str
    coverage: float
    met: list[str]
    partial: list[str]
    missing: list[str]


@dataclass
class PlanNode:
    key: str
    node_type: str
    label: str
    status: str
    pos: tuple[float, float, float]
    ref: str | None = None
    meta: dict = field(default_factory=dict)


@dataclass
class PlanEdge:
    source: str
    target: str
    edge_type: str = "leads_to"


def role_coverage(role: RoleDef, owned: dict[str, OwnedSkill], names: dict[str, str]) -> RoleCoverage:
    """Cobertura ponderada: nucleo pesa 2, complementaria 1; los niveles parciales cuentan en proporcion."""
    earned = total = 0.0
    met, partial, missing = [], [], []
    for rs in role.skills:
        w = 2.0 if rs.core else 1.0
        total += w
        mine = owned.get(rs.slug)
        label = names.get(rs.slug, rs.slug)
        if mine is None:
            missing.append(label)
        elif mine.level >= rs.level:
            earned += w
            met.append(label)
        else:
            earned += w * mine.level / rs.level
            partial.append(label)
    return RoleCoverage(
        role.code, role.title, role.description, round(earned / total * 100, 1), met, partial, missing
    )


def rank_roles(owned: dict[str, OwnedSkill], names: dict[str, str]) -> list[RoleCoverage]:
    return sorted((role_coverage(r, owned, names) for r in ROLES.values()), key=lambda c: -c.coverage)


def _resource_for(slug: str, current_level: int, resources: list[Resource]) -> Resource | None:
    wanted = "beginner" if current_level <= 1 else "intermediate" if current_level <= 3 else "advanced"
    options = [r for r in resources if slug in r.skill_slugs]
    options.sort(key=lambda r: (r.level != wanted, r.hours or 999))
    return options[0] if options else None


def build_plan(
    role: RoleDef, owned: dict[str, OwnedSkill], names: dict[str, str], resources: list[Resource]
) -> tuple[list[PlanNode], list[PlanEdge]]:
    """Grafo por capas en profundidad (eje x): perfil -> habilidades -> aprendizaje -> proyecto -> rol.

    Las posiciones son coordenadas 3D pensadas para el Career Map (capas en x, abanico en y, relieve en z).
    """
    nodes: list[PlanNode] = [PlanNode("profile", "profile", "Tu perfil actual", "acquired", (-6.0, 0.0, 0.0))]
    edges: list[PlanEdge] = []
    skills = sorted(role.skills, key=lambda s: (not s.core, s.slug))
    n = len(skills)
    gap_keys: list[str] = []
    for i, rs in enumerate(skills):
        angle = (i / max(1, n - 1) - 0.5) * math.pi * 0.9 if n > 1 else 0.0
        y, z = round(math.sin(angle) * 5.4, 2), round(math.cos(angle) * 1.8 - 1.2, 2)
        mine = owned.get(rs.slug)
        status = "acquired" if mine and mine.level >= rs.level else "in_progress" if mine else "gap"
        key = f"skill:{rs.slug}"
        nodes.append(
            PlanNode(
                key,
                "skill",
                names.get(rs.slug, rs.slug),
                status,
                (-2.5, y, z),
                rs.slug,
                {"required_level": rs.level, "current_level": mine.level if mine else 0, "core": rs.core},
            )
        )
        edges.append(PlanEdge("profile", key, "requires" if status != "acquired" else "leads_to"))
        if status == "acquired":
            continue
        gap_keys.append(key)
        res = _resource_for(rs.slug, mine.level if mine else 0, resources)
        if res:
            ckey = f"course:{res.id}:{rs.slug}"
            nodes.append(
                PlanNode(
                    ckey,
                    "course",
                    res.title,
                    "target",
                    (1.0, y, z - 0.6),
                    res.id,
                    {"url": res.url, "hours": res.hours, "level": res.level},
                )
            )
            edges.append(PlanEdge(key, ckey))
            gap_keys[-1] = ckey
    project_label = (
        "Proyecto integrador: "
        + ", ".join(
            names.get(s.slug, s.slug)
            for s in skills
            if s.core and f"skill:{s.slug}" in {n.key for n in nodes}
        )[:150]
    )
    nodes.append(
        PlanNode(
            "project",
            "project",
            project_label,
            "target",
            (3.8, 0.0, 0.4),
            meta={"hint": "Publicalo en tu portfolio: es la evidencia mas fuerte para una empresa."},
        )
    )
    for key in gap_keys or ["profile"]:
        edges.append(PlanEdge(key, "project"))
    nodes.append(PlanNode(f"role:{role.code}", "role", role.title, "target", (6.5, 0.0, 0.0), role.code))
    edges.append(PlanEdge("project", f"role:{role.code}"))
    for j, nxt in enumerate(role.next_roles):
        if nxt in ROLES:
            key = f"role:{nxt}"
            nodes.append(
                PlanNode(
                    key,
                    "milestone",
                    f"Despues: {ROLES[nxt].title}",
                    "target",
                    (8.8, (j - (len(role.next_roles) - 1) / 2) * 2.4, -1.0),
                    nxt,
                )
            )
            edges.append(PlanEdge(f"role:{role.code}", key, "related"))
    return nodes, edges
