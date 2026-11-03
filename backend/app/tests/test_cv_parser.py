"""Pruebas unitarias del parser de CV (sin base de datos)."""

from app.nlp.cv_parser import CvParser, build_skill_terms, parse_month, split_sections

CATALOG = [
    {"id": "js", "name": "JavaScript", "category": "Frontend", "aliases": ["JS"]},
    {"id": "react", "name": "React", "category": "Frontend", "aliases": ["ReactJS"]},
    {"id": "py", "name": "Python", "category": "Backend", "aliases": []},
    {"id": "go", "name": "Go", "category": "Backend", "aliases": ["Golang"]},
    {"id": "sql", "name": "SQL", "category": "Bases de datos", "aliases": []},
]

CV_TEXT = """VALERIA GOMEZ
Desarrolladora Frontend
valeria.gomez@correo.com | +52 55 1234 5678 | github.com/valeria | linkedin.com/in/valeria

PERFIL PROFESIONAL
Desarrolladora con dos anos de experiencia construyendo interfaces con React y JavaScript.
Me interesa la accesibilidad y el diseno de sistemas.

EXPERIENCIA
Frontend Developer - Startup MX
Marzo 2023 - Actualidad
- Migre la aplicacion principal a React.
- Reduje el tiempo de carga en 40%.
Practicante de Desarrollo
Agencia Web
01/2022 - 12/2022
Mantenimiento de sitios en WordPress.

EDUCACION
Ingenieria en Sistemas
Universidad Nacional
2018 - 2022

HABILIDADES
JS, React, Python, SQL, Go

IDIOMAS
Espanol - Nativo
Ingles - B2
Frances

CERTIFICACIONES
Scrum Fundamentals - Coursera
"""


def _parse() -> dict:
    return CvParser(build_skill_terms(CATALOG)).parse(CV_TEXT)


def test_parse_month_formats() -> None:
    assert parse_month("Marzo 2023") == "2023-03-01"
    assert parse_month("mar. 2023") == "2023-03-01"
    assert parse_month("05/2021") == "2021-05-01"
    assert parse_month("2019") == "2019-01-01"


def test_sections_are_detected() -> None:
    sections = split_sections([ln for ln in CV_TEXT.split("\n") if ln.strip()])
    assert {"summary", "experience", "education", "skills", "languages", "certifications"} <= set(sections)


def test_contact_and_links() -> None:
    result = _parse()
    fields = result["fields"]
    assert fields["email"]["value"] == "valeria.gomez@correo.com"
    assert fields["full_name"]["value"] == "Valeria Gomez"
    assert fields["headline"]["value"] == "Desarrolladora Frontend"
    assert "React" in fields["summary"]["value"]
    assert {link["link_type"] for link in result["links"]} == {"github", "linkedin"}
    assert fields["phone"]["value"].startswith("+52")


def test_experiences_with_dates_and_achievements() -> None:
    experiences = _parse()["experiences"]
    assert len(experiences) == 2
    first, second = experiences
    assert first["title"] == "Frontend Developer"
    assert first["company_name"] == "Startup MX"
    assert first["start_date"] == "2023-03-01"
    assert first["is_current"] is True and first["end_date"] is None
    assert first["achievements"] == [
        "Migre la aplicacion principal a React.",
        "Reduje el tiempo de carga en 40%.",
    ]
    assert second["title"] == "Practicante de Desarrollo"
    assert second["company_name"] == "Agencia Web"
    assert (second["start_date"], second["end_date"]) == ("2022-01-01", "2022-12-01")
    assert all(e["evidence"] for e in experiences)


def test_education_level_detected() -> None:
    education = _parse()["education"]
    assert education[0]["institution"] == "Universidad Nacional"
    assert education[0]["degree"] == "Ingenieria en Sistemas"
    assert education[0]["level"] == "bachelor"


def test_skills_match_catalog_including_short_aliases_only_in_skills_section() -> None:
    skills = {s["name"]: s for s in _parse()["skills"]}
    assert {"JavaScript", "React", "Python", "SQL", "Go"} <= set(skills)
    assert skills["JavaScript"]["matched"] == "JS"
    assert skills["React"]["confidence"] == 0.9


def test_short_terms_outside_skills_section_are_ignored() -> None:
    parser = CvParser(build_skill_terms(CATALOG))
    result = parser.parse("Juan Perez\nMe gusta ir a la playa y go a correr. Usa JS en casa.\n" * 5)
    assert not any(s["name"] in {"Go", "JavaScript"} for s in result["skills"])


def test_languages_never_invent_levels() -> None:
    languages = {lang["language_code"]: lang for lang in _parse()["languages"]}
    assert languages["es"]["level"] == "native"
    assert languages["en"]["level"] == "B2"
    assert languages["fr"]["level"] is None
    assert languages["fr"]["confidence"] < 0.6


def test_certifications_and_scanned_warning() -> None:
    result = _parse()
    assert result["certifications"][0] == {
        "name": "Scrum Fundamentals",
        "issuer": "Coursera",
        "confidence": 0.55,
        "evidence": "Scrum Fundamentals - Coursera",
    }
    empty = CvParser([]).parse("hola")
    assert any("escaneada" in w for w in empty["warnings"])
