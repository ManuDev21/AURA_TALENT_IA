/** Metricas de presencia para practica de entrevistas (logica pura, testeable). No identifica ni infiere emociones. */

export interface FaceBox {
  /** Coordenadas normalizadas 0-1 respecto al cuadro de video. */
  x: number
  y: number
  width: number
  height: number
}

export type Level = 'ok' | 'warn' | 'bad'

export interface PresenceReading {
  face: boolean
  faces: number
  framing: { level: Level; tip: string }
  distance: { level: Level; tip: string }
  light: { level: Level; tip: string }
}

export function readPresence(boxes: FaceBox[], brightness: number): PresenceReading {
  const light: PresenceReading['light'] =
    brightness < 0.25
      ? { level: 'bad', tip: 'Hay poca luz. Pon una fuente de luz frente a ti.' }
      : brightness > 0.85
        ? { level: 'warn', tip: 'Hay demasiada luz o contraluz. Evita ventanas detras de ti.' }
        : { level: 'ok', tip: 'La iluminacion es adecuada.' }
  if (boxes.length === 0) {
    return {
      face: false,
      faces: 0,
      framing: { level: 'bad', tip: 'No veo tu rostro. Colocate frente a la camara.' },
      distance: { level: 'bad', tip: 'Sin rostro detectado.' },
      light,
    }
  }
  const main = [...boxes].sort((a, b) => b.width * b.height - a.width * a.height)[0]!
  const cx = main.x + main.width / 2
  const cy = main.y + main.height / 2
  const offX = Math.abs(cx - 0.5)
  const offY = cy - 0.42
  const framing: PresenceReading['framing'] =
    offX > 0.18 || Math.abs(offY) > 0.2
      ? { level: 'bad', tip: offX > 0.18 ? `Muevete hacia ${cx < 0.5 ? 'tu izquierda' : 'tu derecha'} para centrarte.` : offY > 0 ? 'Sube un poco la camara o acercate al centro.' : 'Baja un poco la camara.' }
      : offX > 0.09 || Math.abs(offY) > 0.11
        ? { level: 'warn', tip: 'Casi centrado. Ajusta ligeramente tu posicion.' }
        : { level: 'ok', tip: 'Estas bien centrado.' }
  const size = main.width
  const distance: PresenceReading['distance'] =
    size < 0.16
      ? { level: 'bad', tip: 'Estas muy lejos. Acercate a la camara.' }
      : size < 0.22
        ? { level: 'warn', tip: 'Un poco lejos. Acercate ligeramente.' }
        : size > 0.55
          ? { level: 'bad', tip: 'Estas muy cerca. Alejate un poco.' }
          : size > 0.45
            ? { level: 'warn', tip: 'Un poco cerca.' }
            : { level: 'ok', tip: 'La distancia es adecuada.' }
  return { face: true, faces: boxes.length, framing, distance, light }
}

/** Puntaje de presencia de la sesion: % del tiempo con encuadre, distancia y luz correctos. */
export function sessionScore(samples: PresenceReading[]): number {
  if (!samples.length) return 0
  const good = samples.filter((s) => s.face && s.framing.level !== 'bad' && s.distance.level !== 'bad' && s.light.level !== 'bad')
  return Math.round((good.length / samples.length) * 100)
}
