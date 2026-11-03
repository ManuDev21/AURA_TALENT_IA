import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  ChartArea,
  ChartColumn,
  ChartPie,
  CheckCircle2,
  CirclePlay,
  Download,
  LockKeyhole,
  MessageSquare,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sigma,
  Sparkles,
  Table,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { applicationsApi, jobKeys } from '@/api/jobs'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraSelect, AuraTextarea } from '@/components/aura/AuraField'
import { AuraInfoBubble } from '@/components/aura/AuraInfoBubble'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { CANDIDATE_STAGE_LABELS } from '@/features/jobs/labels'
import { useCandidateOverview } from '@/features/talent/useProfileData'
import { useAuraStore } from '@/store/auraStore'
import { useSessionStore } from '@/store/sessionStore'
import { toast } from '@/store/toastStore'
import type { MyApplication } from '@/types/jobs'
import { ListeningSession, speak, stopSpeaking, VOICE_ERRORS } from '@/voice/voiceEngine'

type PrepMode = 'simulacion_aura' | 'ensayo_libre'

type Prompt = {
  title: string
  context: string
  type: 'general' | 'skill' | 'responsibility'
  targetSkill?: string
  keywords: string[]
}

interface QuestionEvaluation {
  index: number
  questionTitle: string
  category: string
  answer: string
  wordCount: number
  starScore: number
  competencyScore: number
  impactScore: number
  clarityScore: number
  totalScore: number
  manhattanGap: number
  hillAltitude: number
  auraFeedback: string
  detectedStar: string[]
}

const STAR = [
  { id: 'situation', label: 'Situacion: cual era el contexto o escenario?' },
  { id: 'task', label: 'Tarea: que objetivo o responsabilidad tenias?' },
  { id: 'action', label: 'Accion: que hiciste tu concretamente?' },
  { id: 'result', label: 'Resultado: que cambio lograste o que aprendiste?' },
]

const STAR_PATTERNS: Record<string, RegExp> = {
  situation: /\b(cuando|contexto|proyecto|equipo|empresa|situacion|escenario|etapa|problema|cliente)\b/i,
  task: /\b(objetivo|meta|responsabilidad|encargo|debia|necesitabamos|reto|requerimiento|tarea|desafio)\b/i,
  action: /\b(implemente|desarrolle|disene|construi|optimice|coordine|analice|propuse|configure|automatice|aplique|realice|hice|utilice)\b/i,
  result: /\b(resultado|logramos|redujo|aumento|mejoro|aprendi|impacto|entrega|produccion|exito|metricas|porcentaje|tiempo)\b/i,
}

const IMPACT_PATTERN = /(\d+%|\d+\s*(horas|dias|semanas|ms|segundos|usuarios|clientes|pruebas|modulos|veces)|reduj|aument|mejor|optimiz|increment|ahorr)/i

export function InterviewPrepModule() {
  const [params, setParams] = useSearchParams()
  const { data: applications, isPending } = useQuery({ queryKey: jobKeys.mine, queryFn: applicationsApi.mine })
  const { data: profile } = useCandidateOverview()
  const [mode, setMode] = useState<PrepMode>('simulacion_aura')

  const selectedId = params.get('application') ?? ''
  const active = (applications ?? []).filter((app) => app.status === 'active')
  const selected = active.find((app) => app.id === selectedId) ?? active[0]
  const declaredSkills = useMemo(() => profile?.skills.map((item) => item.skill.name) ?? [], [profile])
  const prompts = useMemo(
    () => (selected ? buildPrompts(selected, declaredSkills) : []),
    [selected, declaredSkills],
  )

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checks, setChecks] = useState<Record<string, string[]>>({})
  const prompt = prompts[index]
  const answerKey = `${selected?.id ?? ''}:${index}`
  const checked = checks[answerKey] ?? []

  useEffect(() => {
    return () => {
      stopSpeaking()
    }
  }, [])

  const reset = () => {
    stopSpeaking()
    setAnswers({})
    setChecks({})
    setIndex(0)
  }

  const downloadNotes = () => {
    if (!selected) return
    const text = prompts
      .map((item, i) => `PREGUNTA ${i + 1}: ${item.title}\n${answers[`${selected.id}:${i}`] ?? '(sin respuesta)'}\n`)
      .join('\n')
    const url = URL.createObjectURL(
      new Blob([`Ensayo privado - ${selected.job.title}\n\n${text}`], { type: 'text/plain;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `ensayo-${selected.job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AuraPanel eyebrow="Preparacion e Interaccion con AURA" title="Centro de Entrevista Simulada" className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-2xl border border-aura-500/20 bg-aura-500/[0.04] p-4 text-xs leading-relaxed text-graphite-300">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
        <p>
          <strong className="text-bone">Simulacion y practica privada.</strong> Tus respuestas se evaluan localmente en tu navegador mediante el algoritmo estructurado de efectividad de AURA (STAR + Cobertura de Competencias + Impacto + Ascenso Hill Climbing). Nunca modifican tu estado en el pipeline ni se envian a la empresa sin tu decision.
        </p>
      </div>

      {isPending ? (
        <div className="flex justify-center py-12">
          <AuraLoader label="Cargando tus postulaciones" />
        </div>
      ) : !active.length ? (
        <AuraEmptyState icon={Sparkles} title="Necesitas una postulacion activa para practicar">
          Postulate a una vacante y podras realizar una prueba de entrevista interactiva con AURA basada en sus responsabilidades y habilidades.
        </AuraEmptyState>
      ) : selected && prompt ? (
        <>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <AuraSelect
              label="Vacante objetivo para la entrevista"
              value={selected.id}
              onChange={(e) => {
                stopSpeaking()
                setParams({ application: e.target.value })
                setIndex(0)
                setAnswers({})
                setChecks({})
              }}
              options={active.map((app) => ({
                value: app.id,
                label: `${app.job.title} - ${app.job.company.name} (${CANDIDATE_STAGE_LABELS[app.current_stage]})`,
              }))}
            />

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Modo de entrevista">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'simulacion_aura'}
                onClick={() => setMode('simulacion_aura')}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium transition ${
                  mode === 'simulacion_aura'
                    ? 'border-aura-500/60 bg-aura-500/15 text-bone shadow-[0_0_20px_rgba(255,122,26,0.18)]'
                    : 'border-white/10 bg-black/30 text-graphite-300 hover:border-aura-500/30 hover:text-bone'
                }`}
              >
                <Sparkles className="h-4 w-4 text-aura-400" aria-hidden="true" />
                Realizar prueba de entrevista con AURA
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'ensayo_libre'}
                onClick={() => {
                  stopSpeaking()
                  setMode('ensayo_libre')
                }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium transition ${
                  mode === 'ensayo_libre'
                    ? 'border-aura-500/60 bg-aura-500/15 text-bone shadow-[0_0_20px_rgba(255,122,26,0.18)]'
                    : 'border-white/10 bg-black/30 text-graphite-300 hover:border-aura-500/30 hover:text-bone'
                }`}
              >
                <MessageSquare className="h-4 w-4 text-aura-400" aria-hidden="true" />
                Notas y ensayo libre
              </button>
            </div>
          </div>

          {mode === 'simulacion_aura' ? (
            <AuraInteractiveInterview
              application={selected}
              prompts={prompts}
              answers={answers}
              checks={checks}
              onUpdateAnswer={(qIdx, text) =>
                setAnswers((all) => ({ ...all, [`${selected.id}:${qIdx}`]: text }))
              }
              onToggleStar={(qIdx, starId, enabled) => {
                const key = `${selected.id}:${qIdx}`
                const currentList = checks[key] ?? []
                setChecks((all) => ({
                  ...all,
                  [key]: enabled ? [...currentList, starId] : currentList.filter((id) => id !== starId),
                }))
              }}
              onReset={reset}
              onDownload={downloadNotes}
            />
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <AuraBadge tone="aura">
                  Pregunta {index + 1} de {prompts.length}
                </AuraBadge>
                <AuraBadge tone="neutral">
                  {prompt.type === 'skill'
                    ? 'Habilidad tecnica'
                    : prompt.type === 'responsibility'
                      ? 'Responsabilidad del puesto'
                      : 'General'}
                </AuraBadge>
              </div>
              <section className="neo-inset flex flex-col gap-4 rounded-2xl p-5" aria-live="polite">
                <p className="font-display text-lg font-medium text-bone">{prompt.title}</p>
                <p className="text-sm text-graphite-300">{prompt.context}</p>
                <AuraTextarea
                  label="Tu respuesta de practica (solo en esta sesion)"
                  rows={7}
                  value={answers[answerKey] ?? ''}
                  onChange={(e) => setAnswers((all) => ({ ...all, [answerKey]: e.target.value }))}
                  placeholder="Escribe un ejemplo concreto de tu experiencia..."
                />
                <div className="rounded-xl border border-white/5 p-4">
                  <p className="hud-label mb-2.5 text-aura-400">Guia STAR para revisar tu respuesta</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {STAR.map((item) => (
                      <label key={item.id} className="flex items-start gap-2 text-xs text-graphite-300">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-orange-500"
                          checked={checked.includes(item.id)}
                          onChange={(e) =>
                            setChecks((all) => ({
                              ...all,
                              [answerKey]: e.target.checked
                                ? [...checked, item.id]
                                : checked.filter((id) => id !== item.id),
                            }))
                          }
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
              </section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <AuraButton
                  variant="ghost"
                  icon={ArrowLeft}
                  disabled={index === 0}
                  onClick={() => setIndex((value) => Math.max(0, value - 1))}
                >
                  Anterior
                </AuraButton>
                <div className="flex flex-wrap gap-2">
                  <AuraButton variant="ghost" icon={RotateCcw} onClick={reset}>
                    Borrar sesion
                  </AuraButton>
                  <AuraButton variant="neo" icon={Download} onClick={downloadNotes}>
                    Descargar mis notas
                  </AuraButton>
                  <AuraButton
                    icon={ArrowRight}
                    disabled={index >= prompts.length - 1}
                    onClick={() => setIndex((value) => Math.min(prompts.length - 1, value + 1))}
                  >
                    Siguiente
                  </AuraButton>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </AuraPanel>
  )
}

function AuraInteractiveInterview({
  application,
  prompts,
  answers,
  checks,
  onUpdateAnswer,
  onToggleStar,
  onReset,
  onDownload,
}: {
  application: MyApplication
  prompts: Prompt[]
  answers: Record<string, string>
  checks: Record<string, string[]>
  onUpdateAnswer: (qIdx: number, text: string) => void
  onToggleStar: (qIdx: number, starId: string, enabled: boolean) => void
  onReset: () => void
  onDownload: () => void
}) {
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [listening, setListening] = useState(false)
  const sessionRef = useRef<ListeningSession | null>(null)

  const currentPrompt = prompts[currentStep]
  const currentKey = `${application.id}:${currentStep}`
  const currentAnswer = answers[currentKey] ?? ''
  const currentChecked = checks[currentKey] ?? []

  const evaluations = useMemo(
    () =>
      prompts.map((item, idx) =>
        evaluateResponse(
          idx,
          item,
          answers[`${application.id}:${idx}`] ?? '',
          checks[`${application.id}:${idx}`] ?? [],
        ),
      ),
    [prompts, answers, checks, application.id],
  )

  const answeredCount = evaluations.filter((e) => e.wordCount > 0).length
  const currentEval = evaluations[currentStep]

  const speakPrompt = (text: string) => {
    if (!voiceEnabled) return
    void speak(text)
  }

  const startInterview = () => {
    setStarted(true)
    setFinished(false)
    setCurrentStep(0)
    useAuraStore.getState().pulse('SUCCESS', 1000)
    const first = prompts[0]
    if (first && voiceEnabled) {
      void speak(
        `Hola. Iniciemos tu simulacion de entrevista para el puesto de ${application.job.title} en ${application.job.company.name}. Primera pregunta: ${first.title}`,
      )
    }
  }

  const toggleMic = async () => {
    if (listening) {
      sessionRef.current?.stop()
      setListening(false)
      return
    }
    stopSpeaking()
    const session = new ListeningSession()
    sessionRef.current = session
    setListening(true)
    await session.start({
      onInterim: () => undefined,
      onFinal: (transcript) => {
        const nextText = currentAnswer ? `${currentAnswer.trim()} ${transcript}` : transcript
        onUpdateAnswer(currentStep, nextText)
      },
      onError: (code) => {
        toast.info(VOICE_ERRORS[code])
      },
      onEnd: () => {
        setListening(false)
        useAuraStore.getState().setCoreState('IDLE')
      },
    })
  }

  const submitCurrentStep = () => {
    if (!currentAnswer.trim()) {
      toast.info('Escribe o dicta una respuesta antes de enviarla a AURA.')
      return
    }
    useAuraStore.getState().pulse('SUCCESS', 900)
    if (currentStep + 1 < prompts.length) {
      const nextIdx = currentStep + 1
      setCurrentStep(nextIdx)
      const nextPrompt = prompts[nextIdx]
      if (nextPrompt && voiceEnabled) {
        const feedbackIntro = currentEval ? currentEval.auraFeedback : 'Respuesta registrada.'
        void speak(`${feedbackIntro} Siguiente pregunta: ${nextPrompt.title}`)
      }
    } else {
      setFinished(true)
      if (voiceEnabled) {
        void speak(
          'Has completado todas las preguntas de la prueba de entrevista. He calculado tus porcentajes, metricas algoritmicas y graficas de efectividad.',
        )
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!started ? (
        <section className="neo-inset flex flex-col items-center gap-5 rounded-2xl border border-aura-500/25 p-7 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-aura-500/40 bg-aura-500/15 text-aura-400 shadow-[0_0_30px_rgba(255,122,26,0.25)]">
            <Sparkles className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="max-w-2xl">
            <p className="hud-label text-aura-400">Simulador Interactivo con AURA</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-bone">
              Prueba de Entrevista para {application.job.title}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-graphite-300">
              AURA te realizara <strong className="text-bone">{prompts.length} preguntas estructuradas</strong> sobre las responsabilidades y habilidades clave de <strong className="text-bone">{application.job.company.name}</strong>. Podras responder por texto o voz, recibir retroalimentacion inmediata en cada turno y al finalizar obtener el <strong className="text-aura-300">reporte algoritmico con porcentajes, graficas de barras, pastel y curva de efectividad</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <AuraButton icon={CirclePlay} onClick={startInterview}>
              Realizar prueba de entrevista
            </AuraButton>
            <AuraButton
              variant="neo"
              icon={voiceEnabled ? Volume2 : VolumeX}
              onClick={() => {
                if (voiceEnabled) stopSpeaking()
                setVoiceEnabled((v) => !v)
              }}
            >
              {voiceEnabled ? 'Voz de AURA: Activa' : 'Voz de AURA: Silenciada'}
            </AuraButton>
            {answeredCount > 0 && (
              <AuraButton variant="ghost" icon={ChartColumn} onClick={() => { setStarted(true); setFinished(true) }}>
                Ver reporte actual ({answeredCount}/{prompts.length})
              </AuraButton>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className="neo-inset flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <AuraBadge tone="aura">
                Entrevista AURA: {currentStep + 1} / {prompts.length}
              </AuraBadge>
              <AuraBadge tone="success">
                Respondidas: {answeredCount} de {prompts.length}
              </AuraBadge>
              {currentPrompt && (
                <AuraBadge tone="info">
                  {currentPrompt.type === 'skill'
                    ? `Competencia: ${currentPrompt.targetSkill ?? 'Tecnica'}`
                    : currentPrompt.type === 'responsibility'
                      ? 'Responsabilidad del puesto'
                      : 'Perfil general'}
                </AuraBadge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AuraButton
                size="sm"
                variant="ghost"
                icon={voiceEnabled ? Volume2 : VolumeX}
                onClick={() => {
                  if (voiceEnabled) stopSpeaking()
                  setVoiceEnabled((v) => !v)
                }}
              >
                {voiceEnabled ? 'Voz AURA activa' : 'Sin voz'}
              </AuraButton>
              <AuraButton
                size="sm"
                variant={finished ? 'primary' : 'neo'}
                icon={ChartColumn}
                onClick={() => {
                  stopSpeaking()
                  setFinished((f) => !f)
                }}
              >
                {finished ? 'Volver a las preguntas' : 'Ver resultados y graficas'}
              </AuraButton>
            </div>
          </div>

          {!finished && currentPrompt && (
            <div className="flex flex-col gap-5">
              <section
                className="rounded-2xl border border-aura-500/35 bg-gradient-to-br from-aura-500/12 via-black/50 to-black/70 p-5 shadow-[0_0_25px_rgba(255,122,26,0.1)]"
                aria-label="Pregunta formulada por AURA"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-aura-500/20 font-mono text-xs font-bold text-aura-300">
                      AURA
                    </span>
                    <div>
                      <p className="hud-label text-aura-400">Entrevistadora de Preparacion IA</p>
                      <p className="text-[11px] text-graphite-400">
                        Evaluando compatibilidad con {application.job.title}
                      </p>
                    </div>
                  </div>
                  <AuraButton
                    size="sm"
                    variant="ghost"
                    icon={Volume2}
                    onClick={() => speakPrompt(currentPrompt.title)}
                  >
                    Escuchar pregunta
                  </AuraButton>
                </div>

                <p className="mt-4 font-display text-lg font-medium leading-snug text-bone">
                  {currentPrompt.title}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-graphite-300">{currentPrompt.context}</p>

                {currentPrompt.keywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-graphite-400">
                      Conceptos clave esperados:
                    </span>
                    {currentPrompt.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-md border border-aura-500/25 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-aura-300"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section className="neo-inset flex flex-col gap-4 rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="hud-label text-bone">Tu respuesta a AURA</span>
                  <div className="flex items-center gap-2">
                    <AuraButton
                      size="sm"
                      variant={listening ? 'primary' : 'neo'}
                      icon={listening ? MicOff : Mic}
                      onClick={() => void toggleMic()}
                    >
                      {listening ? 'Detener dictado' : 'Dictar con microfono'}
                    </AuraButton>
                  </div>
                </div>

                <AuraTextarea
                  label="Desarrolla tu respuesta aplicando Situacion, Tarea, Accion y Resultado (STAR)"
                  rows={6}
                  value={currentAnswer}
                  onChange={(e) => onUpdateAnswer(currentStep, e.target.value)}
                  placeholder="Ejemplo: En mi anterior proyecto teniamos el reto de optimizar el tiempo de carga. Mi responsabilidad fue redisernar los componentes en React y TypeScript. Implemente carga diferida y memoizacion, logrando reducir el tiempo de respuesta en un 40%..."
                />

                <div className="rounded-xl border border-white/5 bg-black/25 p-4">
                  <p className="hud-label mb-2.5 text-aura-400">
                    Autoverificacion y deteccion automatica de estructura STAR
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {STAR.map((item) => {
                      const autoDetected = currentEval?.detectedStar.includes(item.id) ?? false
                      const isChecked = currentChecked.includes(item.id) || autoDetected
                      return (
                        <label
                          key={item.id}
                          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                            isChecked
                              ? 'border-aura-500/40 bg-aura-500/10 text-bone'
                              : 'border-white/5 text-graphite-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-orange-500"
                            checked={isChecked}
                            onChange={(e) => onToggleStar(currentStep, item.id, e.target.checked)}
                          />
                          <span>{item.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {currentEval && currentEval.wordCount > 0 && (
                  <div className="flex flex-col gap-2 rounded-xl border border-sky-400/25 bg-sky-500/[0.06] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                        <Activity className="h-4 w-4" aria-hidden="true" />
                        Retroalimentacion en vivo de AURA
                      </span>
                      <span className="font-mono text-xs text-bone">
                        Efectividad en esta pregunta:{' '}
                        <strong className="text-aura-400">{currentEval.totalScore}%</strong> ({currentEval.wordCount}{' '}
                        palabras)
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-graphite-300">{currentEval.auraFeedback}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex gap-2">
                    <AuraButton
                      size="sm"
                      variant="ghost"
                      icon={ArrowLeft}
                      disabled={currentStep === 0}
                      onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                    >
                      Pregunta anterior
                    </AuraButton>
                    {currentStep < prompts.length - 1 && (
                      <AuraButton
                        size="sm"
                        variant="ghost"
                        icon={ArrowRight}
                        onClick={() => setCurrentStep((s) => Math.min(prompts.length - 1, s + 1))}
                      >
                        Saltar pregunta
                      </AuraButton>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <AuraButton size="sm" icon={Send} onClick={submitCurrentStep}>
                      {currentStep < prompts.length - 1
                        ? 'Enviar respuesta y siguiente pregunta'
                        : 'Finalizar entrevista y calcular efectividad'}
                    </AuraButton>
                  </div>
                </div>
              </section>
            </div>
          )}

          {finished && (
            <InterviewEffectivenessReport
              application={application}
              evaluations={evaluations}
              onSelectQuestion={(idx) => {
                setCurrentStep(idx)
                setFinished(false)
              }}
              onReset={() => {
                onReset()
                setStarted(false)
                setFinished(false)
                setCurrentStep(0)
              }}
              onDownload={onDownload}
            />
          )}
        </>
      )}
    </div>
  )
}

const InterviewEffectivenessReport = memo(function InterviewEffectivenessReport({
  application,
  evaluations,
  onSelectQuestion,
  onReset,
  onDownload,
}: {
  application: MyApplication
  evaluations: QuestionEvaluation[]
  onSelectQuestion: (idx: number) => void
  onReset: () => void
  onDownload: () => void
}) {
  const summary = useMemo(() => {
    const count = Math.max(1, evaluations.length)
    const avgStar = Math.round(evaluations.reduce((s, e) => s + e.starScore, 0) / count)
    const avgComp = Math.round(evaluations.reduce((s, e) => s + e.competencyScore, 0) / count)
    const avgImpact = Math.round(evaluations.reduce((s, e) => s + e.impactScore, 0) / count)
    const avgClarity = Math.round(evaluations.reduce((s, e) => s + e.clarityScore, 0) / count)
    const overall = Math.round(0.35 * avgStar + 0.3 * avgComp + 0.2 * avgImpact + 0.15 * avgClarity)

    const tier =
      overall >= 80
        ? 'Sobresaliente (Alta efectividad)'
        : overall >= 62
          ? 'Solido (Buen desempeno)'
          : overall >= 40
            ? 'En desarrollo (Reforzar ejemplos)'
            : 'Inicial (Completar respuestas)'

    const pieSlices = [
      {
        key: 'star',
        label: 'Estructura STAR (peso 35%)',
        score: avgStar,
        weighted: Number((avgStar * 0.35).toFixed(1)),
        color: '#ff7a1a',
      },
      {
        key: 'comp',
        label: 'Competencias vacante (peso 30%)',
        score: avgComp,
        weighted: Number((avgComp * 0.3).toFixed(1)),
        color: '#38bdf8',
      },
      {
        key: 'impact',
        label: 'Evidencia de impacto (peso 20%)',
        score: avgImpact,
        weighted: Number((avgImpact * 0.2).toFixed(1)),
        color: '#ffb547',
      },
      {
        key: 'clarity',
        label: 'Claridad y profundidad (peso 15%)',
        score: avgClarity,
        weighted: Number((avgClarity * 0.15).toFixed(1)),
        color: '#22c55e',
      },
      {
        key: 'gap',
        label: 'Brecha de mejora restante',
        score: Math.max(0, 100 - overall),
        weighted: Number(Math.max(0, 100 - overall).toFixed(1)),
        color: '#2d2d37',
      },
    ]

    return { avgStar, avgComp, avgImpact, avgClarity, overall, tier, pieSlices }
  }, [evaluations])

  const radius = 56
  const circumference = 2 * Math.PI * radius
  const donutSegments = useMemo(() => {
    let acc = 0
    return summary.pieSlices.map((s) => {
      const frac = s.weighted / 100
      const dash = frac * circumference
      const offset = -acc * circumference
      acc += frac
      return { ...s, dash, offset }
    })
  }, [summary.pieSlices, circumference])

  const user = useSessionStore((s) => s.user)
  const isCompanyOrAdmin =
    user?.roles.some((r) => r.code === 'ROLE_RECRUITER' || r.code === 'ROLE_COMPANY_ADMIN' || r.code === 'ROLE_SYSTEM_ADMIN') ??
    false

  return (
    <div className="flex flex-col gap-6" aria-label="Reporte de efectividad de entrevista">
      <div className="neo-inset flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-aura-500/30 p-5">
        <div className="flex items-center gap-3">
          <Award className="h-7 w-7 text-aura-400" aria-hidden="true" />
          <div>
            <p className="hud-label text-aura-400">Resultado Algoritmico de la Simulacion</p>
            <h4 className="font-display text-lg font-semibold text-bone">
              Efectividad Global del Postulante: {summary.overall}% — {summary.tier}
            </h4>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AuraButton size="sm" variant="neo" icon={Download} onClick={onDownload}>
            Descargar respuestas (.txt)
          </AuraButton>
          <AuraButton size="sm" variant="ghost" icon={RotateCcw} onClick={onReset}>
            Reiniciar prueba
          </AuraButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="neo-inset rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Estructura STAR (35%)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-aura-400">{summary.avgStar}%</p>
          <p className="mt-1 text-xs text-graphite-400">Situacion, Tarea, Accion y Resultado</p>
        </div>
        <div className="neo-inset rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Competencias del Puesto (30%)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-sky-300">{summary.avgComp}%</p>
          <p className="mt-1 text-xs text-graphite-400">Alineacion con {application.job.title}</p>
        </div>
        <div className="neo-inset rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Impacto Medible (20%)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-300">{summary.avgImpact}%</p>
          <p className="mt-1 text-xs text-graphite-400">Metricas, logros y resultados verificables</p>
        </div>
        <div className="neo-inset rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Claridad y Profundidad (15%)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-400">{summary.avgClarity}%</p>
          <p className="mt-1 text-xs text-graphite-400">Desarrollo argumentativo por pregunta</p>
        </div>
      </div>

      {isCompanyOrAdmin && (
        <section className="neo-inset rounded-2xl p-5" aria-label="Como evalua AURA tus respuestas">
          <div className="flex items-center gap-2">
            <Sigma className="h-4 w-4 text-aura-400" aria-hidden="true" />
            <h5 className="hud-label text-bone">Como se calcula tu efectividad en la entrevista</h5>
            <AuraInfoBubble
              title="Evaluacion sencilla y transparente"
              explanation="AURA revisa cuatro partes en cada respuesta: que cuentes una historia completa (Situacion, Tarea, Accion y Resultado), que menciones las habilidades del puesto, que des ejemplos con resultados reales y que te expliques con claridad."
              benefit="Te muestra exactamente que agregar en tus respuestas para causar una gran impresion en la entrevista real."
            />
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-black/40 p-3.5">
              <p className="text-xs font-medium text-aura-300">1. Que toma en cuenta tu calificacion por respuesta</p>
              <p className="mt-1.5 rounded bg-black/60 px-3 py-2 font-mono text-xs text-bone">
                35% Historia completa (STAR) + 30% Habilidades + 20% Logros + 15% Claridad
              </p>
              <p className="mt-2 text-xs leading-relaxed text-graphite-300">
                Revisa que expliques cual era el contexto, que hiciste tu directamente, que herramientas del puesto aplicaste y que resultado concreto lograste.
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/40 p-3.5">
              <p className="text-xs font-medium text-sky-300">
                2. Como mides cuanto te falta para una respuesta de 100%
              </p>
              <p className="mt-1.5 rounded bg-black/60 px-3 py-2 font-mono text-xs text-bone">
                Puntos por mejorar = Lo que falta de estructura + Lo que falta de habilidades
              </p>
              <p className="mt-2 text-xs leading-relaxed text-graphite-300">
                Cada pregunta que respondes hace subir tu barra de preparacion paso a paso hacia el nivel ideal que busca la vacante.
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="neo-inset flex min-w-0 flex-col justify-between gap-5 overflow-hidden rounded-2xl p-5">
          <div>
            <div className="flex items-center gap-2">
              <ChartPie className="h-4 w-4 text-aura-400" aria-hidden="true" />
              <h5 className="hud-label text-bone">Grafica de Pastel: Aporte por Dimension de Efectividad</h5>
            </div>
            <p className="mt-1 text-xs text-graphite-400">
              Contribucion ponderada de cada criterio al {summary.overall}% de efectividad total
            </p>
          </div>

          <div className="flex flex-col items-center gap-5">
            <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
              <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label="Grafica de pastel de efectividad">
                <circle cx="80" cy="80" r={radius} fill="none" stroke="#1f1f27" strokeWidth="20" />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.key}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="20"
                    strokeDasharray={`${seg.dash} ${circumference}`}
                    strokeDashoffset={seg.offset}
                  >
                    <title>{`${seg.label}: ${seg.weighted}%`}</title>
                  </circle>
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-2xl font-bold text-bone">{summary.overall}%</span>
                <span className="text-[10px] uppercase tracking-wider text-graphite-400">Efectividad</span>
              </div>
            </div>

            <ul className="grid w-full min-w-0 gap-2.5 sm:grid-cols-2">
              {summary.pieSlices.map((item) => (
                <li
                  key={item.key}
                  className="flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl border border-white/5 bg-black/35 p-3 text-xs"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate font-medium text-bone" title={item.label}>
                        {item.label}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-bone">{item.weighted}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, item.score)}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-graphite-400">Dominio bruto: {item.score}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <InterviewBarAndHillChart evaluations={evaluations} onSelectQuestion={onSelectQuestion} />
      </div>

      <section className="neo-inset rounded-2xl p-5" aria-label="Tabla de resultados por pregunta">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Table className="h-4 w-4 text-aura-400" aria-hidden="true" />
            <h5 className="hud-label text-bone">Desglose Algoritmico por Pregunta y Retroalimentacion de AURA</h5>
          </div>
          <span className="text-xs text-graphite-400">Haz clic en cualquier fila para editar o ampliar tu respuesta</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black/50 font-mono text-[10px] uppercase tracking-wider text-graphite-400">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Pregunta de AURA</th>
                <th className="px-4 py-3">STAR</th>
                <th className="px-4 py-3">Competencias</th>
                <th className="px-4 py-3">Impacto</th>
                <th className="px-4 py-3">Brecha L1</th>
                <th className="px-4 py-3">Efectividad</th>
                <th className="px-4 py-3">Diagnostico de AURA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {evaluations.map((ev) => (
                <tr
                  key={ev.index}
                  onClick={() => onSelectQuestion(ev.index)}
                  className="cursor-pointer bg-black/20 transition hover:bg-aura-500/10"
                >
                  <td className="px-4 py-3 font-mono text-aura-400">P{ev.index + 1}</td>
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-bone" title={ev.questionTitle}>
                    {ev.questionTitle}
                  </td>
                  <td className="px-4 py-3 font-mono text-aura-300">{ev.starScore}%</td>
                  <td className="px-4 py-3 font-mono text-sky-300">{ev.competencyScore}%</td>
                  <td className="px-4 py-3 font-mono text-amber-300">{ev.impactScore}%</td>
                  <td className="px-4 py-3 font-mono text-graphite-300">{ev.manhattanGap}</td>
                  <td className="px-4 py-3">
                    <AuraBadge
                      tone={ev.totalScore >= 75 ? 'success' : ev.totalScore >= 45 ? 'info' : 'warning'}
                    >
                      {ev.totalScore}%
                    </AuraBadge>
                  </td>
                  <td className="px-4 py-3 leading-relaxed text-graphite-300">{ev.auraFeedback}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
})

const InterviewBarAndHillChart = memo(function InterviewBarAndHillChart({
  evaluations,
  onSelectQuestion,
}: {
  evaluations: QuestionEvaluation[]
  onSelectQuestion: (idx: number) => void
}) {
  const width = 540
  const height = 240
  const left = 40
  const right = 20
  const top = 26
  const bottom = 42
  const plotW = width - left - right
  const plotH = height - top - bottom
  const slot = plotW / Math.max(1, evaluations.length)
  const barW = Math.min(26, slot * 0.45)

  const climbPoints = evaluations
    .map((ev, i) => {
      const cx = left + i * slot + slot / 2
      const cy = top + plotH - (ev.hillAltitude / 100) * plotH
      return `${cx},${cy}`
    })
    .join(' ')

  return (
    <section className="neo-inset flex min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-2xl p-5">
      <div>
        <div className="flex items-center gap-2">
          <ChartArea className="h-4 w-4 text-sky-400" aria-hidden="true" />
          <h5 className="hud-label text-bone">
            Grafica de Barras y Curva Hill Climbing por Pregunta
          </h5>
        </div>
        <p className="mt-1 text-xs text-graphite-400">
          Barras: efectividad individual por pregunta (%) | Curva: ascenso acumulado hacia la meta del puesto
        </p>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full rounded-xl border border-white/5 bg-[#09090d]"
        role="img"
        aria-label="Grafica de barras de efectividad por pregunta y curva de ascenso Hill Climbing"
      >
        {[0, 25, 50, 75, 100].map((pct) => {
          const gy = top + plotH * (1 - pct / 100)
          return (
            <g key={pct}>
              <line x1={left} y1={gy} x2={width - right} y2={gy} stroke="#ffffff" strokeOpacity="0.07" strokeDasharray="3 5" />
              <text x={left - 6} y={gy + 3} textAnchor="end" fill="#7a7a85" fontSize="8.5" fontFamily="monospace">
                {pct}%
              </text>
            </g>
          )
        })}

        { evaluations.map((ev, idx) => {
          const cx = left + idx * slot + slot / 2
          const bh = (ev.totalScore / 100) * plotH
          const by = top + plotH - bh
          return (
            <g key={ev.index} onClick={() => onSelectQuestion(ev.index)} className="cursor-pointer">
              <rect
                x={cx - barW / 2}
                y={by}
                width={barW}
                height={Math.max(4, bh)}
                rx="4"
                fill={ev.totalScore >= 75 ? '#22c55e' : ev.totalScore >= 45 ? '#ff7a1a' : '#70441f'}
                opacity="0.88"
              >
                <title>{`Pregunta ${idx + 1}: ${ev.totalScore}%`}</title>
              </rect>
              <text
                x={cx}
                y={by - 6}
                textAnchor="middle"
                fill="#f4eee8"
                fontSize="8.5"
                fontFamily="monospace"
              >
                {ev.totalScore}%
              </text>
              <text x={cx} y={height - 14} textAnchor="middle" fill="#a1a1aa" fontSize="9" fontFamily="monospace">
                P{idx + 1}
              </text>
            </g>
          )
        })}

        {climbPoints && (
          <polyline
            points={climbPoints}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {evaluations.map((ev, idx) => {
          const cx = left + idx * slot + slot / 2
          const cy = top + plotH - (ev.hillAltitude / 100) * plotH
          return (
            <circle
              key={`pt-${ev.index}`}
              cx={cx}
              cy={cy}
              r="4.5"
              fill="#38bdf8"
              stroke="#09090d"
              strokeWidth="1.5"
            >
              <title>{`Altitud acumulada P${idx + 1}: ${ev.hillAltitude}%`}</title>
            </circle>
          )
        })}
      </svg>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-graphite-300">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-aura-500" />
          Barras: Efectividad en cada pregunta
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-sky-400" />
          Linea Cian: Curva Hill Climbing de efectividad acumulada
        </span>
        <span className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          Verde: Respuesta sobresaliente (&gt;= 75%)
        </span>
      </div>
    </section>
  )
})

function evaluateResponse(
  index: number,
  prompt: Prompt,
  rawAnswer: string,
  manualStar: string[],
): QuestionEvaluation {
  const answer = rawAnswer.trim()
  const words = answer ? answer.split(/\s+/).filter(Boolean) : []
  const wordCount = words.length

  if (wordCount === 0) {
    return {
      index,
      questionTitle: prompt.title,
      category: prompt.type,
      answer: '',
      wordCount: 0,
      starScore: 0,
      competencyScore: 0,
      impactScore: 0,
      clarityScore: 0,
      totalScore: 0,
      manhattanGap: 200,
      hillAltitude: 0,
      auraFeedback: 'Pendiente de responder. Describe un caso concreto usando Situacion, Tarea, Accion y Resultado.',
      detectedStar: [],
    }
  }

  const detectedStar = Object.entries(STAR_PATTERNS)
    .filter(([id, regex]) => regex.test(answer) || manualStar.includes(id))
    .map(([id]) => id)
  const starScore = Math.min(100, Math.round((detectedStar.length / 4) * 100))

  const lower = answer.toLowerCase()
  const matchedKeywords = prompt.keywords.filter((kw) => lower.includes(kw.toLowerCase()))
  const keywordRatio = prompt.keywords.length > 0 ? matchedKeywords.length / prompt.keywords.length : 0.6
  const actionVerbBonus = STAR_PATTERNS.action?.test(answer) ? 28 : 10
  const competencyScore = Math.min(100, Math.round(keywordRatio * 72 + actionVerbBonus))

  const hasNumbers = /\d+/.test(answer)
  const hasImpactWords = IMPACT_PATTERN.test(answer)
  const impactScore = hasNumbers && hasImpactWords ? 96 : hasImpactWords ? 76 : hasNumbers ? 65 : 35

  const clarityScore =
    wordCount >= 45 && wordCount <= 160
      ? 95
      : wordCount >= 25
        ? 78
        : wordCount >= 12
          ? 52
          : 28

  const totalScore = Math.round(
    0.35 * starScore + 0.3 * competencyScore + 0.2 * impactScore + 0.15 * clarityScore,
  )
  const manhattanGap = Math.abs(100 - starScore) + Math.abs(100 - competencyScore)
  const hillAltitude = Math.min(100, Math.round(totalScore))

  const missingStarLabels: Record<string, string> = {
    situation: 'el contexto inicial (Situacion)',
    task: 'tu objetivo especifico (Tarea)',
    action: 'las acciones que ejecutaste directamente (Accion)',
    result: 'el impacto o aprendizaje medible (Resultado)',
  }
  const missing = ['situation', 'task', 'action', 'result']
    .filter((id) => !detectedStar.includes(id))
    .map((id) => missingStarLabels[id])

  let auraFeedback = 'Excelente estructura STAR, alineacion tecnica e impacto cuantificable.'
  if (missing.length > 0) {
    auraFeedback = `Buena base (${wordCount} palabras). Para subir tu efectividad, explicita ${missing.slice(0, 2).join(' y ')}.`
  } else if (!hasNumbers) {
    auraFeedback = 'Estructura STAR completa. Agrega un indicador numerico (porcentaje, tiempo ahorrado o alcance) para elevar el puntaje de impacto.'
  }

  return {
    index,
    questionTitle: prompt.title,
    category: prompt.type,
    answer,
    wordCount,
    starScore,
    competencyScore,
    impactScore,
    clarityScore,
    totalScore,
    manhattanGap,
    hillAltitude,
    auraFeedback,
    detectedStar,
  }
}

function buildPrompts(application: MyApplication, declaredSkills: string[]): Prompt[] {
  const job = application.job
  const coreKeywords = job.skills.slice(0, 4).map((s) => s.skill.name)
  const prompts: Prompt[] = [
    {
      type: 'general',
      title: `Cuentame sobre tu experiencia mas relevante para el puesto de ${job.title}.`,
      context: 'Elige un ejemplo concreto que conecte tu trayectoria con las responsabilidades principales de la vacante.',
      keywords: coreKeywords.length ? coreKeywords : ['experiencia', 'proyecto', 'resultados'],
    },
  ]
  for (const responsibility of job.responsibilities.slice(0, 3)) {
    const words = responsibility
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]/g, ''))
      .filter((w) => w.length > 4)
      .slice(0, 4)
    prompts.push({
      type: 'responsibility',
      title: `Que ejemplo concreto puedes compartir relacionado con: "${responsibility}"?`,
      context: 'Describe tu contribucion especifica, las decisiones que tomaste y como comprobaste el resultado.',
      keywords: words.length ? words : coreKeywords,
    })
  }
  const relevantSkills = job.skills.filter((item) => item.importance === 'required').slice(0, 4)
  for (const item of relevantSkills) {
    const declared = declaredSkills.some((name) => name.toLowerCase() === item.skill.name.toLowerCase())
    prompts.push({
      type: 'skill',
      targetSkill: item.skill.name,
      title: `Como has aplicado ${item.skill.name} en un proyecto o situacion real?`,
      context: `La vacante la marca como requerida (nivel orientativo ${item.min_proficiency}/5). ${
        declared
          ? 'Ya la declaras en tu perfil; comparte una evidencia concreta y el resultado obtenido.'
          : 'Si aun no tienes experiencia directa, explica como abordarias aplicarla o un caso equivalente.'
      }`,
      keywords: [item.skill.name, 'implementacion', 'resultado'],
    })
  }
  prompts.push({
    type: 'general',
    title: 'Que estrategia sigues para resolver un bloqueo tecnico complejo y medir que la solucion funciono?',
    context: 'Evalua tu capacidad de diagnostico, colaboracion con el equipo y validacion con metricas.',
    keywords: ['diagnostico', 'equipo', 'pruebas', 'metricas'],
  })
  return prompts
}
