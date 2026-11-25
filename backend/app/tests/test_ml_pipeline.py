from app.analytics.ml_pipeline import (
    _run_practice_06_optimization,
    bfs_find_route,
    explore_and_clean_datasets,
    predict_single_fixed_rule,
    predict_with_fixed_rules,
    run_full_ml_lab,
)
from app.analytics.ml_talent_bigdata import (
    evaluate_candidate_dossier,
    run_talent_intelligence_suite,
    simulate_cnn_candidate_trajectory,
)
from app.analytics.ml_unsupervised import (
    assign_candidate_segment,
    run_advanced_ml_lab,
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


def test_practice_06_grid_vs_random_stratified_cv() -> None:
    res = _run_practice_06_optimization(seed=42)
    assert res["cv"]["estrategia"] == "StratifiedKFold"
    assert res["cv"]["n_splits"] == 5
    assert res["split_counts"]["optimizacion"] + res["split_counts"]["prueba"] == res[
        "split_counts"
    ]["total"]

    assert len(res["grid_search"]) == 3
    assert len(res["random_search"]) == 3
    algo_names = {r["algoritmo"] for r in res["grid_search"]}
    assert algo_names == {"Decision Tree", "Random Forest", "KNN"}
    assert all(r["combinaciones"] > 0 for r in res["grid_search"])
    assert all(r["iteraciones"] == 20 for r in res["random_search"])

    assert len(res["comparacion"]) == 3
    for row in res["comparacion"]:
        assert 0.0 <= row["gridsearch_f1_pct"] <= 100.0
        assert 0.0 <= row["randomizedsearch_f1_pct"] <= 100.0

    assert res["mejor_algoritmo"] in algo_names
    assert 0.0 <= res["mejor_f1_cv_pct"] <= 100.0
    fm = res["final_test_metrics"]
    cm = fm["confusion_matrix"]
    assert cm[0][0] + cm[0][1] + cm[1][0] + cm[1][1] == res["split_counts"]["prueba"]
    assert "algoritmo,gridsearch_f1_pct" in res["comparacion_csv"]


def test_advanced_lab_cleaning_kmeans_stability_and_pca() -> None:
    res = run_advanced_ml_lab(kmeans_k=3, participacion=7.5)
    assert "practice_06" in res

    p07 = res["practice_07"]
    limp = p07["limpieza"]
    assert limp["registros_finales"] < limp["registros_iniciales"]
    assert limp["duplicados_eliminados"] >= 1
    assert limp["total_faltantes"] == len(limp["imputaciones_mediana"])
    assert len(limp["correcciones_rango"]) >= 1
    assert set(limp["missing_by_column"]) == {
        "horas_estudio",
        "asistencia",
        "actividades",
        "participacion",
    }

    assert p07["k_final"] == 3
    assert len(p07["elbow"]) == 8  # K = 1..8
    assert len(p07["silhouette_por_k"]) == 7  # K = 2..8
    assert len(p07["perfiles"]) == 3
    assert len(p07["centroides"]) == 3
    assert len(p07["scatter"]) == limp["registros_finales"]
    assert -1.0 <= p07["silhouette_final"] <= 1.0
    ncs = p07["new_case_segment"]
    assert ncs is not None and ncs["cluster"] in (0, 1, 2)
    assert ncs["distancia_centroide"] >= 0.0
    assert "perfil" in p07["perfiles_csv"]

    p08 = res["practice_08"]
    assert {r["inicializacion"] for r in p08["inicializaciones"]} == {
        "k-means++",
        "random",
    }
    assert {r["escalador"] for r in p08["escaladores"]} == {
        "StandardScaler",
        "MinMaxScaler",
    }
    est = p08["estabilidad"]
    assert len(est["semillas"]) == 6
    assert len(est["matriz_ari"]) == 6
    assert all(len(fila) == 6 for fila in est["matriz_ari"])
    assert 0.0 <= est["ari_promedio"] <= 1.0
    assert p08["atipicos"]["total_candidatos"] > 0
    assert len(p08["atipicos"]["distancias"]) == limp["registros_finales"]
    assert p08["atipicos"]["umbral_distancia"] > 0

    p09 = res["practice_09"]
    assert len(p09["variance_table"]) == 4
    assert p09["variance_table"][-1]["acumulada_pct"] >= 99.9
    assert 1 <= p09["componentes_necesarias"] <= 4
    assert len(p09["loadings"]) == 4
    assert set(p09["variables"]) == {
        "horas_estudio",
        "asistencia",
        "actividades",
        "participacion",
    }
    assert len(p09["scatter_2d"]) == limp["registros_finales"]
    assert p09["reconstruccion_mse"] >= 0.0


def test_candidate_segment_assignment() -> None:
    seg = assign_candidate_segment(6.0, 80.0, 75.0, 7.5)
    assert seg["cluster"] in (0, 1, 2)
    assert isinstance(seg["perfil"], str) and seg["perfil"]
    assert seg["distancia_centroide"] >= 0.0
    assert set(seg["promedios_grupo"]) == {
        "horas_estudio",
        "asistencia",
        "actividades",
        "participacion",
    }


def test_pyspark_100k_cnn1d_and_candidate_dossier_suite() -> None:
    suite = run_talent_intelligence_suite()
    spark = suite["spark_100k"]
    assert spark["validaciones_integridad"]["registros_encontrados"] == 100_000
    assert spark["validaciones_integridad"]["identificadores_duplicados"] == 0
    assert spark["validaciones_integridad"]["registros_nulos"] == 0
    assert spark["validaciones_integridad"]["candidatos_con_5_competencias"] == 20_000
    assert len(spark["resumen_competencias"]) == 5
    assert len(spark["resumen_particiones"]) == 8
    assert len(spark["histograma_preparacion"]) == 20
    assert len(spark["piramide_madurez"]) == 5
    assert len(spark["nube_3d"]) > 50
    assert len(spark["puntos_ternarios"]) > 50

    cnn = suite["cnn_benchmark"]
    assert cnn["split"]["total_registros"] == 100_000
    assert cnn["split"]["candidatos_compartidos"] == 0
    assert len(cnn["clasificacion_trayectoria"]["comparacion_modelos"]) == 2
    assert (
        cnn["regresion_etapa3"]["metricas_cnn"]["mae"]
        < cnn["regresion_etapa3"]["metricas_modelo_base"]["mae"]
    )

    sim = simulate_cnn_candidate_trajectory(
        etapa1_cv=6.5, etapa2_tecnica=8.2, constancia_e1=85.0, constancia_e2=90.0
    )
    assert 0.0 <= sim["prediccion_regresion_etapa3"]["etapa3_estimada"] <= 10.0
    tern = sim["clasificacion_trayectoria_cnn"]["coordenada_ternaria"]
    assert abs(tern["p_ascenso"] + tern["p_estable"] + tern["p_refuerzo"] - 1.0) < 1e-3

    dossier = evaluate_candidate_dossier(
        id_candidato="AURA-TEST-999",
        nombre_completo="Candidato Prueba",
        rol_objetivo="Data & ML Engineer",
        horas_practica=7.5,
        evidencias_entregadas=22.0,
        participacion_pct=84.0,
    )
    ev = dossier["evaluacion_actual"]
    assert ev["id_candidato"] == "AURA-TEST-999"
    assert len(ev["recomendaciones"]) == 6
    assert dossier["agregaciones"]["estadisticas_generales"]["total_evaluaciones"] >= 1


