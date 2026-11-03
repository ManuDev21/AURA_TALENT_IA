import { describe, expect, it } from 'vitest'
import { classifyPose, detectSwipe, type Point, PoseStabilizer, scrollVelocity } from '@/gestures/classify'

/** Mano sintetica vertical: muñeca abajo, dedos hacia arriba. `ext` indica dedos extendidos (indice..meñique). */
function hand(ext: [boolean, boolean, boolean, boolean], pinch = false): Point[] {
  const pts: Point[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }))
  pts[0] = { x: 0.5, y: 0.8 }
  pts[9] = { x: 0.5, y: 0.6 }
  const columns = [0.42, 0.48, 0.54, 0.6]
  ;[
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ].forEach((ids, f) => {
    const x = columns[f]!
    pts[ids[0]!] = { x, y: 0.6 }
    pts[ids[1]!] = { x, y: 0.5 }
    pts[ids[2]!] = ext[f] ? { x, y: 0.42 } : { x, y: 0.58 }
    pts[ids[3]!] = ext[f] ? { x, y: 0.35 } : { x, y: 0.66 }
  })
  pts[4] = pinch ? { x: pts[8]!.x + 0.01, y: pts[8]!.y } : { x: 0.3, y: 0.62 }
  return pts
}

describe('classifyPose', () => {
  it('reconoce palma abierta, puno, senalar y pellizco', () => {
    expect(classifyPose(hand([true, true, true, true]))).toBe('open_palm')
    expect(classifyPose(hand([false, false, false, false]))).toBe('fist')
    expect(classifyPose(hand([true, false, false, false]))).toBe('point')
    expect(classifyPose(hand([true, false, false, false], true))).toBe('pinch')
    expect(classifyPose(hand([true, true, false, false]))).toBe('two_fingers')
    expect(classifyPose([])).toBe('none')
  })
})

describe('detectSwipe', () => {
  it('detecta deslizamientos rapidos y descarta movimientos lentos', () => {
    const fast = [0.7, 0.6, 0.5, 0.4].map((x, i) => ({ x, t: i * 80 }))
    expect(detectSwipe(fast)).toBe('right')
    expect(detectSwipe([...fast].reverse().map((h, i) => ({ x: h.x, t: i * 80 })))).toBe('left')
    const slow = [0.7, 0.6, 0.5, 0.4].map((x, i) => ({ x, t: i * 400 }))
    expect(detectSwipe(slow)).toBeNull()
  })
})

describe('scrollVelocity', () => {
  it('no desplaza dentro de la zona muerta y acelera al alejarse', () => {
    expect(scrollVelocity(0.5, 0.52)).toBe(0)
    const slow = scrollVelocity(0.5, 0.58)
    const fast = scrollVelocity(0.5, 0.7)
    expect(slow).toBeGreaterThan(0)
    expect(fast).toBeGreaterThan(slow)
    expect(scrollVelocity(0.5, 0.3)).toBeLessThan(0)
    expect(scrollVelocity(0.5, 1)).toBe(42)
  })
})

describe('PoseStabilizer', () => {
  it('confirma solo poses sostenidas', () => {
    const s = new PoseStabilizer(3)
    expect(s.push('pinch').changed).toBe(false)
    expect(s.push('pinch').changed).toBe(false)
    expect(s.push('pinch')).toEqual({ pose: 'pinch', changed: true })
    expect(s.push('pinch').changed).toBe(false)
    expect(s.push('fist').pose).toBe('pinch')
  })
})
