import type { AuraCoreState } from '@/store/auraStore'

export interface CorePreset {
  amplitude: number
  frequency: number
  speed: number
  energy: number
  rim: number
  scan: number
  colorA: string
  colorB: string
  halo: number
  ringSpeed: number
  particleSpeed: number
  scale: number
}

const IDLE: CorePreset = {
  amplitude: 0.14,
  frequency: 1.6,
  speed: 0.35,
  energy: 1.15,
  rim: 1.4,
  scan: 0.28,
  colorA: '#ff6a00',
  colorB: '#ffb347',
  halo: 0.78,
  ringSpeed: 0.25,
  particleSpeed: 0.08,
  scale: 1,
}

export const CORE_PRESETS: Record<AuraCoreState, CorePreset> = {
  IDLE,
  LISTENING: { ...IDLE, amplitude: 0.22, frequency: 2.1, speed: 0.65, energy: 1.3, halo: 0.92, scale: 1.08 },
  THINKING: { ...IDLE, amplitude: 0.19, frequency: 3, speed: 1.2, energy: 1.25, halo: 0.9, ringSpeed: 0.9, particleSpeed: 0.22 },
  ANALYZING: { ...IDLE, amplitude: 0.17, frequency: 2.4, speed: 0.95, energy: 1.22, scan: 1, ringSpeed: 0.55, particleSpeed: 0.14 },
  SPEAKING: { ...IDLE, amplitude: 0.25, frequency: 1.9, speed: 0.85, energy: 1.38, halo: 0.98, ringSpeed: 0.5, scale: 1.06 },
  SUCCESS: {
    ...IDLE,
    amplitude: 0.2,
    energy: 1.55,
    rim: 1.65,
    scan: 0.7,
    colorA: '#ff8a1a',
    colorB: '#9cf0c0',
    halo: 1.2,
    ringSpeed: 0.75,
    particleSpeed: 0.18,
    scale: 1.14,
  },
  WARNING: { ...IDLE, speed: 0.55, energy: 1.2, colorA: '#ffa000', colorB: '#ffd166', halo: 0.88 },
  ERROR: {
    ...IDLE,
    amplitude: 0.3,
    frequency: 4,
    speed: 0.3,
    energy: 0.75,
    colorA: '#8f1d16',
    colorB: '#ff5a3c',
    halo: 0.45,
    ringSpeed: 0.08,
    scale: 0.95,
  },
  VISION: { ...IDLE, energy: 1.28, scan: 1, colorB: '#ffd29a', halo: 0.9, ringSpeed: 0.42 },
  GESTURE: {
    ...IDLE,
    amplitude: 0.25,
    frequency: 2.35,
    speed: 0.85,
    energy: 1.42,
    rim: 1.65,
    scan: 0.85,
    colorA: '#ff7a1a',
    colorB: '#ffd166',
    halo: 1.05,
    ringSpeed: 0.7,
    particleSpeed: 0.18,
    scale: 1.1,
  },
}
