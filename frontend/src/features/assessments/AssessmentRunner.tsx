import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Clock, FlaskConical, Play, Send, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { assessmentKeys, assessmentsApi } from '@/api/assessments'
import { ApiError } from '@/api/client'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { FormAlert } from '@/features/auth/FormAlert'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { useAuraStore } from '@/store/auraStore'
import { toast } from '@/store/toastStore'
import type { AttemptResult, AttemptSession, Question } from '@/types/assessments'
import { cn } from '@/utils/cn'

interface RunnerProps {
  versionId: string
  assignmentId?: string | null
  onFinished: (result: AttemptResult) => void
  onExit: () => void
}

/** START -> EXPLICACION -> CONSENTIMIENTO -> PREGUNTAS -> ENVIO. */
export function AssessmentRunner({ versionId, assignmentId, onFinished, onExit }: RunnerProps) {
  const { data: intro } = useQuery({ queryKey: assessmentKeys.intro(versionId), queryFn: () => assessmentsApi.intro(versionId) })
  const [consent, setConsent] = useState(false)
  const [session, setSession] = useState<AttemptSession | null>(null)
  const start = useAuraMutation({
    mutationFn: () => assessmentsApi.start({ version_id: versionId, consent, assignment_id: assignmentId }),
    onSuccess: setSession,
  })

  if (session) return <QuestionFlow session={session} onFinished={onFinished} onExit={onExit} />
  if (!intro) {
    return (
      <div className="flex justify-center py-10">
        <AuraLoader label="Preparando evaluacion" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-xl font-semibold">{intro.title}</h3>
        {intro.is_experimental && (
          <AuraBadge tone="warning">
            <FlaskConical className="h-3 w-3" aria-hidden="true" /> Experimental
          </AuraBadge>
        )}
      </div>
      {intro.description && <p className="text-sm text-graphite-300">{intro.description}</p>}
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Stat label="Preguntas" value={String(intro.question_count)} />
        <Stat label="Tiempo" value={intro.time_limit_seconds ? `${Math.round(intro.time_limit_seconds / 60)} min` : 'Sin limite'} />
        <Stat label="Version" value={`v${intro.version_no}`} />
      </dl>
      {intro.instructions && (
        <section className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-graphite-300">
          <h4 className="hud-label mb-1 text-aura-400">Instrucciones</h4>
          {intro.instructions}
        </section>
      )}
      {intro.limitations_text && (
        <section className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-graphite-300">
          <h4 className="hud-label mb-1 text-aura-400">Limitaciones</h4>
          {intro.limitations_text}
        </section>
      )}
      {intro.disclaimer_text && <p className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">{intro.disclaimer_text}</p>}
      {assignmentId && (
        <p className="flex items-start gap-2 text-xs text-graphite-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
          {intro.type_code === 'psychometric'
            ? 'Esta evaluacion fue solicitada por una empresa. Tu resultado NO se compartira salvo que tu lo decidas despues.'
            : 'Esta evaluacion fue solicitada por una empresa y el resultado se compartira con ella.'}
        </p>
      )}
      {intro.requires_consent && (
        <div className="neo-inset rounded-xl p-4">
          {intro.consent_text && <p className="mb-3 text-sm text-graphite-300">{intro.consent_text}</p>}
          <AuraCheckbox label="He leido la explicacion y acepto responder esta evaluacion." checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        </div>
      )}
      <FormAlert message={start.error instanceof ApiError ? start.error.message : ''} />
      <div className="flex justify-end gap-2">
        <AuraButton variant="ghost" onClick={onExit}>
          Volver
        </AuraButton>
        <AuraButton icon={Play} loading={start.isPending} disabled={intro.requires_consent && !consent} onClick={() => start.mutate()}>
          Comenzar
        </AuraButton>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="neo-inset rounded-xl p-3">
      <dt className="hud-label text-graphite-400">{label}</dt>
      <dd className="font-display text-lg text-bone">{value}</dd>
    </div>
  )
}

type Answers = Record<string, { option_id?: string; numeric_value?: number }>

function initialAnswers(session: AttemptSession): Answers {
  return Object.fromEntries(
    Object.entries(session.answers).map(([qid, a]) => [
      qid,
      { option_id: a.option_id ?? undefined, numeric_value: a.numeric_value != null ? Number(a.numeric_value) : undefined },
    ]),
  )
}

function QuestionFlow({ session, onFinished, onExit }: { session: AttemptSession; onFinished: (r: AttemptResult) => void; onExit: () => void }) {
  const [answers, setAnswers] = useState<Answers>(() => initialAnswers(session))
  const [index, setIndex] = useState(() => Math.max(0, session.questions.findIndex((q) => !(q.id in session.answers))))
  const [reviewing, setReviewing] = useState(false)
  const shownAt = useRef(Date.now())
  const total = session.questions.length
  const question = session.questions[Math.min(index, total - 1)] as Question
  const answeredCount = session.questions.filter((q) => q.id in answers).length
  const remaining = useCountdown(session.expires_at)

  useEffect(() => {
    shownAt.current = Date.now()
    useAuraStore.getState().setCoreState('LISTENING')
  }, [index])

  const submit = useAuraMutation({
    mutationFn: () => {
      useAuraStore.getState().setCoreState('ANALYZING')
      return assessmentsApi.submit(session.attempt_id)
    },
    invalidate: [assessmentKeys.catalog, assessmentKeys.history],
    success: 'Evaluacion enviada.',
    onSuccess: onFinished,
  })

  const choose = useCallback(
    (value: { option_id?: string; numeric_value?: number }) => {
      setAnswers((prev) => ({ ...prev, [question.id]: value }))
      assessmentsApi
        .answer(session.attempt_id, { question_id: question.id, ...value, time_ms: Date.now() - shownAt.current })
        .catch((err: unknown) => toast.error(err instanceof ApiError ? err.message : 'No se guardo la respuesta.'))
      if (index < total - 1) setTimeout(() => setIndex((i) => i + 1), 220)
    },
    [index, question.id, session.attempt_id, total],
  )

  useEffect(() => {
    if (reviewing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (question.scale && /^[1-9]$/.test(e.key)) {
        const n = Number(e.key)
        if (n >= question.scale.min && n <= question.scale.max) choose({ numeric_value: n })
      } else if (!question.scale && /^[a-z]$/i.test(e.key)) {
        const option = question.options[e.key.toLowerCase().charCodeAt(0) - 97]
        if (option) choose({ option_id: option.id })
      } else if (e.key === 'ArrowRight' && index < total - 1) setIndex(index + 1)
      else if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose, index, question, reviewing, total])

  if (reviewing) {
    const missing = total - answeredCount
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="font-display text-lg">Listo para enviar</p>
        <p className="text-sm text-graphite-300">
          Respondiste {answeredCount} de {total} preguntas.
          {missing > 0 && session.type_code !== 'psychometric' && ' Las preguntas sin responder cuentan como incorrectas.'}
          {missing > 0 && session.type_code === 'psychometric' && ' Este instrumento necesita todas las respuestas.'}
        </p>
        <FormAlert message={submit.error instanceof ApiError ? submit.error.message : ''} />
        <div className="flex gap-2">
          <AuraButton variant="ghost" icon={ArrowLeft} onClick={() => setReviewing(false)}>
            Revisar respuestas
          </AuraButton>
          <AuraButton icon={Send} loading={submit.isPending} onClick={() => submit.mutate()}>
            Enviar evaluacion
          </AuraButton>
        </div>
      </div>
    )
  }

  const current = answers[question.id]
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div
          className="neo-inset h-2 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answeredCount}
          aria-label="Preguntas respondidas"
        >
          <div className="h-full rounded-full bg-gradient-to-r from-amber-glow to-aura-600 transition-[width] duration-500" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
        <span className="font-mono text-xs text-graphite-300">
          {index + 1}/{total}
        </span>
        {remaining !== null && (
          <span className={cn('flex items-center gap-1 font-mono text-xs', remaining < 60 ? 'text-danger' : 'text-graphite-300')} aria-live="polite">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </span>
        )}
      </div>

      <fieldset key={question.id} className="flex flex-col gap-4">
        <legend className="mb-2 text-lg leading-snug text-bone">{question.stem}</legend>
        {question.scale ? (
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Escala de acuerdo">
            {Array.from({ length: question.scale.max - question.scale.min + 1 }, (_, i) => question.scale!.min + i).map((n) => {
              const selected = current?.numeric_value === n
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose({ numeric_value: n })}
                  className={cn(
                    'flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl p-2 text-center transition',
                    selected ? 'neo text-aura-400 shadow-[0_0_24px_-6px_rgb(255_122_26/0.8)]' : 'border border-white/5 text-graphite-300 hover:text-bone',
                  )}
                >
                  <span className="font-display text-xl">{n}</span>
                  <span className="text-[0.62rem] leading-tight">{question.scale!.labels[String(n)]}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Opciones">
            {question.options.map((o, i) => {
              const selected = current?.option_id === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose({ option_id: o.id })}
                  className={cn(
                    'flex items-start gap-3 rounded-xl p-3 text-left text-sm transition',
                    selected ? 'neo text-bone shadow-[0_0_24px_-8px_rgb(255_122_26/0.8)]' : 'border border-white/5 text-graphite-300 hover:text-bone',
                  )}
                >
                  <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs', selected ? 'bg-aura-500 text-ink' : 'bg-white/5')}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {o.label}
                </button>
              )
            })}
          </div>
        )}
      </fieldset>
      <p className="text-[0.7rem] text-graphite-400">
        Atajos: {question.scale ? `teclas ${question.scale.min}-${question.scale.max}` : 'teclas A, B, C...'} para responder; flechas para moverte.
        Tus respuestas se guardan automaticamente.
      </p>

      <div className="flex items-center justify-between gap-2">
        <AuraButton variant="ghost" size="sm" icon={ArrowLeft} disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Anterior
        </AuraButton>
        <AuraButton variant="ghost" size="sm" onClick={onExit}>
          Continuar despues
        </AuraButton>
        {index < total - 1 ? (
          <AuraButton variant="neo" size="sm" icon={ArrowRight} onClick={() => setIndex(index + 1)}>
            Siguiente
          </AuraButton>
        ) : (
          <AuraButton size="sm" icon={Send} onClick={() => setReviewing(true)}>
            Terminar
          </AuraButton>
        )}
      </div>
    </div>
  )
}

const secondsLeft = (expiresAt: string | null) =>
  expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)) : null

function useCountdown(expiresAt: string | null): number | null {
  const [left, setLeft] = useState(() => secondsLeft(expiresAt))
  useEffect(() => {
    if (!expiresAt) return
    const timer = setInterval(() => setLeft(secondsLeft(expiresAt)), 1000)
    return () => clearInterval(timer)
  }, [expiresAt])
  return left
}
