import { apiRequest } from '@/api/client'
import type { CareerPath, CareerSearchResult, HeuristicType, NodeStatus, PathSummary, RecommendationSet, RoleCoverage, SearchAlgorithm, SearchMode } from '@/types/career'

export const careerKeys = {
  roles: ['career', 'roles'] as const,
  paths: ['career', 'paths'] as const,
  path: (id: string) => ['career', 'path', id] as const,
  recs: ['recommendations'] as const,
}

export const careerApi = {
  roles: () => apiRequest<{ catalog_version: string; roles: RoleCoverage[]; note: string }>('/career/roles'),
  paths: () => apiRequest<PathSummary[]>('/career/paths'),
  path: (id: string) => apiRequest<CareerPath>(`/career/paths/${id}`),
  search: (id: string, algorithm: SearchAlgorithm, mode: SearchMode, limit: number, heuristic: HeuristicType = 'manhattan') =>
    apiRequest<CareerSearchResult>(`/career/paths/${id}/search/${algorithm}?mode=${mode}&limit=${limit}&heuristic=${heuristic}`),
  createPath: (roleCode: string) => apiRequest<CareerPath>('/career/paths', { method: 'POST', body: { role_code: roleCode } }),
  setNode: (pathId: string, nodeId: string, status: NodeStatus) =>
    apiRequest<CareerPath>(`/career/paths/${pathId}/nodes/${nodeId}`, { method: 'PATCH', body: { status } }),
  deletePath: (id: string) => apiRequest<void>(`/career/paths/${id}`, { method: 'DELETE' }),
}

export const recsApi = {
  current: () => apiRequest<RecommendationSet>('/recommendations/me'),
  refresh: () => apiRequest<RecommendationSet>('/recommendations/me/refresh', { method: 'POST' }),
  feedback: (id: string, action: 'view' | 'click' | 'save' | 'dismiss' | 'apply') =>
    apiRequest<void>(`/recommendations/${id}/feedback`, { method: 'POST', body: { action } }),
}
