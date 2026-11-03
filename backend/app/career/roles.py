"""Catalogo de roles objetivo del Career Map.

Cada rol declara habilidades por slug del catalogo con el nivel orientativo (1-5) y si son nucleo o
complementarias. Es una referencia editorial versionada, no una verdad del mercado.
"""

from dataclasses import dataclass

CATALOG_VERSION = "roles-v1"


@dataclass(frozen=True)
class RoleSkill:
    slug: str
    level: int
    core: bool = True


@dataclass(frozen=True)
class RoleDef:
    code: str
    title: str
    description: str
    skills: tuple[RoleSkill, ...]
    next_roles: tuple[str, ...] = ()


def _s(*items: tuple[str, int] | tuple[str, int, bool]) -> tuple[RoleSkill, ...]:
    return tuple(RoleSkill(*i) for i in items)


ROLES: dict[str, RoleDef] = {
    r.code: r
    for r in (
        RoleDef(
            "frontend",
            "Desarrollador/a Frontend",
            "Construye interfaces web accesibles y rapidas.",
            _s(
                ("html", 4),
                ("css", 4),
                ("javascript", 4),
                ("typescript", 3),
                ("react", 4),
                ("git", 3),
                ("automated-testing", 2, False),
                ("ui-design", 2, False),
                ("tailwindcss", 2, False),
            ),
            ("fullstack", "ux-ui"),
        ),
        RoleDef(
            "backend-python",
            "Desarrollador/a Backend (Python)",
            "Disena APIs, datos y servicios del lado servidor.",
            _s(
                ("python", 4),
                ("fastapi", 3),
                ("rest-apis", 4),
                ("sql", 3),
                ("postgresql", 3),
                ("git", 3),
                ("pytest", 2, False),
                ("docker", 2, False),
                ("linux", 2, False),
            ),
            ("fullstack", "devops"),
        ),
        RoleDef(
            "fullstack",
            "Desarrollador/a Full Stack",
            "Entrega funcionalidades completas de interfaz a base de datos.",
            _s(
                ("javascript", 4),
                ("typescript", 3),
                ("react", 3),
                ("nodejs", 3),
                ("rest-apis", 3),
                ("sql", 3),
                ("git", 3),
                ("docker", 2, False),
                ("automated-testing", 2, False),
            ),
            ("devops",),
        ),
        RoleDef(
            "data-analyst",
            "Analista de Datos",
            "Convierte datos en respuestas para decisiones de negocio.",
            _s(
                ("sql", 4),
                ("excel", 3),
                ("data-analysis", 4),
                ("statistics", 3),
                ("power-bi", 3),
                ("python", 2, False),
                ("pandas", 2, False),
                ("communication", 3, False),
            ),
            ("data-scientist",),
        ),
        RoleDef(
            "data-scientist",
            "Cientifico/a de Datos",
            "Construye modelos predictivos y experimentos con datos.",
            _s(
                ("python", 4),
                ("pandas", 4),
                ("numpy", 3),
                ("statistics", 4),
                ("machine-learning", 3),
                ("scikit-learn", 3),
                ("sql", 3),
                ("data-analysis", 3),
                ("deep-learning", 2, False),
            ),
            ("ml-engineer",),
        ),
        RoleDef(
            "ml-engineer",
            "Ingeniero/a de Machine Learning",
            "Lleva modelos de ML a produccion de forma confiable.",
            _s(
                ("python", 4),
                ("machine-learning", 4),
                ("scikit-learn", 3),
                ("deep-learning", 3),
                ("docker", 3),
                ("rest-apis", 3),
                ("git", 3),
                ("ci-cd", 2, False),
                ("aws", 2, False),
            ),
        ),
        RoleDef(
            "devops",
            "Ingeniero/a DevOps",
            "Automatiza despliegues e infraestructura confiable.",
            _s(
                ("linux", 4),
                ("docker", 4),
                ("ci-cd", 3),
                ("git", 4),
                ("kubernetes", 3),
                ("aws", 3),
                ("python", 2, False),
                ("postgresql", 2, False),
            ),
        ),
        RoleDef(
            "qa",
            "Ingeniero/a de Calidad (QA)",
            "Asegura la calidad con pruebas manuales y automatizadas.",
            _s(
                ("automated-testing", 4),
                ("jest", 3),
                ("pytest", 3),
                ("javascript", 3),
                ("git", 3),
                ("ci-cd", 2, False),
                ("critical-thinking", 3, False),
            ),
            ("fullstack",),
        ),
        RoleDef(
            "ux-ui",
            "Disenador/a UX/UI",
            "Investiga usuarios y disena experiencias claras.",
            _s(
                ("ux-design", 4),
                ("ui-design", 4),
                ("figma", 4),
                ("communication", 3),
                ("html", 2, False),
                ("css", 2, False),
            ),
        ),
    )
}
