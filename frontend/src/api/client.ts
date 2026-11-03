import { useSessionStore } from '@/store/sessionStore'
import type { TokenResponse } from '@/types/auth'

const API_BASE = '/api/v1'

export interface ApiFieldError {
  field: string
  message: string
  type: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown
  readonly requestId: string | null

  constructor(status: number, code: string, message: string, details: unknown, requestId: string | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }

  get fieldErrors(): ApiFieldError[] {
    return Array.isArray(this.details) ? (this.details as ApiFieldError[]) : []
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
  retryOnUnauthorized?: boolean
}

let refreshInFlight: Promise<string | null> | null = null

async function toApiError(response: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; details?: unknown; request_id?: string } } = {}
  try {
    body = await response.json()
  } catch {
    // respuesta sin cuerpo JSON
  }
  const error = body.error ?? {}
  return new ApiError(
    response.status,
    error.code ?? `http_${response.status}`,
    error.message ?? 'No fue posible completar la solicitud.',
    error.details ?? null,
    error.request_id ?? response.headers.get('X-Request-ID'),
  )
}

/** Renueva el access token usando la cookie de refresh. Deduplica llamadas concurrentes. */
export function refreshSession(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      if (!response.ok) {
        useSessionStore.getState().clearSession()
        return null
      }
      const data = (await response.json()) as TokenResponse
      useSessionStore.getState().setSession(data)
      return data.access_token
    } catch {
      useSessionStore.getState().clearSession()
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

/** Peticion autenticada con renovacion automatica de la sesion ante un 401. */
async function send(path: string, init: RequestInit, auth: boolean, retry = true): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = useSessionStore.getState().accessToken
  if (auth && token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' })
  if (response.status === 401 && auth && retry && (await refreshSession())) {
    return send(path, init, auth, false)
  }
  if (!response.ok) throw await toApiError(response)
  return response
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, retryOnUnauthorized = true } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await send(
    path,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    auth,
    retryOnUnauthorized,
  )
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const response = await send(path, { method: 'POST', body: form, headers: { Accept: 'application/json' } }, true)
  return (await response.json()) as T
}

/** Descarga un archivo del API y lo entrega al navegador sin exponer el token en la URL. */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const response = await send(path, { method: 'GET' }, true)
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
