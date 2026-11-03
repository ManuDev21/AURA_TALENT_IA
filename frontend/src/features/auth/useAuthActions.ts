import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { authApi } from '@/api/auth'
import { useAuraStore } from '@/store/auraStore'
import { useSessionStore } from '@/store/sessionStore'
import type { GoogleAuthPayload, LoginPayload, RegisterPayload, TokenResponse } from '@/types/auth'
import { homePathFor } from '@/utils/roles'

function useSessionStart() {
  const navigate = useNavigate()
  const location = useLocation()
  return (data: TokenResponse) => {
    useSessionStore.getState().setSession(data)
    useAuraStore.getState().pulse('SUCCESS')
    const from = (location.state as { from?: string } | null)?.from
    const home = homePathFor(data.user)
    navigate(from?.startsWith(home) ? from : home, { replace: true })
  }
}

export function useLogin() {
  const start = useSessionStart()
  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onMutate: () => useAuraStore.getState().setCoreState('THINKING'),
    onSuccess: start,
    onError: () => useAuraStore.getState().pulse('ERROR'),
  })
}

export function useRegister() {
  const start = useSessionStart()
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onMutate: () => useAuraStore.getState().setCoreState('THINKING'),
    onSuccess: start,
    onError: () => useAuraStore.getState().pulse('ERROR'),
  })
}

export function useGoogleAuth() {
  const start = useSessionStart()
  return useMutation({
    mutationFn: (payload: GoogleAuthPayload) => authApi.googleAuth(payload),
    onMutate: () => useAuraStore.getState().setCoreState('THINKING'),
    onSuccess: start,
    onError: () => useAuraStore.getState().pulse('ERROR'),
  })
}

export function useLogout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return async () => {
    try {
      await authApi.logout()
    } finally {
      useSessionStore.getState().clearSession()
      queryClient.clear()
      useAuraStore.getState().setCoreState('IDLE')
      navigate('/login', { replace: true })
    }
  }
}
