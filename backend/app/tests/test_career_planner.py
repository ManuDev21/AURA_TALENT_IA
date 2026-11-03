from app.career.planner import OwnedSkill, Resource, build_plan, rank_roles, role_coverage
from app.career.roles import ROLES

NAMES = {
    "html": "HTML",
    "css": "CSS",
    "javascript": "JavaScript",
    "react": "React",
    "typescript": "TypeScript",
}


def _owned(**levels: int) -> dict[str, OwnedSkill]:
    return {slug: OwnedSkill(slug, NAMES.get(slug, slug), lvl) for slug, lvl in levels.items()}


def test_coverage_counts_partial_levels_and_ranks_closest_role_first() -> None:
    owned = _owned(html=4, css=4, javascript=4, react=2)
    cov = role_coverage(ROLES["frontend"], owned, NAMES)
    assert "React" in cov.partial and "HTML" in cov.met and "TypeScript" in cov.missing
    assert 0 < cov.coverage < 100
    assert rank_roles(owned, NAMES)[0].code == "frontend"


def test_plan_links_gaps_to_resources_and_converges_on_role() -> None:
    owned = _owned(html=4, css=4, javascript=4)
    resources = [Resource("r1", "Aprende React", "https://react.dev/learn", "beginner", 20, ("react",))]
    nodes, edges = build_plan(ROLES["frontend"], owned, NAMES, resources)
    by_key = {n.key: n for n in nodes}
    assert by_key["skill:html"].status == "acquired"
    assert by_key["skill:react"].status == "gap"
    assert "course:r1:react" in by_key
    targets = {(e.source, e.target) for e in edges}
    assert ("skill:react", "course:r1:react") in targets
    assert ("course:r1:react", "project") in targets
    assert ("project", "role:frontend") in targets
    # Capas en profundidad: perfil < habilidades < cursos < proyecto < rol
    assert by_key["profile"].pos[0] < by_key["skill:react"].pos[0] < by_key["course:r1:react"].pos[0]
    assert by_key["project"].pos[0] < by_key["role:frontend"].pos[0]
