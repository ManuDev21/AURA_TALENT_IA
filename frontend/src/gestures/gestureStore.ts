import { create } from 'zustand'

interface GestureState {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

/** Control por gestos activado por la persona (nunca se enciende solo). */
export const useGestureStore = create<GestureState>((set) => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
}))
