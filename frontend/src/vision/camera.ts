/**
 * Camara compartida por Vision (Fase 9) y Gestos (Fase 10).
 * Un solo flujo de video para toda la app; se libera cuando nadie lo usa. Nada se graba ni se envia.
 */

export type CameraErrorCode = 'embedded' | 'denied' | 'no-camera' | 'busy' | 'other'

export const CAMERA_ERRORS: Record<CameraErrorCode, string> = {
  embedded: 'La vista previa del editor no permite usar la camara. Abre http://localhost:5173 en Chrome o Edge.',
  denied: 'No hay permiso para usar la camara. Puedes activarlo en el candado de la barra de direcciones.',
  'no-camera': 'No se encontro ninguna camara conectada.',
  busy: 'La camara esta siendo usada por otra aplicacion (por ejemplo Zoom o Teams). Cierrala e intenta de nuevo.',
  other: 'No fue posible abrir la camara.',
}

export class CameraError extends Error {
  constructor(public code: CameraErrorCode) {
    super(CAMERA_ERRORS[code])
  }
}

let stream: MediaStream | null = null
let opening: Promise<MediaStream> | null = null
let users = 0

function open(): Promise<MediaStream> {
  // Una sola apertura en curso: peticiones simultaneas comparten el mismo flujo (evita camaras huerfanas)
  opening ??= navigator.mediaDevices
    .getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 30 } },
      audio: false,
    })
    .then((s) => (stream = s))
    .catch((err: unknown) => {
      const name = err instanceof DOMException ? err.name : ''
      throw new CameraError(
        name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' ? 'no-camera' : name === 'NotReadableError' ? 'busy' : 'other',
      )
    })
    .finally(() => {
      opening = null
    })
  return opening
}

export async function acquireCamera(): Promise<MediaStream> {
  if (/electron|wv\)|vscode|devin|windsurf/i.test(navigator.userAgent)) throw new CameraError('embedded')
  users += 1
  try {
    const s = stream ?? (await open())
    if (users === 0) {
      // Todos los usuarios se fueron mientras abria: apagar
      stopTracks()
      throw new CameraError('other')
    }
    return s
  } catch (err) {
    users = Math.max(0, users - 1)
    throw err
  }
}

function stopTracks(): void {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

export function releaseCamera(): void {
  users = Math.max(0, users - 1)
  if (users === 0) stopTracks()
}
