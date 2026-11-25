import { useAuraStore } from '@/store/auraStore'

/**
 * Voice Engine de AURA.
 * - Reconocimiento: Web Speech API del navegador (es-MX). Al servidor solo viaja el texto reconocido.
 * - Nivel de microfono: Web Audio API (AnalyserNode) -> audioLevel del nucleo mientras escucha.
 * - Voz: speechSynthesis con voz en espanol; una envolvente sintetica anima el nucleo mientras habla.
 */

export type VoiceErrorCode = 'unsupported' | 'embedded' | 'denied' | 'no-mic' | 'mic-busy' | 'no-speech' | 'network' | 'other'

export const VOICE_ERRORS: Record<VoiceErrorCode, string> = {
  unsupported: 'Tu navegador no admite reconocimiento de voz. Usa Chrome o Edge, o escribe tu comando.',
  embedded:
    'La vista previa del editor no permite usar el microfono. Abre http://localhost:5173 en Chrome o Edge para hablar con AURA.',
  'no-mic': 'No se encontro ningun microfono conectado. Revisa que este conectado y habilitado en Windows.',
  'mic-busy': 'El microfono esta ocupado por otra app. Cierrala e intentalo de nuevo.',
  denied: 'No hay permiso para usar el microfono. Puedes activarlo en el candado de la barra de direcciones.',
  'no-speech': 'No escuche nada. Intenta de nuevo o escribe tu comando.',
  network: 'El servicio de reconocimiento del navegador no respondio. Revisa tu conexion o escribe tu comando.',
  other: 'No fue posible usar la voz en este momento. Puedes escribir tu comando.',
}

/** Vistas previas embebidas (Electron, webviews de editores) exponen la API pero no pueden usarla. */
export function isEmbeddedBrowser(): boolean {
  return typeof navigator !== 'undefined' && /electron|wv\)|vscode|devin|windsurf/i.test(navigator.userAgent)
}

export function speechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)
}

const NO_RESULT_TIMEOUT_MS = 9000

export function speechSynthesisSupported(): boolean {
  const ok = typeof window !== 'undefined' && 'speechSynthesis' in window
  // En moviles la lista de voces se carga de forma perezosa: pedirla aqui la "precalienta"
  if (ok) window.speechSynthesis.getVoices()
  return ok
}

interface ListenHandlers {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (code: VoiceErrorCode) => void
  onEnd: () => void
}

/** Sesion de escucha: reconoce una frase y anima el nucleo con el volumen real del microfono. */
export class ListeningSession {
  private recognition: SpeechRecognition | null = null
  private stream: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private raf = 0
  private finished = false
  private timeout: ReturnType<typeof setTimeout> | undefined

  async start(handlers: ListenHandlers): Promise<void> {
    const fail = (code: VoiceErrorCode, detail?: unknown) => {
      console.warn('[AURA voz]', code, detail ?? '')
      this.stop()
      handlers.onError(code)
      handlers.onEnd()
    }
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (isEmbeddedBrowser()) return fail('embedded')
    if (!Ctor) return fail('unsupported')

    // 1. Permiso de microfono primero: asi el navegador siempre muestra su aviso y detectamos rechazos.
    //    El stream se libera de inmediato: en Android el reconocimiento recibe silencio
    //    si otro consumo mantiene el microfono ocupado al mismo tiempo.
    const isMobileDevice = /android|iphone|ipad|ipod/i.test(navigator.userAgent)
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const permStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        })
        permStream.getTracks().forEach((t) => t.stop())
      } catch (err) {
        const name = err instanceof DOMException ? err.name : ''
        return fail(name === 'NotFoundError' ? 'no-mic' : name === 'NotAllowedError' ? 'denied' : 'other', err)
      }
    }

    const recognition = new Ctor()
    recognition.lang = 'es-MX'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result?.[0]?.transcript ?? ''
        clearTimeout(this.timeout)
        if (result?.isFinal) {
          this.finished = true
          handlers.onFinal(text.trim())
        } else interim += text
      }
      if (interim) handlers.onInterim(interim)
    }
    recognition.onerror = (event) => {
      const map: Record<string, VoiceErrorCode> = {
        'not-allowed': 'denied',
        'service-not-allowed': 'denied',
        'audio-capture': 'mic-busy',
        'no-speech': 'no-speech',
        network: 'network',
        aborted: 'other',
      }
      console.warn('[AURA voz] error de reconocimiento:', event.error)
      if (event.error !== 'aborted') handlers.onError(map[event.error] ?? 'other')
    }
    recognition.onend = () => {
      clearTimeout(this.timeout)
      this.stopMeter()
      handlers.onEnd()
    }
    this.recognition = recognition
    useAuraStore.getState().setCoreState('LISTENING')
    try {
      recognition.start()
    } catch (err) {
      return fail('other', err)
    }
    // 2. Si no llega ningun resultado, se corta con un mensaje claro en lugar de quedarse esperando.
    this.timeout = setTimeout(() => {
      if (!this.finished) {
        handlers.onError('no-speech')
        this.stop()
      }
    }, NO_RESULT_TIMEOUT_MS)
    // En movil no se vuelve a tomar el microfono para el medidor: el reconocimiento
    // ya lo esta usando y Chrome Android no comparte la captura. Es decorativo.
    if (!isMobileDevice) void this.acquireMeter()
  }

  /** Nivel de microfono para el nucleo: stream nuevo (el de permiso ya se libero). */
  private async acquireMeter(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      if (!this.recognition) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      this.stream = stream
      this.startMeter()
    } catch {
      /* el medidor es solo una animacion: el reconocimiento sigue sin el */
    }
  }

  private startMeter(): void {
    if (!this.stream) return
    this.audioCtx = new AudioContext()
    const analyser = this.audioCtx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.6
    this.audioCtx.createMediaStreamSource(this.stream).connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (const v of data) {
        const x = (v - 128) / 128
        sum += x * x
      }
      const rms = Math.sqrt(sum / data.length)
      useAuraStore.getState().setAudioLevel(Math.min(1, rms * 5.5))
      this.raf = requestAnimationFrame(tick)
    }
    tick()
  }

  private stopMeter(): void {
    cancelAnimationFrame(this.raf)
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.audioCtx?.close().catch(() => undefined)
    this.stream = null
    this.audioCtx = null
    useAuraStore.getState().setAudioLevel(0)
  }

  stop(): void {
    clearTimeout(this.timeout)
    this.recognition?.stop()
    this.recognition = null
    this.stopMeter()
  }
}

function spanishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === 'es-MX') ??
    voices.find((v) => v.lang.startsWith('es') && /natural|online/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('es'))
  )
}

let speakRaf = 0

/** Lee un texto en voz alta. El nucleo pasa a SPEAKING y vibra con una envolvente ligada a cada palabra. */
export function speak(text: string): Promise<void> {
  if (!speechSynthesisSupported() || !text) return Promise.resolve()
  const synth = window.speechSynthesis
  synth.cancel()
  // En Chrome/Android la sintesis queda pausada tras cancel(); resume() la reanuda
  synth.resume()
  cancelAnimationFrame(speakRaf)
  const aura = useAuraStore.getState()
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-MX'
    utterance.rate = 1.02
    const voice = spanishVoice()
    if (voice) utterance.voice = voice
    let accent = 0
    const started = performance.now()
    const animate = () => {
      const t = (performance.now() - started) / 1000
      accent *= 0.9
      const syllables = 0.35 + 0.25 * Math.abs(Math.sin(t * 9.5)) * (0.6 + 0.4 * Math.sin(t * 2.3))
      aura.setAudioLevel(Math.min(1, syllables + accent))
      speakRaf = requestAnimationFrame(animate)
    }
    const finish = () => {
      cancelAnimationFrame(speakRaf)
      aura.setAudioLevel(0)
      if (useAuraStore.getState().coreState === 'SPEAKING') aura.setCoreState('IDLE')
      resolve()
    }
    utterance.onstart = () => {
      aura.setCoreState('SPEAKING')
      animate()
    }
    utterance.onboundary = () => {
      accent = 0.35
    }
    utterance.onend = finish
    utterance.onerror = finish
    synth.speak(utterance)
  })
}

export function stopSpeaking(): void {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel()
  cancelAnimationFrame(speakRaf)
  useAuraStore.getState().setAudioLevel(0)
}
