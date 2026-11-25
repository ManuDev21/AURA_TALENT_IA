import { apiRequest } from '@/api/client'

export interface AuraReply {
  interaction_id: string
  intent: string
  confidence: number
  outcome: 'ok' | 'denied' | 'needs_confirmation' | 'unknown' | 'cancelled'
  reply: string
  details: string[]
  action: { type: 'navigate'; path: string } | null
  confirmation: { token: string; summary: string; expires_at: string } | null
  llm_used: boolean
}

export interface AuraCommandInput {
  text: string
  channel: 'text' | 'voice' | 'gesture'
  area: 'candidate' | 'company' | 'admin'
  context?: { module?: string | null; job_id?: string | null }
  session_id?: string
}

export type OllamaAutomationTask =
  | 'cv_optimization'
  | 'job_generator'
  | 'interview_coach'
  | 'candidate_synthesis'
  | 'workflow_automation'

export interface OllamaStatus {
  online: boolean
  provider: string
  endpoint: string
  configured_model: string
  base_model: string
  active_model: string
  installed_models: string[]
  custom_model_ready: boolean
  latency_ms: number
  modelfile: string
  cli_command: string
}

export interface OllamaCreateModelResponse {
  created: boolean
  model: string
  base_model: string
  message: string
  modelfile: string
}

export interface OllamaAutomateResponse {
  task: OllamaAutomationTask
  engine: string
  ollama_live: boolean
  latency_ms: number
  output: string
  actions: string[]
}

export interface MlTreeNode {
  is_leaf: boolean
  depth: number
  feature?: string
  threshold?: number
  prediction: number
  samples: number
  class_counts: [number, number]
  gini: number
  left?: MlTreeNode
  right?: MlTreeNode
}

export interface MlClassReportItem {
  class_id: number
  label: string
  precision: number
  recall: number
  f1_score: number
  support: number
}

export interface MlMetricsResult {
  accuracy: number
  accuracy_pct: number
  precision: number
  precision_pct: number
  recall: number
  recall_pct: number
  f1_score: number
  f1_pct: number
  confusion_matrix: [[number, number], [number, number]]
  confusion_details: {
    true_negatives: number
    false_positives: number
    false_negatives: number
    true_positives: number
  }
  report: MlClassReportItem[]
}

export interface MlPractice04DepthRow {
  profundidad: string
  profundidad_grafica: number
  entrenamiento: number
  entrenamiento_pct: number
  validacion: number
  validacion_pct: number
  diferencia_pct: number
  diagnostico: string
  tone: 'success' | 'warning' | 'danger'
}

export interface MlPractice05AlgoRow {
  algoritmo: 'Decision Tree' | 'Random Forest' | 'KNN'
  descripcion: string
  exactitud: number
  exactitud_pct: number
  precision: number
  precision_pct: number
  recall: number
  recall_pct: number
  f1_score: number
  f1_pct: number
}

export interface MlLabOverviewResponse {
  model_version: string
  practice_01: {
    bfs: {
      start: string
      goal: string
      route: string[] | null
      connections: number
      visited_order: string[]
      steps_log: Array<{
        current_node: string
        current_path: string[]
        queue_size: number
        visited_count: number
      }>
    }
    fixed_rule_batch: Array<{
      nombre: string
      horas_estudio: number
      resultado: string
    }>
    new_case_simple_rule: string
  }
  practice_02: {
    shape: [number, number]
    columns: string[]
    dtypes: Record<string, string>
    head: Array<Record<string, string | number | null>>
    tail: Array<Record<string, string | number | null>>
    describe: Record<
      string,
      {
        count: number
        mean: number
        std: number
        min: number
        p25: number
        p50: number
        p75: number
        max: number
      }
    >
    mean_score: number
    caution_note: string
    quality_audit: {
      dirty_total_rows: number
      missing_by_column: Record<string, number>
      incomplete_rows_count: number
      duplicate_rows: Array<Record<string, string | number | null>>
      out_of_range_rows: Array<Record<string, string | number | null>>
      valid_records: Array<Record<string, string | number | null>>
      review_records: Array<Record<string, string | number | null>>
      valid_csv: string
      review_csv: string
    }
    variables_xy: {
      x_columns: string[]
      y_column: string
      x_shape: [number, number]
      y_shape: [number]
      aligned: boolean
      x_preview: Array<Record<string, number>>
      y_preview: number[]
    }
  }
  practice_03: {
    total_records: number
    train_count: number
    test_count: number
    class_distribution: {
      no_aprueba_0: number
      aprueba_1: number
    }
    rule_thresholds: {
      min_horas: number
      min_asistencia: number
      min_actividades: number
    }
    tree: MlTreeNode
    comparison_table: Array<{
      id: number
      horas_estudio: number
      asistencia: number
      actividades_entregadas: number
      resultado_real: number
      prediccion_reglas: number
      prediccion_ml: number
      coincide_reglas: boolean
      coincide_ml: boolean
      traza_ml: string[]
    }>
    metrics_rules: MlMetricsResult
    metrics_ml: MlMetricsResult
    new_case: {
      inputs: {
        horas_estudio: number
        asistencia: number
        actividades_entregadas: number
      }
      rule_prediction: number
      rule_label: string
      ml_prediction: number
      ml_label: string
      ml_decision_trace: string[]
      simple_rule_label: string
    }
    conclusions: string[]
  }
  practice_04: {
    split_counts: {
      total: number
      train: number
      validation: number
      test: number
      ratios: string
    }
    depth_comparison: MlPractice04DepthRow[]
    selected_depth: string
    selected_validation_pct: number
    final_test_metrics: MlMetricsResult
    cross_validation: {
      folds: number[]
      mean_pct: number
      std_pct: number
    }
    comparison_csv: string
  }
  practice_05: {
    hyperparameters: {
      knn_neighbors: number
      rf_estimators: number
      dt_max_depth: number
    }
    validation_comparison: MlPractice05AlgoRow[]
    selected_algorithm: string
    selected_validation_f1_pct: number
    selection_criterion: string
    retrained_samples: number
    final_test_metrics: MlMetricsResult
    cross_validation_f1: {
      folds: number[]
      mean_pct: number
      std_pct: number
    }
    new_case_predictions: {
      inputs: {
        horas_estudio: number
        asistencia: number
        actividades_entregadas: number
        participacion: number
      }
      decision_tree: {
        prediction: number
        label: string
        trace: string[]
      }
      random_forest: {
        prediction: number
        label: string
        vote_confidence_pct: number
      }
      knn: {
        prediction: number
        label: string
        distance_confidence_pct: number
      }
    }
    comparison_csv: string
  }
  candidate_segment: {
    cluster: number
    perfil: string
    distancia_centroide: number
    color: string
    promedios_grupo: Record<string, number>
  }
  employability_recommendations?: Array<{
    dimension: string
    nivel: string
    accion: string
  }>
  cnn_trajectory?: MlCnnTrajectorySimulation
}

export interface MlCnnTrajectoryInput {
  etapa1_cv: number
  etapa2_tecnica: number
  constancia_e1: number
  constancia_e2: number
  etapa3_observada?: number | null
  constancia_e3?: number
}

export interface MlCnnTrajectorySimulation {
  entradas: {
    etapa1_cv: number
    etapa2_tecnica: number
    constancia_e1: number
    constancia_e2: number
    etapa3_star_usada: number
    constancia_e3: number
  }
  prediccion_regresion_etapa3: {
    etapa3_estimada: number
    intervalo_confianza: [number, number]
    tendencia_1_a_2: number
    estado_estimado: string
  }
  clasificacion_trayectoria_cnn: {
    trayectoria: string
    probabilidades_pct: Record<string, number>
    coordenada_ternaria: {
      p_ascenso: number
      p_estable: number
      p_refuerzo: number
    }
    variacion_e1_a_e3: number
    indice_preparacion: number
    constancia_promedio: number
  }
}

export interface MlCompetenciaDossierRow {
  competencia: string
  evaluador: string
  etapa1: number
  etapa2: number
  etapa3: number
  promedio_competencia?: number
  sesiones_programadas: number
  sesiones_cumplidas: number
  pendientes?: number
  constancia_pct?: number
}

export interface MlCandidateDossierInput {
  id_candidato: string
  nombre_completo: string
  rol_objetivo: string
  seniority: string
  modalidad: string
  horas_practica: number
  evidencias_entregadas: number
  participacion_pct: number
  competencias?: MlCompetenciaDossierRow[]
}

export interface MlDossierRecord {
  id_analisis: string
  id_candidato: string
  nombre_completo: string
  rol_objetivo: string
  seniority: string
  modalidad: string
  fecha_registro: string
  horas_practica: number
  constancia_pct: number
  evidencias: number
  participacion_pct: number
  promedio_competencias: number
  total_sesiones: number
  sesiones_cumplidas: number
  sesiones_pendientes: number
  prediccion: number
  resultado: string
  probabilidad_listo_pct: number
  probabilidad_refuerzo_pct: number
  cluster: number
  perfil: string
  distancia_centroide: number
  PC1: number
  PC2: number
  PC3: number
  competencias: MlCompetenciaDossierRow[]
  recomendaciones: Array<{
    dimension: string
    nivel: string
    accion: string
  }>
}

export interface MlDossierEvaluationResponse {
  evaluacion_actual: MlDossierRecord
  historial: MlDossierRecord[]
  agregaciones: {
    estadisticas_generales: {
      total_evaluaciones: number
      candidatos_unicos: number
      promedio_horas: number
      promedio_constancia_pct: number
      promedio_evidencias: number
      promedio_participacion_pct: number
      promedio_probabilidad_listo_pct: number
      total_listos_estimados: number
      total_requiere_refuerzo: number
      porcentaje_refuerzo: number
    }
    distribucion_perfiles: Array<{
      perfil: string
      total_analisis: number
      promedio_horas: number
      promedio_constancia: number
      promedio_evidencias: number
      promedio_participacion: number
      promedio_probabilidad_pct: number
    }>
    casos_refuerzo: MlDossierRecord[]
    top_5_preparados: MlDossierRecord[]
    historico_csv: string
    riesgos_csv: string
    perfiles_csv: string
  }
}

export interface MlTalentSuiteResponse {
  spark_100k: {
    lote_id: string
    motor: string
    tiempo_procesamiento_ms: number
    configuracion: {
      total_candidatos: number
      competencias_por_candidato: number
      total_registros: number
      num_particiones: number
      tamano_lote_upsert: number
      formato_almacenamiento: string
    }
    validaciones_integridad: {
      registros_encontrados: number
      registros_esperados: number
      identificadores_duplicados: number
      registros_nulos: number
      puntajes_fuera_rango_0_10: number
      constancias_fuera_rango_0_100: number
      candidatos_con_5_competencias: number
      diferencias_redondeo_borde: number
      estado: string
    }
    kpis_globales: {
      indice_preparacion_promedio: number
      constancia_promedio_pct: number
      total_listos_vacante: number
      tasa_listos_pct: number
      total_en_ascenso: number
      porcentaje_en_ascenso: number
    }
    esquema_spark: Array<{
      campo: string
      tipo: string
      nullable: boolean
    }>
    resumen_competencias: Array<{
      competencia: string
      registros: number
      etapa1_promedio: number
      etapa2_promedio: number
      etapa3_promedio: number
      indice_promedio: number
      constancia_promedio: number
      variacion_promedio: number
      tasa_listos_pct: number
      en_ascenso: number
      estables: number
      requiere_refuerzo: number
    }>
    resumen_particiones: Array<{
      particion: string
      registros: number
      indice_promedio: number
      constancia_promedio: number
      tasa_listos_pct: number
    }>
    distribucion_trayectorias: Array<{
      categoria: string
      cantidad: number
      porcentaje: number
    }>
    distribucion_empleabilidad: Array<{
      estado: string
      cantidad: number
      porcentaje: number
    }>
    histograma_preparacion: Array<{
      rango: string
      inicio: number
      fin: number
      frecuencia: number
      porcentaje: number
    }>
    histograma_variacion: Array<{
      rango: string
      centro: number
      frecuencia: number
    }>
    piramide_madurez: Array<{
      nivel: string
      cantidad: number
      porcentaje: number
      color: string
    }>
    nube_3d: Array<{
      id: string
      competencia: string
      x: number
      y: number
      z: number
      indice: number
      trayectoria: string
      clase: number
    }>
    puntos_ternarios: Array<{
      id: string
      rol: string
      p_ascenso: number
      p_estable: number
      p_refuerzo: number
      trayectoria: string
      indice: number
    }>
    primeros_registros: Array<{
      id_registro: number
      id_candidato: string
      rol_objetivo: string
      competencia: string
      etapa1_cv: number
      etapa2_tecnica: number
      etapa3_star: number
      constancia_promedio: number
      indice_preparacion: number
      variacion_etapas: number
      trayectoria: string
      estado_empleabilidad: string
    }>
    resumen_csv: string
    muestra_csv: string
  }
  cnn_benchmark: {
    split: {
      metodo: string
      total_registros: number
      total_candidatos: number
      train_registros: number
      train_candidatos: number
      val_registros: number
      val_candidatos: number
      test_registros: number
      test_candidatos: number
      candidatos_compartidos: number
      normalizacion: {
        metodo: string
        media_puntaje_etapas: number
        std_puntaje_etapas: number
        media_constancia_etapas: number
        std_constancia_etapas: number
      }
    }
    clasificacion_trayectoria: {
      clases: string[]
      arquitectura_capas: Array<{
        capa: string
        forma: string
        detalle: string
      }>
      mejor_epoca: number
      paciencia_early_stopping: number
      historial_epocas: Array<{
        epoca: number
        train_loss: number
        val_loss: number
        train_acc_pct: number
        val_acc_pct: number
      }>
      matriz_confusion_cnn: number[][]
      matriz_confusion_rf: number[][]
      comparacion_modelos: Array<{
        modelo: string
        arquitectura: string
        formato_entrada: string
        accuracy_pct: number
        precision_macro_pct: number
        recall_macro_pct: number
        f1_macro_pct: number
        tiempo_entrenamiento_s: number
        tiempo_inferencia_s: number
      }>
      ganador: string
      comparacion_csv: string
    }
    regresion_etapa3: {
      objetivo: string
      variables_entrada: string[]
      variables_excluidas_sin_fuga: string[]
      forma_tensor_entrada: number[]
      parametros_entrenables: number
      mejor_epoca: number
      metricas_cnn: {
        mae: number
        mse: number
        rmse: number
        r2: number
      }
      metricas_modelo_base: {
        descripcion: string
        mae: number
        rmse: number
        mejora_mae_pct: number
      }
      historial_epocas: Array<{
        epoca: number
        train_mse: number
        val_mse: number
        learning_rate: number
      }>
      real_vs_predicho: Array<{
        id_candidato: string
        competencia: string
        real_etapa3: number
        predicho_etapa3: number
        error_absoluto: number
      }>
      histograma_errores: Array<{
        rango: string
        frecuencia: number
        porcentaje: number
      }>
      predicciones_csv: string
    }
  }
  cnn_simulacion_inicial: MlCnnTrajectorySimulation
  expediente_integral: MlDossierEvaluationResponse
}

export interface MlAdvancedInput {
  kmeans_k?: number
  horas_estudio?: number
  asistencia?: number
  actividades_entregadas?: number
  participacion?: number
}

export interface MlP06SearchRow {
  algoritmo: string
  mejor_f1: number
  mejor_f1_pct: number
  combinaciones?: number
  iteraciones?: number
  mejores_hiperparametros: Record<string, string | number | null>
}

export interface MlClusterProfile {
  cluster: number
  cantidad: number
  perfil?: string
  color?: string
  horas_estudio: number
  asistencia: number
  actividades: number
  participacion: number
}

export interface MlAdvancedResponse {
  model_version: string
  practice_06: {
    split_counts: {
      total: number
      optimizacion: number
      prueba: number
      ratios: string
    }
    cv: {
      estrategia: string
      n_splits: number
      shuffle: boolean
      seed: number
    }
    grid_search: MlP06SearchRow[]
    random_search: MlP06SearchRow[]
    comparacion: Array<{
      algoritmo: string
      gridsearch_f1_pct: number
      randomizedsearch_f1_pct: number
      diferencia_pp: number
    }>
    mejor_algoritmo: string
    mejor_f1_cv_pct: number
    mejores_hiperparametros: Record<string, string | number | null>
    final_test_metrics: MlMetricsResult
    notas_metodologicas: string[]
    comparacion_csv: string
  }
  practice_07: {
    limpieza: {
      registros_iniciales: number
      registros_finales: number
      duplicados_eliminados: number
      missing_by_column: Record<string, number>
      total_faltantes: number
      imputaciones_mediana: Array<{
        id: string
        variable: string
        mediana_usada: number
      }>
      correcciones_rango: Array<{
        id: string
        variable: string
        valor_original: number
        valor_ajustado: number
      }>
      estrategia: string
    }
    describe: Record<
      string,
      { mean: number; std: number; min: number; max: number }
    >
    elbow: Array<{ k: number; inercia: number }>
    silhouette_por_k: Array<{ k: number; silhouette: number; inercia: number }>
    k_final: number
    inercia_final: number
    silhouette_final: number
    iteraciones: number
    perfiles: MlClusterProfile[]
    scatter: Array<{ x: number; y: number; cluster: number }>
    centroides: Array<{
      cluster: number
      x: number
      y: number
      perfil: string
      valores: Record<string, number>
    }>
    new_case_segment: {
      cluster: number
      perfil: string
      distancia_centroide: number
      color: string
      centroide: Record<string, number>
    } | null
    segmentados_csv: string
    perfiles_csv: string
  }
  practice_08: {
    inicializaciones: Array<{
      inicializacion: string
      inercia: number
      silhouette: number
    }>
    escaladores: Array<{
      escalador: string
      inercia: number
      silhouette: number
    }>
    estabilidad: {
      semillas: number[]
      matriz_ari: number[][]
      pares: Array<{ semilla_a: number; semilla_b: number; ari: number }>
      ari_promedio: number
      interpretacion: string
    }
    centroides: Array<{
      cluster: number
      perfil: string
      horas_estudio: number
      asistencia: number
      actividades: number
      participacion: number
    }>
    perfiles: MlClusterProfile[]
    atipicos: {
      percentil: number
      umbral_distancia: number
      total_candidatos: number
      porcentaje: number
      distancias: Array<{
        id: string
        cluster: number
        distancia: number
        silhouette: number
        atipico: boolean
      }>
      top_candidatos: Array<{
        id: string
        cluster: number
        distancia: number
        silhouette: number
        atipico: boolean
      }>
    }
    silhouette_final: number
    reporte_csv: string
    nota_atipicos: string
  }
  practice_09: {
    varianza_objetivo_pct: number
    variance_table: Array<{
      componente: string
      varianza_pct: number
      acumulada_pct: number
    }>
    componentes_necesarias: number
    varianza_conservada_pct: number
    loadings: Array<{
      componente: string
      horas_estudio: number
      asistencia: number
      actividades: number
      participacion: number
    }>
    variables: string[]
    scatter_2d: Array<{ x: number; y: number; cluster: number }>
    reconstruccion_mse: number
    coords_csv: string
    varianza_csv: string
    nota_pca: string
  }
}

export interface MlLabSimulateInput {
  horas_estudio: number
  asistencia: number
  actividades_entregadas: number
  participacion?: number
  min_horas_rule?: number
  min_asistencia_rule?: number
  min_actividades_rule?: number
  max_depth?: number
  knn_neighbors?: number
  rf_estimators?: number
  dt_max_depth?: number
}

export const auraApi = {
  command: (data: AuraCommandInput) => apiRequest<AuraReply>('/aura/command', { method: 'POST', body: data }),
  confirm: (token: string) => apiRequest<AuraReply>('/aura/confirm', { method: 'POST', body: { token } }),
  cancel: (token: string) => apiRequest<AuraReply>('/aura/cancel', { method: 'POST', body: { token } }),
  ollamaStatus: () => apiRequest<OllamaStatus>('/aura/ollama/status'),
  ollamaCreateModel: (baseModel = 'qwen2.5:3b') =>
    apiRequest<OllamaCreateModelResponse>('/aura/ollama/create-model', {
      method: 'POST',
      body: { base_model: baseModel },
    }),
  ollamaAutomate: (payload: { task: OllamaAutomationTask; prompt: string; role_hint?: string }) =>
    apiRequest<OllamaAutomateResponse>('/aura/ollama/automate', {
      method: 'POST',
      body: payload,
    }),
  mlLabOverview: () => apiRequest<MlLabOverviewResponse>('/aura/ml-lab/overview'),
  mlLabSimulate: (payload: MlLabSimulateInput) =>
    apiRequest<MlLabOverviewResponse>('/aura/ml-lab/simulate', {
      method: 'POST',
      body: payload,
    }),
  mlLabAdvanced: (payload: MlAdvancedInput) =>
    apiRequest<MlAdvancedResponse>('/aura/ml-lab/advanced', {
      method: 'POST',
      body: payload,
    }),
  mlLabTalentSuite: () =>
    apiRequest<MlTalentSuiteResponse>('/aura/ml-lab/talent-suite'),
  mlLabCnnTrajectory: (payload: MlCnnTrajectoryInput) =>
    apiRequest<MlCnnTrajectorySimulation>('/aura/ml-lab/cnn-trajectory', {
      method: 'POST',
      body: payload,
    }),
  mlLabEvaluateDossier: (payload: MlCandidateDossierInput) =>
    apiRequest<MlDossierEvaluationResponse>('/aura/ml-lab/evaluate-dossier', {
      method: 'POST',
      body: payload,
    }),
}
