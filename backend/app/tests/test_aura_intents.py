import pytest

from app.aura.intents import detect, normalize


def test_normalize_removes_wake_word_accents_and_punctuation() -> None:
    assert normalize("Oye AURA, ¿Qué habilidades necesito mejorar?") == "que habilidades necesito mejorar"


@pytest.mark.parametrize(
    ("text", "code"),
    [
        ("AURA, ¿qué habilidades necesito mejorar?", "skills.gaps"),
        ("compara mi perfil con esta vacante", "match.compare"),
        ("analiza mi perfil", "profile.analyze"),
        ("AURA genera una ruta profesional", "career.generate"),
        ("busca vacantes de frontend", "jobs.search"),
        ("muestra los candidatos que cumplen los requisitos mínimos", "candidates.filter_minimum"),
        ("analiza los candidatos", "candidates.analyze"),
        ("¿qué puedes hacer?", "aura.help"),
    ],
)
def test_detects_catalog_intents(text: str, code: str) -> None:
    intent = detect(text)
    assert intent.code == code
    assert 0.6 <= intent.confidence < 1


def test_extracts_search_query_and_returns_unknown_without_match() -> None:
    assert (
        detect("AURA, busca vacantes de desarrollador backend").entities["query"] == "desarrollador backend"
    )
    assert detect("hola que tal el clima").code == "unknown"
    assert detect("   ").code == "unknown"
