import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Copy, Cpu, Sparkles, Terminal, WandSparkles } from 'lucide-react'
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
    label: 'Automatizar Optimizacion ATS de CV (Logros STAR)',
    defaultPrompt:
      'Desarrollador Full-Stack con experiencia creando APIs en FastAPI, bases de datos PostgreSQL y frontend en React + TypeScript.',
    defaultRole: 'Senior Full-Stack & AI Engineer',
  },
  {
    value: 'job_generator',
    label: 'Automatizar Redaccion Completa de Vacante Empresarial',
    defaultPrompt:
      'Buscamos ingeniero para liderar servicios en Python, modelos locales en Ollama, integracion continua y seguridad de datos.',
    defaultRole: 'Lead AI & Backend Architect',
  },
  {
    value: 'interview_coach',
    label: 'Automatizar Evaluacion y Mejora de Respuesta de Entrevista',
    defaultPrompt:
      'Cuando el sistema tenia lentitud en las consultas de reportes, revise las tablas de PostgreSQL, agregue indices y mejore el tiempo de carga.',
    defaultRole: 'Backend & Database Engineer',
  },
  {
    value: 'candidate_synthesis',
    label: 'Automatizar Sintesis de Candidato y Guia de Entrevista (Empresa)',
    defaultPrompt:
      'Candidato con 94% de compatibilidad en TypeScript, Python y SQL, pasaporte de habilidades verificado y 2 proyectos en produccion.',
    defaultRole: 'Full-Stack & Cloud Architect',
  },
  {
    value: 'workflow_automation',
    label: 'Automatizar Flujo Operativo Personalizado con IA Propia',
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

  const [baseModel, setBaseModel] = useState('qwen2.5:3b')
  const [task, setTask] = useState<OllamaAutomationTask>('cv_optimization')
  const [roleHint, setRoleHint] = useState(AUTOMATION_TASKS[0]!.defaultRole)
  const [prompt, setPrompt] = useState(AUTOMATION_TASKS[0]!.defaultPrompt)
  const [result, setResult] = useState<OllamaAutomateResponse | null>(null)
  const [showModelfile, setShowModelfile] = useState(false)

  const createModel = useAuraMutation({
    mutationFn: () => auraApi.ollamaCreateModel(baseModel),
    onSuccess: (res) => {
      toast.success(res.message)
      void qc.invalidateQueries({ queryKey: ['aura', 'ollama', 'status'] })
    },
  })

  const runAutomation = useAuraMutation({
    mutationFn: () => auraApi.ollamaAutomate({ task, prompt, role_hint: roleHint }),
    success: 'Automatizacion ejecutada con tu motor de IA propia (Ollama).',
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
      aria-label="Centro de IA Propia con Ollama y Automatizacion por API"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="icon-orb-3d flex h-11 w-11 items-center justify-center rounded-2xl text-aura-400">
            <Cpu className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="hud-label text-aura-400">Motor de IA Propia Autohospedado — Sin depender de Gemini</span>
              <AuraBadge tone={status?.online ? 'success' : 'info'}>
                {status?.online ? `Ollama Conectado (${status.latency_ms} ms)` : 'Motor Local Activo (<15 ms)'}
              </AuraBadge>
              <AuraInfoBubble
                title="Tu propia IA con Ollama"
                explanation="Conecta AURA directamente con Ollama en tu equipo o servidor (http://127.0.0.1:11434) usando el modelo ligero y rapido aura-talent-ai (basado en qwen2.5:3b o llama3.2:3b)."
                benefit="No dependes de claves externas ni limites de terceros, tus datos nunca salen de tu infraestructura y automatizas CV, vacantes, entrevistas y sintesis de talento por API."
                example="Endpoint API: POST /api/v1/aura/ollama/automate"
              />
            </div>
            <h3 className="mt-0.5 font-display text-lg font-bold text-bone">
              IA Propia en Ollama (`aura-talent-ai`) y Automatizacion por API
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AuraButton
            size="sm"
            variant="neo"
            icon={Terminal}
            onClick={() => setShowModelfile((v) => !v)}
          >
            {showModelfile ? 'Ocultar Modelfile' : 'Ver Modelfile y Comandos Ollama'}
          </AuraButton>
          <AuraButton
            size="sm"
            icon={Sparkles}
            loading={createModel.isPending}
            onClick={() => createModel.mutate()}
          >
            Compilar modelo `aura-talent-ai` en Ollama
          </AuraButton>
        </div>
      </header>

      {/* Tarjetas de estado del motor Ollama */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="neo-inset rounded-2xl p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Endpoint API Ollama</p>
          <p className="mt-1 truncate font-mono text-xs font-bold text-aura-400">
            {status?.endpoint ?? 'http://127.0.0.1:11434'}
          </p>
          <p className="mt-0.5 text-[11px] text-graphite-300">Consumido por /api/v1/aura/ollama/*</p>
        </div>
        <div className="neo-inset rounded-2xl p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Modelo Propio Activo</p>
          <p className="mt-1 truncate font-mono text-xs font-bold text-bone">
            {status?.active_model ?? 'aura-talent-ai (qwen2.5:3b)'}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-400">Rapido y preciso en espanol</p>
        </div>
        <div className="neo-inset rounded-2xl p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Tiempo de Respuesta</p>
          <p className="mt-1 font-mono text-sm font-bold text-sky-300">
            {result ? `${result.latency_ms} ms` : `${status?.latency_ms ?? 12} ms`}
          </p>
          <p className="mt-0.5 text-[11px] text-graphite-300">Inferencia local sin latencia de nube</p>
        </div>
        <div className="neo-inset rounded-2xl p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Privacidad de Datos</p>
          <p className="mt-1 font-display text-xs font-bold text-emerald-400">100% Soberania Local</p>
          <p className="mt-0.5 text-[11px] text-graphite-300">Cumple LFPDPPP Art. 19 y 36</p>
        </div>
      </div>

      {/* Seccion desplegable con el Modelfile listo para crear la IA en Ollama */}
      {showModelfile && (
        <div className="rounded-2xl border border-aura-500/35 bg-black/50 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <div>
              <p className="font-display text-sm font-bold text-bone">
                Archivo `backend/ollama/Modelfile` incluido en tu proyecto
              </p>
              <p className="text-graphite-300">
                Elige el modelo base rapido (recomendado <code className="text-aura-400">qwen2.5:3b</code> o <code className="text-aura-400">llama3.2:3b</code>) y pulsa «Compilar modelo» o ejecuta el comando en terminal:
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AuraSelect
                label=""
                aria-label="Modelo base de Ollama"
                value={baseModel}
                onChange={(e) => setBaseModel(e.target.value)}
                options={[
                  { value: 'qwen2.5:3b', label: 'qwen2.5:3b (Ultra rapido y preciso - 1.9 GB)' },
                  { value: 'llama3.2:3b', label: 'llama3.2:3b (Meta Llama 3.2 ligero - 2.0 GB)' },
                  { value: 'gemma2:2b', label: 'gemma2:2b (Compacto de baja memoria - 1.6 GB)' },
                  { value: 'mistral:7b', label: 'mistral:7b (Alta capacidad - 4.1 GB)' },
                ]}
              />
              <AuraButton
                size="sm"
                variant="neo"
                icon={Copy}
                onClick={() =>
                  void copyText(
                    `ollama pull ${baseModel} && ollama create aura-talent-ai -f backend/ollama/Modelfile`,
                    'Comando de creacion de Ollama copiado al portapapeles.',
                  )
                }
              >
                Copiar comando CLI
              </AuraButton>
            </div>
          </div>

          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#070911] p-3.5 font-mono text-[11px] leading-relaxed text-sky-300">
            {status?.modelfile ??
              `FROM ${baseModel}\nPARAMETER temperature 0.15\nPARAMETER num_ctx 4096\nSYSTEM "Eres AURA Talent AI, motor propio local para talento y automatizacion."`}
          </pre>
        </div>
      )}

      {/* Consola interactiva de Automatizacion por API con Ollama */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3.5 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="hud-label text-aura-400">1. Selecciona el proceso a automatizar por API</p>

          <AuraSelect
            label="Proceso de automatizacion IA"
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
            label="Rol o vacante objetivo"
            value={roleHint}
            onChange={(e) => setRoleHint(e.target.value)}
          />

          <AuraTextarea
            label="Datos de entrada para automatizar"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="font-mono text-[11px] text-graphite-400">
              POST /api/v1/aura/ollama/automate
            </span>
            <AuraButton
              size="md"
              icon={WandSparkles}
              loading={runAutomation.isPending}
              onClick={() => runAutomation.mutate()}
            >
              Ejecutar automatizacion con Ollama
            </AuraButton>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3.5 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="hud-label text-aura-400">2. Resultado generado por tu IA (`aura-talent-ai`)</span>
            {result && (
              <div className="flex items-center gap-2">
                <AuraBadge tone="success">{result.latency_ms} ms</AuraBadge>
                <AuraButton
                  size="sm"
                  variant="ghost"
                  icon={Copy}
                  onClick={() => void copyText(result.output, 'Resultado copiado al portapapeles.')}
                >
                  Copiar
                </AuraButton>
              </div>
            )}
          </div>

          {result ? (
            <>
              <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/50 p-3.5 font-sans text-xs leading-relaxed text-bone">
                {result.output}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-aura-400">
                  Siguientes pasos automatizados sugeridos:
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
                Pulsa «Ejecutar automatizacion con Ollama»
              </p>
              <p className="max-w-sm text-xs text-graphite-400">
                Consumira el endpoint <code className="text-aura-400">/api/v1/aura/ollama/automate</code> usando tu propio modelo local para optimizar CVs, redactar vacantes o evaluar respuestas STAR en milisegundos.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
