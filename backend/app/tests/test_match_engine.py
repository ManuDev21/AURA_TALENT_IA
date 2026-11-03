from datetime import date

from app.match.engine import (
    CandidateIn,
    CandidateSkillIn,
    JobIn,
    JobSkillIn,
    Period,
    compute_match,
    experience_years,
    text_similarity,
)

TODAY = date(2026, 1, 1)


def _job(**over) -> JobIn:
    data = dict(
        skills=[
            JobSkillIn("react", "React", "required", 4),
            JobSkillIn("ts", "TypeScript", "required", 3),
            JobSkillIn("figma", "Figma", "preferred", 2),
        ],
        experience_min_years=2,
        education_level=None,
        languages=[("en", "B2", True)],
        certification_requirements=[],
        modality="remote",
        text="Desarrollador frontend React TypeScript para construir interfaces accesibles",
    )
    data.update(over)
    return JobIn(**data)


def _candidate(**over) -> CandidateIn:
    data = dict(
        skills=[CandidateSkillIn("react", "React", 5), CandidateSkillIn("ts", "TypeScript", 2)],
        experiences=[Period(date(2023, 1, 1), None, True)],
        education_levels=["bachelor"],
        languages={"en": "C1"},
        certifications=[],
        modality="remote",
        text="Frontend developer con React y TypeScript, interfaces accesibles y rendimiento",
    )
    data.update(over)
    return CandidateIn(**data)


def test_overlapping_experience_is_not_double_counted() -> None:
    periods = [
        Period(date(2020, 1, 1), date(2022, 1, 1), False),
        Period(date(2021, 1, 1), date(2023, 1, 1), False),
    ]
    assert round(experience_years(periods, TODAY), 1) == 3.0


def test_requirements_strengths_and_gaps() -> None:
    o = compute_match(_candidate(), _job(), TODAY)
    status = {r.label: r.status for r in o.requirements}
    assert status["React"] == "met" and status["TypeScript"] == "partial" and status["Figma"] == "missing"
    assert "React" in o.strengths and "Idioma EN" in o.strengths
    assert {g["name"] for g in o.gaps} >= {"TypeScript", "Figma"}
    assert o.score_low <= o.score <= o.score_high
    assert abs(sum(f.weight for f in o.factors) - 1) < 1e-9


def test_factor_not_requested_is_excluded_and_weights_renormalized() -> None:
    o = compute_match(_candidate(), _job(languages=[], experience_min_years=0), TODAY)
    codes = {f.code for f in o.factors}
    assert "languages" not in codes and "experience" not in codes
    assert abs(sum(f.weight for f in o.factors) - 1) < 1e-9


def test_better_profile_scores_higher_and_missing_data_widens_range() -> None:
    strong = compute_match(
        _candidate(
            skills=[
                CandidateSkillIn("react", "React", 5),
                CandidateSkillIn("ts", "TypeScript", 4),
                CandidateSkillIn("figma", "Figma", 3),
            ]
        ),
        _job(),
        TODAY,
    )
    base = compute_match(_candidate(), _job(), TODAY)
    empty = compute_match(
        CandidateIn(
            skills=[],
            experiences=[],
            education_levels=[],
            languages={},
            certifications=[],
            modality=None,
            text="",
        ),
        _job(),
        TODAY,
    )
    assert strong.score > base.score > empty.score
    assert (empty.score_high - empty.score_low) > (strong.score_high - strong.score_low)


def test_text_similarity_ignores_accents_and_stopwords() -> None:
    assert text_similarity("Gestión de datos con Python", "gestion datos python") > 0.9
    assert text_similarity("cocina italiana", "desarrollo backend") == 0
