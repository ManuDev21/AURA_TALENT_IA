/**
 * Clasificador de gestos a partir de los 21 puntos de la mano de MediaPipe (coordenadas normalizadas).
 * Logica pura y testeable: estatico por cuadro + deslizamiento por historial de la muñeca.
 */

export interface Point {
  x: number
  y: number
  z?: number
}

export type Pose = 'pinch' | 'open_palm' | 'fist' | 'point' | 'two_fingers' | 'none'
export type Swipe = 'left' | 'right' | null

// Indices de MediaPipe Hands
const WRIST = 0
const THUMB_TIP = 4
const INDEX_PIP = 6
const INDEX_TIP = 8
const MIDDLE_MCP = 9
const FINGERS: [number, number][] = [
  [8, 6],
  [12, 10],
  [16, 14],
  [20, 18],
]

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** Un dedo esta extendido si su punta esta mas lejos de la muñeca que su articulacion media. */
function extended(hand: Point[], tip: number, pip: number): boolean {
  return dist(hand[tip]!, hand[WRIST]!) > dist(hand[pip]!, hand[WRIST]!) * 1.12
}

export function classifyPose(hand: Point[]): Pose {
  if (hand.length < 21) return 'none'
  const size = dist(hand[WRIST]!, hand[MIDDLE_MCP]!) || 1
  const pinchGap = dist(hand[THUMB_TIP]!, hand[INDEX_TIP]!) / size
  const ext = FINGERS.map(([t, p]) => extended(hand, t, p))
  const count = ext.filter(Boolean).length
  if (pinchGap < 0.28) return 'pinch'
  if (count === 4) return 'open_palm'
  if (count === 0 && dist(hand[INDEX_TIP]!, hand[WRIST]!) < dist(hand[INDEX_PIP]!, hand[WRIST]!) * 1.05) return 'fist'
  if (ext[0] && count === 1) return 'point'
  if (ext[0] && ext[1] && !ext[2] && !ext[3]) return 'two_fingers'
  return 'none'
}

/**
 * Desplazamiento tipo joystick: devuelve pixeles por cuadro segun cuanto se aleja la mano (eje y normalizado)
 * del punto donde se activo el gesto. Zona muerta para evitar movimientos accidentales.
 */
export function scrollVelocity(anchorY: number, currentY: number, deadZone = 0.035, maxPx = 42): number {
  const dy = currentY - anchorY
  const magnitude = Math.abs(dy) - deadZone
  if (magnitude <= 0) return 0
  return Math.sign(dy) * Math.min(maxPx, Math.round(magnitude * 260 + magnitude * magnitude * 900))
}

/** Detecta un deslizamiento horizontal rapido de la muñeca dentro de una ventana de tiempo. */
export function detectSwipe(history: { x: number; t: number }[], windowMs = 450, minDistance = 0.22): Swipe {
  if (history.length < 4) return null
  const last = history[history.length - 1]!
  const recent = history.filter((h) => last.t - h.t <= windowMs)
  if (recent.length < 4) return null
  const dx = last.x - recent[0]!.x
  if (Math.abs(dx) < minDistance) return null
  // En la imagen sin espejo, mover la mano hacia la derecha del usuario reduce x
  return dx < 0 ? 'right' : 'left'
}

/** Estabilizador: confirma una pose solo cuando se mantiene `frames` cuadros seguidos. */
export class PoseStabilizer {
  private current: Pose = 'none'
  private streak = 0
  private confirmed: Pose = 'none'

  constructor(private frames = 4) {}

  push(pose: Pose): { pose: Pose; changed: boolean } {
    this.streak = pose === this.current ? this.streak + 1 : 1
    this.current = pose
    if (this.streak >= this.frames && pose !== this.confirmed) {
      this.confirmed = pose
      return { pose, changed: true }
    }
    return { pose: this.confirmed, changed: false }
  }
}
