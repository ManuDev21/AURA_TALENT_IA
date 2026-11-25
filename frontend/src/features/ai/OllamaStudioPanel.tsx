import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Copy, Sparkles, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { auraApi, type OllamaAutomateResponse, type OllamaAutomationTask } from '@/api/aura'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraSelect, AuraTextarea } from '@/components/aura/AuraField'
import { AuraInfoBubble } from '@/components/aura/AuraInfoBubble'
import { AuraInput } from '@/components/aura/AuraInput'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { toast } from '@/store/toastStore'

const AUTOMATION_TASKS: {
  value: OllamaAutomationTask
  label: string
  defaultPrompt: string
  defaultRole: string
}[] = [
  {
    value: 'cv_optimization',
    label: 'Mejorar mi CV',
    defaultPrompt:
      'Desarrollador Full-Stack con experiencia creando APIs en FastAPI, bases de datos PostgreSQL y frontend en React + TypeScript.',
    defaultRole: 'Senior Full-Stack & AI Engineer',
  },
  {
    value: 'job_generator',
    label: 'Redactar una vacante',
    defaultPrompt:
      'Buscamos ingeniero para liderar servicios en Python, modelos locales en Ollama, integracion continua y seguridad de datos.',
    defaultRole: 'Lead AI & Backend Architect',
  },
  {
    value: 'interview_coach',
    label: 'Preparar una respuesta de entrevista',
    defaultPrompt:
      'Cuando el sistema tenia lentitud en las consultas de reportes, revise las tablas de PostgreSQL, agregue indices y mejore el tiempo de carga.',
    defaultRole: 'Backend & Database Engineer',
  },
  {
    value: 'candidate_synthesis',
    label: 'Resumir el perfil de un candidato',
    defaultPrompt:
      'Candidato con 94% de compatibilidad en TypeScript, Python y SQL, pasaporte de habilidades verificado y 2 proyectos en produccion.',
    defaultRole: 'Full-Stack & Cloud Architect',
  },
  {
    value: 'workflow_automation',
    label: 'Otro texto personalizado',
    defaultPrompt:
      'Automatizar la clasificacion de habilidades faltantes en postulantes y sugerir recursos formativos de menos de 20 horas.',
    defaultRole: 'Operaciones de Talento AURA',
  },
]

export function OllamaStudioPanel() {
  const qc = useQueryClient()
  const { data: status } = useQuery({
    queryKey: ['aura', 'ollama', 'status'],
    queryFn: auraApi.ollamaStatus,
  })

  const [task, setTask] = useState<OllamaAutomationTask>('cv_optimization')
  const [roleHint, setRoleHint] = useState(AUTOMATION_TASKS[0]!.defaultRole)
  const [prompt, setPrompt] = useState(AUTOMATION_TASKS[0]!.defaultPrompt)
  const [result, setResult] = useState<OllamaAutomateResponse | null>(null)

  const createModel = useAuraMutation({
    mutationFn: () => auraApi.ollamaCreateModel('qwen2.5:3b'),
    success: 'Asistente preparado. Ya puedes generar textos.',
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['aura', 'ollama', 'status'] })
    },
  })

  const runAutomation = useAuraMutation({
    mutationFn: () => auraApi.ollamaAutomate({ task, prompt, role_hint: roleHint }),
    success: 'Texto generado.',
    onSuccess: (res) => setResult(res),
  })

  const copyText = async (txt: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(txt)
      toast.success(msg)
    } catch {
      toast.info('Texto listo para copiar.')
    }
  }

  return (
    <section
      className="card-3d flex flex-col gap-5 rounded-3xl p-5 md:p-6"
      aria-label="Asistente de escritura con IA"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="icon-orb-3d flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-aura-400">
            <WandSparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="hud-label text-aura-400">Asistente de escritura</span>
              <AuraBadge tone={status?.online ? 'success' : 'info'}>
                {status?.online ? 'Listo para ayudarte' : 'Se prepara en segundos'}
              </AuraBadge>
              <AuraInfoBubble
                title="Asistente de escritura"
                explanation="AURA redacta y mejora textos por ti: tu CV, descripciones de vacantes o respuestas de entrevista."
                benefit="Tus datos se quedan dentro del servidor de AURA y puedes copiar el resultado con un toque."
                example="Elige que quieres crear, escribe tu texto o tus ideas y pulsa Generar."
              />
            </div>
            <h3 className="mt-0.5 font-display text-lg font-bold text-bone">
              Escribe mejor con la ayuda de AURA
            </h3>
          </div>
        </div>

        {status && !status.online && (
          <AuraButton
            size="sm"
            variant="neo"
            icon={Sparkles}
            loading={createModel.isPending}
            onClick={() => createModel.mutate()}
          >
            Preparar asistente
          </AuraButton>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="neo-inset rounded-2xl p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Estado</p>
          <p className="mt-1 font-display text-sm font-bold text-emerald-400">
            {status?.online ? 'En linea' : 'Listo para preparar'}
          </p>
          <p className="mt-0.5 text-[11px] text-graphite-300">Trabaja dentro del servidor de AURA</p>
        </div>
        <div className="neo-inset rounded-2xl p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Rapidez</p>
          <p className="mt-1 font-display text-sm font-bold text-sky-300">
            {result ? `Ultimo texto en ${(result.latency_ms / 1000).toFixed(1)} s` : 'Responde en segundos'}
          </p>
          <p className="mt-0.5 text-[11px] text-graphite-300">Sin esperas largas</p>
        </div>
        <div className="neo-inset rounded-2xl p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Privacidad</p>
          <p className="mt-1 font-display text-sm font-bold text-emerald-400">Tus datos se quedan contigo</p>
          <p className="mt-0.5 text-[11px] text-graphite-300">No se comparten con terceros</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3.5 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="hud-label text-aura-400">1. Que quieres crear?</p>

          <AuraSelect
            label="Tipo de texto"
            value={task}
            onChange={(e) => {
              const nextTask = e.target.value as OllamaAutomationTask
              setTask(nextTask)
              const spec = AUTOMATION_TASKS.find((t) => t.value === nextTask)
              if (spec) {
                setPrompt(spec.defaultPrompt)
                setRoleHint(spec.defaultRole)
              }
            }}
            options={AUTOMATION_TASKS.map((t) => ({ value: t.value, label: t.label }))}
          />

          <AuraInput
            label="Puesto o cargo"
            value={roleHint}
            onChange={(e) => setRoleHint(e.target.value)}
          />

          <AuraTextarea
            label="Tu texto o tus ideas"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="flex justify-end pt-1">
            <AuraButton
              size="md"
              icon={WandSparkles}
              loading={runAutomation.isPending}
              onClick={() => runAutomation.mutate()}
            >
              Generar texto
            </AuraButton>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3.5 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="hud-label text-aura-400">2. Texto generado</span>
            {result && (
              <AuraButton
                size="sm"
                variant="ghost"
                icon={Copy}
                onClick={() => void copyText(result.output, 'Texto copiado al portapapeles.')}
              >
                Copiar
              </AuraButton>
            )}
          </div>

          {result ? (
            <>
              <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/50 p-3.5 font-sans text-xs leading-relaxed text-bone">
                {result.output}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-aura-400">
                  Siguientes pasos sugeridos:
                </p>
                <ul className="flex flex-col gap-1">
                  {result.actions.map((act) => (
                    <li key={act} className="flex items-start gap-2 text-xs text-graphite-300">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 p-6 text-center">
              <WandSparkles className="h-7 w-7 text-aura-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-bone">
                Tu texto aparecera aqui
              </p>
              <p className="max-w-sm text-xs text-graphite-400">
                Elige que quieres crear, escribe tus ideas y pulsa «Generar texto». AURA escribira una primera version para ti.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
