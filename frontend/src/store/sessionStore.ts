import { create } from 'zustand'
import type { TokenResponse, UserMe } from '@/types/auth'

type SessionStatus = 'unknown' | 'authenticated' | 'anonymous'

interface SessionState {
  status: SessionStatus
  accessToken: string | null
  user: UserMe | null
  setSession: (response: TokenResponse) => void
  setUser: (user: UserMe) => void
  clearSession: () => void
}

// El access token vive solo en memoria; el refresh token esta en una cookie httpOnly.
export const useSessionStore = create<SessionState>((set) => ({
  status: 'unknown',
  accessToken: null,
  user: null,
  setSession: (response) =>
    set({ status: 'authenticated', accessToken: response.access_token, user: response.user }),
  setUser: (user) => set({ user }),
  clearSession: () => set({ status: 'anonymous', accessToken: null, user: null }),
}))
