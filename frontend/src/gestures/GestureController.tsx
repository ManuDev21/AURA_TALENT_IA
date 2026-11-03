import { ChevronsUpDown, Hand, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import { AREA_MODULES } from '@/aura/modules'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { CameraConsent } from '@/features/vision/CameraConsent'
import { useCameraConsent } from '@/features/vision/useCameraConsent'
import { classifyPose, detectSwipe, type Point, type Pose, PoseStabilizer, scrollVelocity } from '@/gestures/classify'
import { useGestureStore } from '@/gestures/gestureStore'
import { useAuraStore } from '@/store/auraStore'
import { toast } from '@/store/toastStore'
import type { AuraArea } from '@/utils/roles'
import { acquireCamera, CameraError, releaseCamera } from '@/vision/camera'
import { loadHandLandmarker } from '@/vision/mediapipe'
import { stopSpeaking } from '@/voice/voiceEngine'

const POSE_LABEL: Record<Pose, string> = {
  pinch: 'Pellizco: seleccionar',
  open_palm: 'Palma abierta: pausar',
  fist: 'Puno: volver al nucleo',
  point: 'Indice: mover cursor',
  two_fingers: 'Dos dedos: sube o baja la mano para desplazar',
  none: 'Mano detectada',
}
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]
const COOLDOWN_MS = 900

/**
 * Gesture Engine (Fase 10): la camara sigue la mano en el navegador y traduce gestos en acciones.
 * - Indice: mueve un cursor virtual.   - Pellizco: hace clic donde esta el cursor.
 * - Palma abierta: pausa (detiene la voz y cierra mensajes).   - Puno: vuelve al nucleo.
 * - Deslizar a izquierda/derecha: modulo anterior/siguiente.
 * - Dos dedos (indice y medio): subir o bajar la mano desplaza la seccion abierta.
 */

/** Contenedor desplazable bajo el cursor; si no hay, el workspace del modulo abierto. */
function scrollTarget(x: number, y: number): HTMLElement | null {
  let el = document.elementFromPoint(x, y) as HTMLElement | null
  while (el && el !== document.body) {
    const { overflowY } = getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4) return el
    el = el.parentElement
  }
  return document.getElementById('workspace')
}
export function GestureController({ area }: { area: AuraArea }) {
  const enabled = useGestureStore((s) => s.enabled)
  const setEnabled = useGestureStore((s) => s.setEnabled)
  const consent = useCameraConsent()
  if (!enabled) return null
  if (consent.loading) return null
  if (!consent.granted) {
    return createPortal(
      <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Permiso de camara para gestos">
        <AuraPanel eyebrow="Gestos" title="Control por gestos" className="relative w-full max-w-lg">
          <button type="button" aria-label="Cancelar" onClick={() => setEnabled(false)} className="absolute right-4 top-4 text-graphite-400 hover:text-bone">
            <X className="h-4 w-4" />
          </button>
          <CameraConsent
            purpose="Controla AURA con la mano: senala para mover el cursor, pellizca para seleccionar y desliza para cambiar de modulo."
            saving={consent.saving}
            onAccept={() => void consent.setGranted(true)}
          />
        </AuraPanel>
      </div>,
      document.body,
    )
  }
  return <GestureRuntime area={area} onStop={() => setEnabled(false)} />
}

function GestureRuntime({ area, onStop }: { area: AuraArea; onStop: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const locationRef = useRef(location.pathname)
  const navigateRef = useRef(navigate)
  const onStopRef = useRef(onStop)
  const [pose, setPose] = useState<Pose | null>(null)
  const [status, setStatus] = useState('Cargando modelo de manos...')
  locationRef.current = location.pathname
  navigateRef.current = navigate
  onStopRef.current = onStop

  useEffect(() => {
    let raf = 0
    let alive = true
    let acquired = false
    const stabilizer = new PoseStabilizer(4)
    const wrist: { x: number; t: number }[] = []
    const cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    let cooldownUntil = 0
    let lastPoseUi: Pose | null = null
    let scrollAnchor: number | null = null
    let scrollEl: HTMLElement | null = null

    const moduleStep = (dir: 1 | -1) => {
      const modules = AREA_MODULES[area].filter((m) => m.available)
      const current = locationRef.current.split('/')[2]
      const idx = modules.findIndex((m) => m.id === current)
      const next = modules[(idx + dir + modules.length) % modules.length]
      if (next) {
        navigateRef.current(`/${area}/${next.id}`)
        useAuraStore.getState().pulse('GESTURE', 950)
        toast.info(`Gesto: ${next.label}`)
      }
    }

    const act = (p: Pose) => {
      const aura = useAuraStore.getState()
      if (p === 'pinch') {
        const el = document.elementFromPoint(cursor.x, cursor.y)
        const target = el?.closest<HTMLElement>('button, a, [role="button"], [role="tab"], [role="option"], input, select, label')
        if (target) {
          target.click()
          if (target instanceof HTMLInputElement) target.focus()
          aura.pulse('SUCCESS', 1100)
        } else {
          aura.pulse('GESTURE', 700)
        }
      } else if (p === 'open_palm') {
        stopSpeaking()
        aura.pulse('GESTURE', 1200)
      } else if (p === 'fist') {
        navigateRef.current(`/${area}`)
        aura.pulse('SUCCESS', 1100)
      }
    }

    useAuraStore.getState().setCoreState('GESTURE')

    ;(async () => {
      try {
        const landmarker = await loadHandLandmarker()
        if (!alive) return
        const stream = await acquireCamera()
        if (!alive) {
          // Se desactivo mientras la camara encendia: liberarla de inmediato
          releaseCamera()
          return
        }
        acquired = true
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setStatus('Muestra tu mano a la camara')
        let last = 0
        const loop = (now: number) => {
          raf = requestAnimationFrame(loop)
          if (video.readyState < 2 || now - last < 40) return
          last = now
          const result = landmarker.detectForVideo(video, now)
          const hand = (result.landmarks[0] ?? []) as Point[]
          drawHand(canvasRef.current, hand)
          const aura = useAuraStore.getState()
          if (aura.coreState === 'IDLE') aura.setCoreState('GESTURE')
          if (hand.length < 21) {
            wrist.length = 0
            if (cursorRef.current) cursorRef.current.style.opacity = '0'
            if (lastPoseUi !== null) setPose((lastPoseUi = null))
            return
          }
          // Cursor: punta del indice, en espejo, con margen para alcanzar los bordes y suavizado
          const tip = hand[8]!
          const tx = (1 - (tip.x - 0.15) / 0.7) * window.innerWidth
          const ty = ((tip.y - 0.12) / 0.62) * window.innerHeight
          cursor.x += (Math.min(window.innerWidth, Math.max(0, tx)) - cursor.x) * 0.35
          cursor.y += (Math.min(window.innerHeight, Math.max(0, ty)) - cursor.y) * 0.35
          aura.setGaze((cursor.x / window.innerWidth) * 2 - 1, (cursor.y / window.innerHeight) * 2 - 1)
          if (cursorRef.current) {
            cursorRef.current.style.opacity = '1'
            cursorRef.current.style.transform = `translate(${cursor.x - 14}px, ${cursor.y - 14}px)`
          }
          wrist.push({ x: hand[0]!.x, t: now })
          while (wrist.length && now - wrist[0]!.t > 700) wrist.shift()
          const { pose: stable, changed } = stabilizer.push(classifyPose(hand))
          if (stable !== lastPoseUi) setPose((lastPoseUi = stable))
          if (stable === 'two_fingers') {
            // El punto medio entre indice y medio es el "joystick"; se fija al activar el gesto
            const y = (hand[8]!.y + hand[12]!.y) / 2
            if (scrollAnchor === null) {
              scrollAnchor = y
              scrollEl = scrollTarget(cursor.x, cursor.y)
            }
            const v = scrollVelocity(scrollAnchor, y)
            if (v !== 0 && scrollEl) scrollEl.scrollBy({ top: v * 1.6 })
            if (cursorRef.current) cursorRef.current.dataset.scroll = v === 0 ? 'idle' : v > 0 ? 'down' : 'up'
            return
          }
          scrollAnchor = null
          scrollEl = null
          if (cursorRef.current) delete cursorRef.current.dataset.scroll
          if (now < cooldownUntil) return
          const swipe = stable === 'open_palm' ? detectSwipe(wrist) : null
          if (swipe) {
            cooldownUntil = now + COOLDOWN_MS
            wrist.length = 0
            moduleStep(swipe === 'right' ? 1 : -1)
          } else if (changed && (stable === 'pinch' || stable === 'fist' || stable === 'open_palm')) {
            cooldownUntil = now + (stable === 'open_palm' ? 300 : COOLDOWN_MS)
            act(stable)
          }
        }
        raf = requestAnimationFrame(loop)
      } catch (err) {
        toast.error(err instanceof CameraError ? err.message : 'No se pudo cargar el modelo de manos.')
        onStopRef.current()
      }
    })()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      if (videoRef.current) videoRef.current.srcObject = null
      if (acquired) releaseCamera()
      if (useAuraStore.getState().coreState === 'GESTURE') useAuraStore.getState().setCoreState('IDLE')
    }
  }, [area])

  return createPortal(
    <>
      <div
        ref={cursorRef}
        className="pointer-events-none fixed left-0 top-0 z-[60] flex h-7 w-7 items-center justify-center rounded-full border-2 border-aura-400 opacity-0 shadow-[0_0_20px_rgb(255_122_26/0.9)] transition-opacity"
        style={{ background: pose === 'pinch' ? 'rgb(255 122 26 / 0.7)' : 'rgb(255 122 26 / 0.15)' }}
        aria-hidden="true"
      >
        {pose === 'two_fingers' && <ChevronsUpDown className="h-4 w-4 text-aura-400" />}
      </div>
      <aside className="glass pointer-events-auto fixed bottom-28 right-4 z-50 w-48 overflow-hidden rounded-2xl" aria-label="Control por gestos activo">
        <div className="relative aspect-[4/3] bg-black">
          <video ref={videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover opacity-70" aria-hidden="true" />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 p-2">
          <Hand className="h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
          <p className="flex-1 truncate text-[0.7rem] text-graphite-300" aria-live="polite">
            {pose ? POSE_LABEL[pose] : status}
          </p>
          <button type="button" onClick={onStop} aria-label="Desactivar gestos" className="text-graphite-400 hover:text-bone">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>
    </>,
    document.body,
  )
}

function drawHand(canvas: HTMLCanvasElement | null, hand: Point[]) {
  if (!canvas) return
  const { clientWidth: w, clientHeight: h } = canvas
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  if (hand.length < 21) return
  ctx.strokeStyle = '#ffb547'
  ctx.lineWidth = 1.5
  for (const [a, b] of CONNECTIONS) {
    ctx.beginPath()
    ctx.moveTo(hand[a]!.x * w, hand[a]!.y * h)
    ctx.lineTo(hand[b]!.x * w, hand[b]!.y * h)
    ctx.stroke()
  }
  ctx.fillStyle = '#ff7a1a'
  for (const p of hand) {
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
}
