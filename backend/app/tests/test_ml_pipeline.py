from app.analytics.ml_pipeline import (
    bfs_find_route,
    explore_and_clean_datasets,
    predict_single_fixed_rule,
    predict_with_fixed_rules,
    run_full_ml_lab,
)


def test_practice_01_bfs_and_fixed_rule() -> None:
    bfs_res = bfs_find_route()
    assert bfs_res["route"] == [
        "Perfil Inicial",
        "Fundamentos Tecnicos",
        "Portafolio Verificado",
        "Rol Objetivo Alcanzado",
    ]
    assert bfs_res["connections"] == 3
    assert "Avanza" in predict_single_fixed_rule(8) or "solida" in predict_single_fixed_rule(8)
    assert "reforzar" in predict_single_fixed_rule(3)


def test_practice_02_data_quality_and_clean_split() -> None:
    res = explore_and_clean_datasets()
    assert res["shape"] == [8, 5]
    assert res["mean_score"] == 75.12
    qa = res["quality_audit"]
    assert qa["dirty_total_rows"] == 5
    assert qa["missing_by_column"]["horas_estudio"] == 1
    assert qa["missing_by_column"]["calificacion"] == 1
    assert len(qa["duplicate_rows"]) == 1
    assert len(qa["out_of_range_rows"]) == 1
    assert len(qa["valid_records"]) == 2
    assert len(qa["review_records"]) == 2
    assert "candidato,horas_estudio,asistencia" in qa["valid_csv"]
    assert "motivo_revision" in qa["review_csv"]
    assert res["variables_xy"]["x_shape"] == [8, 3]
    assert res["variables_xy"]["y_shape"] == [8]
    assert res["variables_xy"]["aligned"] is True


def test_practice_03_decision_tree_vs_fixed_rules() -> None:
    full = run_full_ml_lab(
        horas_estudio=6.0,
        asistencia=80.0,
        actividades_entregadas=75.0,
    )
    p03 = full["practice_03"]
    assert p03["total_records"] == 30
    assert p03["train_count"] == 21
    assert p03["test_count"] == 9
    assert len(p03["comparison_table"]) == 9
    assert 0.0 <= p03["metrics_ml"]["accuracy"] <= 1.0
    assert 0.0 <= p03["metrics_rules"]["accuracy"] <= 1.0
    cm = p03["metrics_ml"]["confusion_matrix"]
    assert cm[0][0] + cm[0][1] + cm[1][0] + cm[1][1] == 9
    assert p03["new_case"]["rule_prediction"] == 1
    assert p03["new_case"]["ml_prediction"] == 1
    assert predict_with_fixed_rules(
        {"horas_estudio": 4, "asistencia": 80, "actividades_entregadas": 80}
    ) == 0


def test_practice_04_and_05_splits_overfitting_and_three_algorithms() -> None:
    full = run_full_ml_lab(
        horas_estudio=8.0,
        asistencia=85.0,
        actividades_entregadas=80.0,
        participacion=8.0,
        knn_neighbors=7,
        rf_estimators=100,
        dt_max_depth=5,
    )
    p04 = full["practice_04"]
    assert p04["split_counts"]["total"] == 150
    assert p04["split_counts"]["train"] == 90
    assert p04["split_counts"]["validation"] == 30
    assert p04["split_counts"]["test"] == 30
    assert len(p04["depth_comparison"]) == 6
    assert len(p04["cross_validation"]["folds"]) == 5
    assert "profundidad,entrenamiento_pct,validacion_pct" in p04["comparison_csv"]

    p05 = full["practice_05"]
    assert len(p05["validation_comparison"]) == 3
    algo_names = {r["algoritmo"] for r in p05["validation_comparison"]}
    assert algo_names == {"Decision Tree", "Random Forest", "KNN"}
    assert p05["selected_algorithm"] in algo_names
    assert p05["retrained_samples"] == 120
    assert len(p05["cross_validation_f1"]["folds"]) == 5
    preds = p05["new_case_predictions"]
    assert preds["decision_tree"]["prediction"] in (0, 1)
    assert preds["random_forest"]["prediction"] in (0, 1)
    assert preds["knn"]["prediction"] in (0, 1)
    assert "algoritmo,exactitud_pct,precision_pct,recall_pct,f1_pct" in p05["comparison_csv"]

