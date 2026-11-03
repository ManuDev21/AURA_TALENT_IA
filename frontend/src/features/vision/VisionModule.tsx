import { CircleCheck, CircleX, Power, ShieldOff, TriangleAlert, Video } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { CameraConsent } from '@/features/vision/CameraConsent'
import { useCameraConsent } from '@/features/vision/useCameraConsent'
import { useAuraStore } from '@/store/auraStore'
import { cn } from '@/utils/cn'
import { acquireCamera, CameraError, releaseCamera } from '@/vision/camera'
import { loadFaceDetector } from '@/vision/mediapipe'
import { type Level, type PresenceReading, readPresence, sessionScore } from '@/vision/presence'

const LEVEL_ICON = { ok: CircleCheck, warn: TriangleAlert, bad: CircleX } as const
const LEVEL_COLOR = { ok: 'text-success', warn: 'text-warning', bad: 'text-danger' } as const

export function VisionModule() {
  const consent = useCameraConsent()
  return (
    <AuraPanel eyebrow="Vision" title="Practica de presencia con camara" className="flex flex-col gap-4">
      {consent.loading ? (
        <div className="flex justify-center py-10">
          <AuraLoader label="Revisando permisos" />
        </div>
      ) : consent.granted ? (
        <VisionSession onRevoke={() => void consent.setGranted(false)} />
      ) : (
        <CameraConsent
          purpose="Practica como te ves en una entrevista en video: AURA revisa tu encuadre, distancia e iluminacion en tiempo real."
          saving={consent.saving}
          onAccept={() => void consent.setGranted(true)}
        />
      )}
    </AuraPanel>
  )
}

function VisionSession({ onRevoke }: { onRevoke: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sampleRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef(0)
  const samplesRef = useRef<PresenceReading[]>([])
  const activeRef = useRef(false)
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reading, setReading] = useState<PresenceReading | null>(null)
  const [score, setScore] = useState<number | null>(null)

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (videoRef.current) videoRef.current.srcObject = null
    if (activeRef.current) {
      activeRef.current = false
      releaseCamera()
      setScore(samplesRef.current.length > 20 ? sessionScore(samplesRef.current) : null)
    }
    setRunning(false)
    if (useAuraStore.getState().coreState === 'VISION') useAuraStore.getState().setCoreState('IDLE')
  }, [])

  useEffect(() => () => stop(), [stop])

  const start = async () => {
    setError('')
    setScore(null)
    setLoading(true)
    samplesRef.current = []
    try {
      const detector = await loadFaceDetector()
      const stream = await acquireCamera()
      activeRef.current = true
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setRunning(true)
      useAuraStore.getState().setCoreState('VISION')
      sampleRef.current ??= document.createElement('canvas')
      let last = 0
      let lastUi = 0
      const loop = (now: number) => {
        rafRef.current = requestAnimationFrame(loop)
        if (video.readyState < 2 || now - last < 66) return
        last = now
        const w = video.videoWidth
        const h = video.videoHeight
        const result = detector.detectForVideo(video, now)
        const boxes = result.detections
          .map((d) => d.boundingBox)
          .filter((b): b is NonNullable<typeof b> => !!b)
          .map((b) => ({ x: b.originX / w, y: b.originY / h, width: b.width / w, height: b.height / h }))
        const reading = readPresence(boxes, brightness(video, sampleRef.current!))
        samplesRef.current.push(reading)
        draw(canvasRef.current, boxes, reading)
        if (now - lastUi > 300) {
          lastUi = now
          setReading(reading)
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      stop()
      setError(err instanceof CameraError ? err.message : 'No se pudieron cargar los modelos de vision. Revisa tu conexion e intenta de nuevo.')
      useAuraStore.getState().pulse('WARNING')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="neo-inset relative aspect-video overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" aria-label="Vista previa de tu camara (en espejo)" />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100" aria-hidden="true" />
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-graphite-400">
              {loading ? <AuraLoader label="Encendiendo camara y cargando modelos" /> : <Video className="h-8 w-8" aria-hidden="true" />}
            </div>
          )}
          {running && (
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 font-mono text-[0.6rem] text-aura-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-aura-500" /> Procesando en tu equipo
            </span>
          )}
        </div>

        <aside className="flex flex-col gap-2" aria-live="polite">
          <h3 className="hud-label text-aura-400">Indicaciones en vivo</h3>
          {reading ? (
            <>
              <Indicator label="Encuadre" level={reading.framing.level} tip={reading.framing.tip} />
              <Indicator label="Distancia" level={reading.distance.level} tip={reading.distance.tip} />
              <Indicator label="Iluminacion" level={reading.light.level} tip={reading.light.tip} />
              {reading.faces > 1 && <p className="text-xs text-warning">Se detecta mas de una persona en cuadro.</p>}
            </>
          ) : (
            <p className="text-sm text-graphite-400">Enciende la camara para recibir indicaciones.</p>
          )}
          {score !== null && (
            <div className="neo-inset mt-2 rounded-xl p-3 text-center">
              <p className="hud-label text-graphite-400">Presencia en la sesion</p>
              <p className="font-display text-3xl text-aura-400">{score}%</p>
              <p className="text-[0.7rem] text-graphite-400">del tiempo con buen encuadre, distancia y luz</p>
            </div>
          )}
        </aside>
      </div>

      {error && <p className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-warning">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AuraButton variant="ghost" size="sm" icon={ShieldOff} onClick={() => { stop(); onRevoke() }}>
          Revocar permiso de camara
        </AuraButton>
        {running ? (
          <AuraButton variant="neo" icon={Power} onClick={stop}>
            Apagar camara
          </AuraButton>
        ) : (
          <AuraButton icon={Video} loading={loading} onClick={() => void start()}>
            Encender camara
          </AuraButton>
        )}
      </div>
      <p className="text-xs text-graphite-400">
        Esta practica es solo para ti: no evalua tu persona, no detecta emociones y no se comparte con ninguna empresa. Al apagar la camara solo
        queda el porcentaje de la sesion en esta pantalla.
      </p>
    </div>
  )
}

function Indicator({ label, level, tip }: { label: string; level: Level; tip: string }) {
  const Icon = LEVEL_ICON[level]
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className={cn('flex items-center gap-1.5 text-sm', LEVEL_COLOR[level])}>
        <Icon className="h-4 w-4" aria-hidden="true" /> {label}
      </p>
      <p className="mt-0.5 text-xs text-graphite-300">{tip}</p>
    </div>
  )
}

/** Brillo medio (0-1) sobre una muestra reducida del cuadro, sin guardar la imagen. */
function brightness(video: HTMLVideoElement, canvas: HTMLCanvasElement): number {
  canvas.width = 32
  canvas.height = 24
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0.5
  ctx.drawImage(video, 0, 0, 32, 24)
  const { data } = ctx.getImageData(0, 0, 32, 24)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!
  return sum / (data.length / 4) / 255
}

function draw(canvas: HTMLCanvasElement | null, boxes: { x: number; y: number; width: number; height: number }[], reading: PresenceReading) {
  if (!canvas) return
  const { clientWidth: w, clientHeight: h } = canvas
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.setLineDash([4, 6])
  ctx.strokeRect(w * 0.3, h * 0.12, w * 0.4, h * 0.62)
  ctx.setLineDash([])
  const color = reading.framing.level === 'ok' && reading.distance.level === 'ok' ? '#ff7a1a' : '#ffb547'
  for (const b of boxes) {
    const x = b.x * w
    const y = b.y * h
    const bw = b.width * w
    const bh = b.height * h
    const c = Math.min(bw, bh) * 0.22
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.shadowColor = color
    ctx.shadowBlur = 12
    for (const [px, py, dx, dy] of [
      [x, y, 1, 1],
      [x + bw, y, -1, 1],
      [x, y + bh, 1, -1],
      [x + bw, y + bh, -1, -1],
    ] as const) {
      ctx.beginPath()
      ctx.moveTo(px, py + dy * c)
      ctx.lineTo(px, py)
      ctx.lineTo(px + dx * c, py)
      ctx.stroke()
    }
  }
  ctx.shadowBlur = 0
}
