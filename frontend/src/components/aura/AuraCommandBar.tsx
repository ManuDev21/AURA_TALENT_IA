import { Check, Clock, Command, CornerDownLeft, Mic, MicOff, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { type AuraReply, auraApi } from '@/api/aura'
import { parseCommand } from '@/aura/commands'
import { AREA_MODULES, AREA_SUGGESTIONS } from '@/aura/modules'
import { useCommandHistory } from '@/aura/useCommandHistory'
import { useLogout } from '@/features/auth/useAuthActions'
import { useAuraStore } from '@/store/auraStore'
import { cn } from '@/utils/cn'
import type { AuraArea } from '@/utils/roles'
import {
  isEmbeddedBrowser,
  ListeningSession,
  speak,
  speechRecognitionSupported,
  speechSynthesisSupported,
  stopSpeaking,
  VOICE_ERRORS,
} from '@/voice/voiceEngine'

const VOICE_REPLIES_KEY = 'aura.voiceReplies'
type Tone = 'ok' | 'warn' | 'confirm'
interface ReplyState {
  text: string
  tone: Tone
  details: string[]
  token?: string
}

export function AuraCommandBar({ area }: { area: AuraArea }) {
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useLogout()
  const { history, push } = useCommandHistory()
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionRef = useRef<ListeningSession | null>(null)
  const listId = useId()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [reply, setReply] = useState<ReplyState | null>(null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [busy, setBusy] = useState(false)
  const [voiceReplies, setVoiceReplies] = useState(() => localStorage.getItem(VOICE_REPLIES_KEY) === '1')
  const canListen = speechRecognitionSupported()
  const canSpeak = speechSynthesisSupported()

  const options = useMemo(() => {
    const query = value.trim().toLowerCase()
    const recent = history.map((text) => ({ text, recent: true }))
    const suggestions = AREA_SUGGESTIONS[area].filter((s) => !history.includes(s)).map((text) => ({ text, recent: false }))
    const all = [...recent, ...suggestions]
    return (query ? all.filter((o) => o.text.toLowerCase().includes(query)) : all).slice(0, 7)
  }, [area, history, value])

  useEffect(() => {
    if (!reply || reply.tone === 'confirm') return
    const timer = setTimeout(() => setReply(null), reply.details.length ? 12000 : 7000)
    return () => clearTimeout(timer)
  }, [reply])

  useEffect(() => () => sessionRef.current?.stop(), [])

  const respond = useCallback(
    (next: ReplyState, spoken: boolean) => {
      setReply(next)
      if ((spoken || voiceReplies) && canSpeak) void speak(next.text)
    },
    [canSpeak, voiceReplies],
  )

  /** Fallback local (sin conexion o comando de navegacion simple). */
  const runLocal = useCallback(
    (command: string, spoken: boolean) => {
      const aura = useAuraStore.getState()
      const result = parseCommand(command, AREA_MODULES[area])
      if (result.kind === 'navigate') navigate(`/${area}/${result.moduleId}`)
      if (result.kind === 'home') navigate(`/${area}`)
      if (result.kind === 'logout') {
        void logout()
        return
      }
      aura.pulse(result.kind === 'unknown' ? 'WARNING' : result.kind === 'help' ? 'SPEAKING' : 'SUCCESS', 2000)
      respond({ text: result.message, tone: result.kind === 'unknown' ? 'warn' : 'ok', details: [] }, spoken)
    },
    [area, logout, navigate, respond],
  )

  const apply = useCallback(
    (res: AuraReply, spoken: boolean) => {
      const aura = useAuraStore.getState()
      if (res.action?.type === 'navigate') navigate(res.action.path)
      if (res.outcome === 'needs_confirmation' && res.confirmation) {
        aura.setCoreState('IDLE')
        respond({ text: res.reply, tone: 'confirm', details: res.details, token: res.confirmation.token }, spoken)
        return
      }
      aura.pulse(res.outcome === 'ok' ? 'SUCCESS' : 'WARNING', 1800)
      respond({ text: res.reply, tone: res.outcome === 'ok' || res.outcome === 'cancelled' ? 'ok' : 'warn', details: res.details }, spoken)
    },
    [navigate, respond],
  )

  const submit = useCallback(
    async (text: string, channel: 'text' | 'voice') => {
      const command = text.trim()
      if (!command) return
      push(command)
      setValue('')
      setOpen(false)
      setActive(-1)
      stopSpeaking()
      setBusy(true)
      useAuraStore.getState().setCoreState('THINKING')
      const [, , moduleId] = location.pathname.split('/')
      const jobId = new URLSearchParams(location.search).get('job')
      try {
        const res = await auraApi.command({ text: command, channel, area, context: { module: moduleId ?? null, job_id: jobId } })
        if (res.outcome === 'unknown') runLocal(command, channel === 'voice')
        else apply(res, channel === 'voice')
      } catch {
        runLocal(command, channel === 'voice')
      } finally {
        setBusy(false)
      }
    },
    [apply, area, location.pathname, location.search, push, runLocal],
  )

  const decide = async (confirm: boolean) => {
    if (!reply?.token) return
    const token = reply.token
    setReply(null)
    useAuraStore.getState().setCoreState('ANALYZING')
    try {
      apply(confirm ? await auraApi.confirm(token) : await auraApi.cancel(token), false)
    } catch {
      useAuraStore.getState().pulse('ERROR')
      respond({ text: 'La confirmacion expiro. Vuelve a pedirlo a AURA.', tone: 'warn', details: [] }, false)
    }
  }

  const stopListening = useCallback(() => {
    sessionRef.current?.stop()
    sessionRef.current = null
    setListening(false)
    setInterim('')
  }, [])

  const startListening = useCallback(async () => {
    if (isEmbeddedBrowser() || !canListen) {
      useAuraStore.getState().pulse('WARNING')
      respond({ text: VOICE_ERRORS[isEmbeddedBrowser() ? 'embedded' : 'unsupported'], tone: 'warn', details: [] }, false)
      return
    }
    stopSpeaking()
    setReply(null)
    setInterim('')
    setListening(true)
    const session = new ListeningSession()
    sessionRef.current = session
    let heard = false
    await session.start({
      onInterim: setInterim,
      onFinal: (text) => {
        heard = true
        setInterim('')
        setListening(false)
        void submit(text, 'voice')
      },
      onError: (code) => {
        setListening(false)
        setInterim('')
        useAuraStore.getState().pulse('WARNING')
        respond({ text: VOICE_ERRORS[code], tone: 'warn', details: [] }, false)
      },
      onEnd: () => {
        setListening(false)
        setInterim('')
        sessionRef.current = null
        if (!heard && useAuraStore.getState().coreState === 'LISTENING') useAuraStore.getState().setCoreState('IDLE')
      },
    })
  }, [canListen, respond, submit])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'Space') {
        event.preventDefault()
        if (sessionRef.current) stopListening()
        else void startListening()
      } else if (event.key === 'Escape' && sessionRef.current) {
        stopListening()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [startListening, stopListening])

  const toggleVoiceReplies = () => {
    const next = !voiceReplies
    setVoiceReplies(next)
    localStorage.setItem(VOICE_REPLIES_KEY, next ? '1' : '0')
    if (!next) stopSpeaking()
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit(active >= 0 ? (options[active]?.text ?? value) : value, 'text')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, -1))
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <div className="pointer-events-auto relative w-full max-w-2xl">
      <div aria-live="polite" className="absolute inset-x-0 bottom-full mb-3 flex justify-center">
        {listening ? (
          <p className="glass flex items-center gap-3 rounded-xl px-4 py-2 text-sm text-bone">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aura-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-aura-500" />
            </span>
            {interim || 'Te escucho...'}
            <span className="text-[0.65rem] text-graphite-400">Esc para cancelar</span>
          </p>
        ) : (
          reply && (
            <div
              className={cn(
                'glass flex max-w-full flex-col gap-2 rounded-xl px-4 py-2.5 text-sm',
                reply.tone === 'warn' ? 'text-warning' : 'text-bone',
                reply.tone === 'confirm' && 'border border-aura-500/50',
              )}
            >
              <p className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
                {reply.text}
              </p>
              {reply.details.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-10 text-xs text-graphite-300">
                  {reply.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
              {reply.tone === 'confirm' && (
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => void decide(false)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs text-graphite-300 hover:bg-white/5">
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-aura-400 to-aura-600 px-3 py-1 text-xs text-ink"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Confirmar
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {open && !listening && options.length > 0 && (
        <ul id={listId} role="listbox" aria-label="Sugerencias de comandos" className="glass absolute inset-x-0 bottom-full mb-3 overflow-hidden rounded-2xl py-2">
          {options.map((option, i) => (
            <li
              key={option.text}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(event) => {
                event.preventDefault()
                void submit(option.text, 'text')
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center gap-3 px-4 py-2 text-sm', i === active ? 'bg-aura-500/10 text-bone' : 'text-graphite-300')}
            >
              {option.recent ? <Clock className="h-4 w-4 text-graphite-400" aria-hidden="true" /> : <Sparkles className="h-4 w-4 text-aura-400" aria-hidden="true" />}
              {option.text}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="glass flex items-center gap-2 rounded-2xl p-2 pl-4 shadow-[0_0_40px_-12px_rgb(255_122_26/0.5)]">
        <Command className="h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => {
            setOpen(true)
            if (!busy) useAuraStore.getState().setCoreState('LISTENING')
          }}
          onBlur={() => {
            setOpen(false)
            if (!sessionRef.current && useAuraStore.getState().coreState === 'LISTENING') useAuraStore.getState().setCoreState('IDLE')
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Pregunta a AURA"
          placeholder="Pregunta a AURA...   (Ctrl + K)"
          className="h-10 w-full bg-transparent text-sm text-bone placeholder:text-graphite-400 focus:outline-none focus-visible:shadow-none focus-visible:outline-none"
        />
        {canSpeak && (
          <button
            type="button"
            onClick={toggleVoiceReplies}
            aria-pressed={voiceReplies}
            aria-label={voiceReplies ? 'Desactivar respuestas habladas' : 'Activar respuestas habladas'}
            title={voiceReplies ? 'AURA responde en voz alta' : 'AURA responde solo por texto (y en voz cuando le hablas)'}
            className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition', voiceReplies ? 'text-aura-400' : 'text-graphite-400 hover:text-bone')}
          >
            {voiceReplies ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => (listening ? stopListening() : void startListening())}
          aria-pressed={listening}
          aria-label={canListen ? (listening ? 'Detener escucha' : 'Hablar con AURA (Ctrl + Shift + Espacio)') : 'Voz no disponible en este navegador'}
          title={canListen ? 'Hablar con AURA (Ctrl + Shift + Espacio)' : VOICE_ERRORS.unsupported}
          className={cn(
            'neo flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition',
            listening ? 'text-aura-400 shadow-[0_0_24px_-2px_rgb(255_122_26/0.9)]' : canListen ? 'text-graphite-300 hover:text-aura-400' : 'text-graphite-500 opacity-60',
          )}
        >
          {canListen ? <Mic className="h-4 w-4" aria-hidden="true" /> : <MicOff className="h-4 w-4" aria-hidden="true" />}
        </button>
        <button
          type="submit"
          aria-label="Enviar comando"
          disabled={busy}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aura-400 to-aura-600 text-ink transition hover:brightness-110 disabled:opacity-60"
        >
          <CornerDownLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}
