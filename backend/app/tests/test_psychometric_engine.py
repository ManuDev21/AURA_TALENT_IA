import pytest

from app.psychometrics.engine import (
    AnswerDef,
    BandDef,
    IncompleteAttemptError,
    OptionDef,
    QuestionDef,
    RuleDef,
    quality_checks,
    review,
    score,
)

BANDS = [
    BandDef("D1", 0, 39.99, "low", "Tendencia baja", ("rec baja",)),
    BandDef("D1", 40, 69.99, "moderate", "Tendencia moderada", ()),
    BandDef("D1", 70, 100, "high", "Tendencia elevada", ("rec alta",)),
    BandDef(None, 0, 49.99, "low", "Reforzar", ()),
    BandDef(None, 50, 100, "high", "Buen dominio", ()),
]


def _likert(qid: str, reverse: bool = False, attention: bool = False) -> QuestionDef:
    return QuestionDef(
        id=qid,
        question_type="likert",
        stem=f"Item {qid}",
        dimension_id=None if attention else "D1",
        reverse_keyed=reverse,
        is_attention_check=attention,
        expected_value=4 if attention else None,
        scale_labels={"1": "Totalmente en desacuerdo", "5": "Totalmente de acuerdo"},
    )


def test_likert_mean_with_reverse_keyed_items() -> None:
    questions = [_likert("a"), _likert("b"), _likert("c", reverse=True), _likert("att", attention=True)]
    answers = {
        "a": AnswerDef(numeric_value=5, time_ms=3000),
        "b": AnswerDef(numeric_value=4, time_ms=3000),
        "c": AnswerDef(numeric_value=1, time_ms=3000),  # invertido: 1 cuenta como 5
        "att": AnswerDef(numeric_value=4, time_ms=3000),
    }
    outcome = score(questions, answers, [RuleDef("D1", "mean", {"min_answered_ratio": 1.0})], BANDS)
    dim = outcome.dimensions[0]
    assert dim.raw == pytest.approx(4.667, abs=0.001)
    assert dim.normalized == pytest.approx(91.67, abs=0.01)
    assert dim.band == "high" and dim.interpretation == "Tendencia elevada"
    assert dim.recommendations == ["rec alta"]
    assert dim.evidence[0]["answer"] == "Totalmente de acuerdo"
    assert outcome.quality_flags == {}
    assert outcome.overall_score is None


def test_incomplete_likert_raises() -> None:
    questions = [_likert("a"), _likert("b")]
    with pytest.raises(IncompleteAttemptError):
        score(
            questions,
            {"a": AnswerDef(numeric_value=3)},
            [RuleDef("D1", "mean", {"min_answered_ratio": 1.0})],
            BANDS,
        )


def test_quality_flags_are_reported() -> None:
    questions = [_likert(str(i)) for i in range(8)] + [_likert("att", attention=True)]
    answers = {str(i): AnswerDef(numeric_value=3, time_ms=400) for i in range(8)}
    answers["att"] = AnswerDef(numeric_value=2, time_ms=400)
    flags = quality_checks(questions, answers)
    assert flags == {"straightlining": True, "attention_check_failed": True, "too_fast": True}


def _mc(qid: str, correct: str) -> QuestionDef:
    return QuestionDef(
        id=qid,
        question_type="multiple_choice",
        stem=f"Pregunta {qid}",
        explanation="Porque si",
        options=(
            OptionDef(f"{qid}1", "A", is_correct=correct == "A"),
            OptionDef(f"{qid}2", "B", is_correct=correct == "B"),
        ),
    )


def test_correct_count_and_review() -> None:
    questions = [_mc("q1", "A"), _mc("q2", "B"), _mc("q3", "A"), _mc("q4", "B")]
    answers = {
        "q1": AnswerDef(option_id="q11"),
        "q2": AnswerDef(option_id="q22"),
        "q3": AnswerDef(option_id="q32"),
    }
    outcome = score(questions, answers, [RuleDef(None, "correct_count")], BANDS)
    assert outcome.overall_score == 50.0 and outcome.overall_band == "high"
    items = review(questions, answers)
    assert [i["is_correct"] for i in items] == [True, True, False, False]
    assert items[2]["correct"] == "A" and items[3]["selected"] is None
    assert items[0]["explanation"] == "Porque si"


def test_rubric_scoring() -> None:
    q = QuestionDef(
        id="s1",
        question_type="situational",
        stem="Escenario",
        options=(
            OptionDef("o1", "Comunicar", rubric_score=3, rubric_rationale="Transparente"),
            OptionDef("o2", "Ocultar", rubric_score=0),
        ),
    )
    q2 = QuestionDef(
        id="s2", question_type="situational", stem="Otro", options=(OptionDef("p1", "X", rubric_score=1),)
    )
    outcome = score(
        [q, q2],
        {"s1": AnswerDef(option_id="o1"), "s2": AnswerDef(option_id="p1")},
        [RuleDef(None, "rubric", {"max_per_question": 3})],
        BANDS,
    )
    assert outcome.overall_score == pytest.approx(66.67, abs=0.01)
    assert review([q], {"s1": AnswerDef(option_id="o1")})[0]["rationale"] == "Transparente"
