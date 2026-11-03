import { apiRequest } from '@/api/client'

export type ConsentType = 'camera' | 'voice' | 'external_ai_processing' | 'discoverable'
export type ConsentMap = Record<ConsentType, { granted: boolean; updated_at: string | null }>

export const privacyKeys = { consents: ['privacy', 'consents'] as const }

export const privacyApi = {
  consents: () => apiRequest<ConsentMap>('/privacy/consents/me'),
  set: (consent_type: ConsentType, granted: boolean) =>
    apiRequest<ConsentMap>('/privacy/consents/me', { method: 'POST', body: { consent_type, granted } }),
}
