import { describe, expect, it } from 'vitest'
import { readPresence, sessionScore } from '@/vision/presence'

const centered = { x: 0.35, y: 0.2, width: 0.3, height: 0.4 }

describe('readPresence', () => {
  it('reconoce un encuadre correcto', () => {
    const r = readPresence([centered], 0.5)
    expect(r.face).toBe(true)
    expect([r.framing.level, r.distance.level, r.light.level]).toEqual(['ok', 'ok', 'ok'])
  })

  it('da indicaciones concretas cuando algo falla', () => {
    expect(readPresence([], 0.5).framing.tip).toContain('No veo tu rostro')
    expect(readPresence([{ ...centered, x: 0.0 }], 0.5).framing.level).toBe('bad')
    expect(readPresence([{ ...centered, width: 0.1, x: 0.45 }], 0.5).distance.tip).toContain('lejos')
    expect(readPresence([centered], 0.1).light.level).toBe('bad')
  })
})

describe('sessionScore', () => {
  it('calcula el porcentaje de tiempo con buena presencia', () => {
    const good = readPresence([centered], 0.5)
    const bad = readPresence([], 0.5)
    expect(sessionScore([good, good, good, bad])).toBe(75)
    expect(sessionScore([])).toBe(0)
  })
})
