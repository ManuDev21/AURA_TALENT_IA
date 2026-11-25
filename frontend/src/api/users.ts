import { apiRequest } from '@/api/client'
import type { UserMe } from '@/types/auth'

export interface UserUpdatePayload {
  full_name?: string
  phone?: string | null
  locale?: 'es' | 'en'
}

/** Datos personales de la cuenta autenticada. */
export const usersApi = {
  me: () => apiRequest<UserMe>('/users/me'),
  updateMe: (data: UserUpdatePayload) =>
    apiRequest<UserMe>('/users/me', { method: 'PATCH', body: data }),
  deleteMe: () => apiRequest<void>('/users/me', { method: 'DELETE' }),
}
