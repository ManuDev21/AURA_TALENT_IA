import { apiRequest } from '@/api/client'

export interface AuditItem {
  id: string
  created_at: string
  actor: string | null
  actor_type: 'human' | 'system' | 'ai'
  module: string
  action: string
  result: 'success' | 'denied' | 'error'
  entity_type: string | null
  entity_id: string | null
  ip: string | null
  request_id: string | null
}

export interface AuditPage {
  total: number
  page: number
  page_size: number
  modules: string[]
  items: AuditItem[]
}

export interface ModelRegistry {
  engines: { name: string; version: string; task: string; method: string; limitations: string }[]
  registered: { name: string; version: string; task: string; status: string }[]
}

export const adminApi = {
  audit: (params: Record<string, string>) => apiRequest<AuditPage>(`/admin/audit?${new URLSearchParams(params)}`),
  models: () => apiRequest<ModelRegistry>('/admin/models'),
}
