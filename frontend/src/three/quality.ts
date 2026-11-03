export type QualityTier = 'high' | 'medium' | 'low'

/** Tier inicial segun dispositivo; el PerformanceMonitor lo baja si el FPS cae. */
export function initialQualityTier(): QualityTier {
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = window.matchMedia('(max-width: 767px)').matches
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  if (small || coarse || cores <= 4 || memory <= 4) return 'low'
  return cores >= 12 && memory >= 8 ? 'high' : 'medium'
}

export const PARTICLE_COUNT: Record<QualityTier, number> = { high: 720, medium: 420, low: 200 }
