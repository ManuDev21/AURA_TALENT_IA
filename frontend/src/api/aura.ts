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
}
