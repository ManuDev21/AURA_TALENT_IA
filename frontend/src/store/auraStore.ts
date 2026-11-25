import { create } from 'zustand'

export type AuraCoreState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'ANALYZING'
  | 'SPEAKING'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR'
  | 'VISION'
  | 'GESTURE'

/** Posicion del nucleo en la escena segun el layout activo. */
export interface CorePlacement {
  x: number
  y: number
  scale: number
}

export const PLACEMENTS = {
  center: { x: 0, y: 0.15, scale: 1 },
  focus: { x: -1.95, y: 0.12, scale: 0.86 },
  focusWide: { x: -2.35, y: 0.12, scale: 0.76 },
  auth: { x: -1.7, y: 0, scale: 1 },
  mobile: { x: 0, y: 1.55, scale: 0.36 },
  mobileFocus: { x: 0.85, y: 1.85, scale: 0.24 },
} satisfies Record<string, CorePlacement>

interface AuraState {
  coreState: AuraCoreState
  placement: CorePlacement
  /** Nivel de audio 0-1 (microfono al escuchar, envolvente de la voz al hablar). Se lee por frame, sin re-render. */
  audioLevel: number
  setAudioLevel: (level: number) => void
  /** Hacia donde "mira" el nucleo: -1..1 en cada eje (raton o cursor de gestos). */
  gaze: { x: number; y: number }
  setGaze: (x: number, y: number) => void
  /** Notificaciones sin leer: se muestran como satelites alrededor del nucleo. */
  unread: number
  setUnread: (n: number) => void
  /** Contador que se incrementa con cada SUCCESS/ERROR para disparar la onda expansiva. */
  shockwave: { id: number; color: string }
  setCoreState: (state: AuraCoreState) => void
  /** Estado transitorio que vuelve a IDLE despues de `ms`. */
  pulse: (state: AuraCoreState, ms?: number) => void
  setPlacement: (placement: CorePlacement) => void
}

let pulseTimer: ReturnType<typeof setTimeout> | undefined

const SHOCK_COLORS: Partial<Record<AuraCoreState, string>> = {
  SUCCESS: '#ffb547',
  ERROR: '#ff5a3c',
  WARNING: '#ffd166',
  GESTURE: '#ff8a1a',
  THINKING: '#38bdf8',
}

export const useAuraStore = create<AuraState>((set, get) => ({
  coreState: 'IDLE',
  placement: PLACEMENTS.center,
  audioLevel: 0,
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  gaze: { x: 0, y: 0 },
  setGaze: (x, y) => set({ gaze: { x, y } }),
  unread: 0,
  setUnread: (unread) => set({ unread }),
  shockwave: { id: 0, color: '#ffb547' },
  setCoreState: (coreState) => {
    clearTimeout(pulseTimer)
    set({ coreState })
  },
  pulse: (coreState, ms = 1600) => {
    clearTimeout(pulseTimer)
    const color = SHOCK_COLORS[coreState]
    if (color) set({ shockwave: { id: get().shockwave.id + 1, color } })
    set({ coreState })
    pulseTimer = setTimeout(() => set({ coreState: 'IDLE' }), ms)
  },
  setPlacement: (placement) => set({ placement }),
}))
