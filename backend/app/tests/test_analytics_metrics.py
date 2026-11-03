from datetime import UTC, datetime, timedelta

from app.analytics.metrics import AppRow, HistoryRow, funnel, outcomes, stage_durations, weekly

NOW = datetime(2026, 10, 7, 12, tzinfo=UTC)
D = timedelta(days=1)


def _data() -> tuple[list[AppRow], list[HistoryRow]]:
    apps = [
        AppRow("a", NOW - 10 * D, "HIRED", "hired"),
        AppRow("b", NOW - 6 * D, "INTERVIEW", "active"),
        AppRow("c", NOW - 3 * D, "APPLIED", "active"),
        AppRow("d", NOW - 20 * D, "CLOSED", "closed"),
    ]
    history = [
        HistoryRow("a", "SCREENING", NOW - 8 * D),
        HistoryRow("a", "INTERVIEW", NOW - 6 * D),
        HistoryRow("a", "FINAL_REVIEW", NOW - 4 * D),
        HistoryRow("a", "HIRED", NOW - 2 * D),
        HistoryRow("b", "SCREENING", NOW - 5 * D),
        HistoryRow("b", "INTERVIEW", NOW - 1 * D),
        HistoryRow("d", "SCREENING", NOW - 18 * D),
        HistoryRow("d", "CLOSED", NOW - 15 * D),
    ]
    return apps, history


def test_funnel_counts_stages_reached_even_after_moving_on() -> None:
    apps, history = _data()
    by = {f["stage"]: f for f in funnel(apps, history)}
    assert by["APPLIED"]["count"] == 4
    assert by["SCREENING"]["count"] == 3
    assert by["INTERVIEW"]["count"] == 2
    assert by["HIRED"]["count"] == 1 and by["HIRED"]["rate_from_start"] == 25.0
    assert by["ASSESSMENT"]["count"] == 0


def test_optional_stage_is_not_the_base_for_conversion() -> None:
    """Regresion: Entrevista mostraba 300% porque se dividia entre Evaluacion (etapa opcional)."""
    apps = [AppRow(str(i), NOW - 5 * D, "INTERVIEW", "active") for i in range(4)]
    history = [HistoryRow(str(i), "SCREENING", NOW - 4 * D) for i in range(4)]
    history += [HistoryRow(str(i), "INTERVIEW", NOW - 2 * D) for i in range(3)]
    history += [HistoryRow("0", "ASSESSMENT", NOW - 3 * D)]
    by = {f["stage"]: f for f in funnel(apps, history)}
    assert by["ASSESSMENT"]["rate_from_previous"] == 25.0
    assert by["INTERVIEW"]["rate_from_previous"] == 100.0
    assert all(f["rate_from_previous"] <= 100 for f in by.values())


def test_stage_durations_and_outcomes() -> None:
    apps, history = _data()
    by = {d["stage"]: d for d in stage_durations(apps, history, NOW)}
    # APPLIED: a=2, b=1, c=3 (sigue activa), d=2 -> 2.0
    assert by["APPLIED"]["avg_days"] == 2.0 and by["APPLIED"]["samples"] == 4
    assert by["INTERVIEW"]["samples"] == 2
    assert outcomes(apps) == {"active": 2, "hired": 1, "closed": 1, "withdrawn": 0}


def test_weekly_trend_has_fixed_number_of_buckets() -> None:
    apps, _ = _data()
    weeks = weekly(apps, NOW, weeks=4)
    assert len(weeks) == 4 and sum(w["count"] for w in weeks) == 4
