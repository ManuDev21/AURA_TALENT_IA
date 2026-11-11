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
}
