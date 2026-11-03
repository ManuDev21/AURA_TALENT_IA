import { apiRequest } from '@/api/client'
import type { GoogleAuthPayload, LoginPayload, RegisterPayload, RoleRead, TokenResponse, UserMe } from '@/types/auth'

export const authApi = {
  login: (payload: LoginPayload) =>
    apiRequest<TokenResponse>('/auth/login', { method: 'POST', body: payload, auth: false }),
  register: (payload: RegisterPayload) =>
    apiRequest<TokenResponse>('/auth/register', { method: 'POST', body: payload, auth: false }),
  googleAuth: (payload: GoogleAuthPayload) =>
    apiRequest<TokenResponse>('/auth/google', { method: 'POST', body: payload, auth: false }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST', auth: false }),
  me: () => apiRequest<UserMe>('/auth/me'),
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (token: string, newPassword: string) =>
    apiRequest<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, new_password: newPassword },
      auth: false,
    }),
}

export const adminApi = {
  roles: () => apiRequest<RoleRead[]>('/admin/roles'),
}
