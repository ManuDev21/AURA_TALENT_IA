import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck2,
  Layers,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import { useState } from 'react'
import { auraApi, type MlLabOverviewResponse } from '@/api/aura'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraInfoBubble } from '@/components/aura/AuraInfoBubble'
import { AuraProgressRing } from '@/components/aura/AuraProgressRing'
import { cn } from '@/utils/cn'

function friendlyTraceStep(step: string): string {
  return step
    .replace('actividades_entregadas', 'Evidencias y practicas entregadas (%)')
    .replace('asistencia', 'Constancia semanal (%)')
    .replace('horas_estudio', 'Horas de preparacion por semana')
}

export function CandidateReadinessCoach() {
  const [horas, setHoras] = useState(6)
  const [constancia, setConstancia] = useState(80)
  const [evidencias, setEvidencias] = useState(75)
  const [participacion, setParticipacion] = useState(7.5)

  const { data: initialData } = useQuery({
    queryKey: ['aura', 'ml-lab', 'overview'],
    queryFn: auraApi.mlLabOverview,
  })

  const simMutation = useMutation({
    mutationFn: auraApi.mlLabSimulate,
  })

  const activeData: MlLabOverviewResponse | undefined = simMutation.data ?? initialData

  const handleSimulate = (
    nextHoras: number,
    nextConstancia: number,
    nextEvidencias: number,
    nextParticipacion: number = participacion,
  ) => {
    setHoras(nextHoras)
    setConstancia(nextConstancia)
    setEvidencias(nextEvidencias)
    setParticipacion(nextParticipacion)
    simMutation.mutate({
      horas_estudio: nextHoras,
      asistencia: nextConstancia,
      actividades_entregadas: nextEvidencias,
      participacion: nextParticipacion,
    })
  }

  // Calculo local instantaneo de respaldo mientras responde el servidor
  const rulePass = horas >= 5 && constancia >= 70 && evidencias >= 65
  const mlPass = activeData
    ? activeData.practice_03.new_case.ml_prediction === 1
    : evidencias > 57.5 && constancia > 62.5
  const readinessScore = Math.min(
    100,
    Math.round(
      (horas / 15) * 28 +
        (constancia / 100) * 26 +
        (evidencias / 100) * 28 +
        (participacion / 10) * 18,
    ),
  )

  const bfsRoute = activeData?.practice_01.bfs.route ?? [
    'Perfil Inicial',
    'Fundamentos Tecnicos',
    'Portafolio Verificado',
    'Rol Objetivo Alcanzado',
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera explicativa en lenguaje natural para el candidato */}
      <section className="card-3d flex flex-col gap-4 rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="icon-orb-3d flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-aura-400">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-semibold text-bone">
                  Autodiagnostico de Preparacion y Camino Recomendado
                </h3>
                <AuraBadge tone="success">Guia personal en lenguaje claro</AuraBadge>
                <AuraInfoBubble
                  title="Como funciona este autodiagnostico"
                  explanation="Combina dos ayudas distintas para ti: por un lado, encuentra el camino con menos escalones para llegar a tu puesto meta; por otro, estima que tan listo esta tu perfil segun tus habitos de practica, constancia y proyectos completados."
                  benefit="Puedes mover los controles para descubrir que habito te conviene reforzar esta semana antes de postularte."
                  example="Si ya tienes buena constancia pero pocas evidencias practicas, subir tus proyectos entregados del 55% al 75% cambia tu diagnostico a Perfil Listo."
                />
              </div>
              <p className="mt-1 text-xs text-graphite-300">
                Ajusta tus habitos actuales para ver como te evalua una regla basica frente al analisis de patrones de AURA, y revisa los pasos mas directos hacia tu meta.
              </p>
            </div>
          </div>
          <AuraBadge tone="neutral">Orientativo · No afecta tus postulaciones</AuraBadge>
        </div>

        {/* Simulador interactivo de 3 habitos (X) -> Nivel de preparacion (y) */}
        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <div className="neo-inset flex flex-col gap-4 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="hud-label flex items-center gap-1.5 text-aura-400">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" /> 1. Tus habitos actuales (Datos de entrada)
              </span>
              <AuraInfoBubble
                title="Tus 3 indicadores de preparacion"
                explanation="Son los tres datos que tu controlas cada semana: el tiempo que dedicas a practicar, tu constancia y el porcentaje de ejercicios o evidencias que terminas."
                benefit="Al mover cualquier deslizador, AURA recalcula al instante tu estimacion."
              />
            </div>

            {/* Deslizador 1: Horas de estudio/practica */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="cand-horas" className="flex items-center gap-1.5 font-medium text-bone">
                  <Clock className="h-3.5 w-3.5 text-aura-400" aria-hidden="true" />
                  Horas de practica a la semana
                </label>
                <span className="font-mono text-sm font-semibold text-aura-300">{horas} h / semana</span>
              </div>
              <input
                id="cand-horas"
                type="range"
                min={1}
                max={12}
                step={1}
                value={horas}
                onChange={(e) => handleSimulate(Number(e.target.value), constancia, evidencias)}
                className="w-full accent-aura-500"
              />
              <div className="flex justify-between text-[0.68rem] text-graphite-400">
                <span>1 h (Inicio)</span>
                <span>5 h+ (Recomendado)</span>
                <span>12 h (Intensivo)</span>
              </div>
            </div>

            {/* Deslizador 2: Constancia / Asistencia */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="cand-constancia" className="flex items-center gap-1.5 font-medium text-bone">
                  <Target className="h-3.5 w-3.5 text-aura-400" aria-hidden="true" />
                  Constancia en tu ruta de aprendizaje
                </label>
                <span className="font-mono text-sm font-semibold text-aura-300">{constancia}%</span>
              </div>
              <input
                id="cand-constancia"
                type="range"
                min={30}
                max={100}
                step={5}
                value={constancia}
                onChange={(e) => handleSimulate(horas, Number(e.target.value), evidencias)}
                className="w-full accent-aura-500"
              />
              <div className="flex justify-between text-[0.68rem] text-graphite-400">
                <span>30%</span>
                <span>70%+ (Meta sugerida)</span>
                <span>100%</span>
              </div>
            </div>

            {/* Deslizador 3: Actividades / Evidencias entregadas */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="cand-evidencias" className="flex items-center gap-1.5 font-medium text-bone">
                  <FileCheck2 className="h-3.5 w-3.5 text-aura-400" aria-hidden="true" />
                  Proyectos y evidencias completadas
                </label>
                <span className="font-mono text-sm font-semibold text-aura-300">{evidencias}%</span>
              </div>
              <input
                id="cand-evidencias"
                type="range"
                min={20}
                max={100}
                step={5}
                value={evidencias}
                onChange={(e) => handleSimulate(horas, constancia, Number(e.target.value))}
                className="w-full accent-aura-500"
              />
              <div className="flex justify-between text-[0.68rem] text-graphite-400">
                <span>20%</span>
                <span>65%+ (Meta sugerida)</span>
                <span>100%</span>
              </div>
            </div>

            {/* Deslizador 4: Participacion activa en simulacros y comunidad (0 a 10) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="cand-participacion" className="flex items-center gap-1.5 font-medium text-bone">
                  <Sparkles className="h-3.5 w-3.5 text-aura-400" aria-hidden="true" />
                  Participacion en ensayos de entrevista y retos (0 a 10)
                </label>
                <span className="font-mono text-sm font-semibold text-aura-300">
                  {participacion} / 10
                </span>
              </div>
              <input
                id="cand-participacion"
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={participacion}
                onChange={(e) =>
                  handleSimulate(horas, constancia, evidencias, Number(e.target.value))
                }
                className="w-full accent-aura-500"
              />
              <div className="flex justify-between text-[0.68rem] text-graphite-400">
                <span>0 (Sin actividad)</span>
                <span>6+ (Participacion activa)</span>
                <span>10 (Liderazgo)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <AuraButton
                size="sm"
                variant="ghost"
                onClick={() => handleSimulate(3, 55, 45, 3.5)}
              >
                Probar perfil inicial (3h, 55%, 45%, 3.5)
              </AuraButton>
              <AuraButton
                size="sm"
                variant="ghost"
                onClick={() => handleSimulate(6, 80, 75, 7.5)}
              >
                Probar perfil equilibrado (6h, 80%, 75%, 7.5)
              </AuraButton>
              <AuraButton
                size="sm"
                variant="ghost"
                onClick={() => handleSimulate(10, 95, 95, 9.5)}
              >
                Probar perfil sobresaliente (10h, 95%, 95%, 9.5)
              </AuraButton>
            </div>
          </div>

          {/* Resultado comparado en lenguaje sencillo */}
          <div className="neo-inset flex flex-col justify-between gap-4 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <AuraProgressRing
                value={readinessScore}
                label="Indice global"
                sublabel="de preparacion"
              />
              <div className="flex flex-1 flex-col gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-graphite-300">
                      Criterio Basico (Regla Fija)
                    </span>
                    <AuraBadge tone={rulePass ? 'success' : 'warning'}>
                      {rulePass ? 'Cumple las 3 metas' : 'Por reforzar'}
                    </AuraBadge>
                  </div>
                  <p className="mt-1 text-[0.72rem] text-graphite-400">
                    Pide al menos 5 h/sem, 70% de constancia y 65% de evidencias al mismo tiempo.
                  </p>
                </div>

                <div className="rounded-xl border border-aura-500/30 bg-aura-500/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-bone">
                      Diagnostico por Patrones (IA)
                    </span>
                    <AuraBadge tone={mlPass ? 'success' : 'warning'}>
                      {mlPass ? 'Perfil listo para avanzar' : 'Conviene practicar mas'}
                    </AuraBadge>
                  </div>
                  <p className="mt-1 text-[0.72rem] text-graphite-300">
                    Compara tus habitos con ejemplos previos para ver si tu avance general es solido aunque un indicador varie.
                  </p>
                </div>
              </div>
            </div>

            {activeData?.practice_05 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-aura-400">
                  Comparacion desde 3 perspectivas en lenguaje sencillo:
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2 text-xs">
                    <p className="font-semibold text-bone">Paso a Paso</p>
                    <p className="mt-0.5 text-[11px] text-graphite-300">
                      {activeData.practice_05.new_case_predictions.decision_tree.prediction === 1
                        ? 'Cumples los escalones clave'
                        : 'Falta cubrir un escalon'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2 text-xs">
                    <p className="font-semibold text-bone">Consenso General</p>
                    <p className="mt-0.5 text-[11px] text-aura-300">
                      {activeData.practice_05.new_case_predictions.random_forest.vote_confidence_pct}% de escenarios a favor
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2 text-xs">
                    <p className="font-semibold text-bone">Perfiles Parecidos</p>
                    <p className="mt-0.5 text-[11px] text-sky-300">
                      {activeData.practice_05.new_case_predictions.knn.distance_confidence_pct}% de similitud positiva
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeData?.practice_03.new_case.ml_decision_trace && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-aura-400">
                  Por que obtuviste este resultado:
                </p>
                <ul className="mt-1.5 flex flex-col gap-1 text-xs text-graphite-300">
                  {activeData.practice_03.new_case.ml_decision_trace.map((step, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-aura-400" aria-hidden="true" />
                      <span>{friendlyTraceStep(step)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Seccion 2: Tu camino paso a paso (Practica 1A en lenguaje amigable) y Salud de Datos (Practica 2C/2D) */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card-3d flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-aura-400" aria-hidden="true" />
              <h4 className="hud-label text-aura-400">
                Tu Camino Con Menos Escalones (Ruta Directa)
              </h4>
            </div>
            <AuraInfoBubble
              title="Diferencia entre buscar tu ruta y estimar tu avance"
              explanation="Para encontrar que pasos seguir desde tu perfil hasta tu puesto meta, AURA recorre un mapa de conexiones y busca el camino con menos escalones. En cambio, para estimar tu preparacion usa tus habitos semanales."
              benefit="Seguir esta secuencia evita dar vueltas innecesarias en tu aprendizaje."
            />
          </div>

          <p className="text-xs text-graphite-300">
            Secuencia recomendada con el menor numero de pasos ({Math.max(0, bfsRoute.length - 1)} conexiones directas):
          </p>

          <div className="flex flex-wrap items-center gap-2 py-2">
            {bfsRoute.map((node, index) => (
              <div key={node} className="flex items-center gap-2">
                <div
                  className={cn(
                    'rounded-xl border px-3 py-2 text-xs font-medium',
                    index === 0
                      ? 'border-white/15 bg-white/[0.04] text-bone'
                      : index === bfsRoute.length - 1
                        ? 'border-aura-500/50 bg-aura-500/15 text-aura-300'
                        : 'border-aura-500/25 bg-white/[0.03] text-bone',
                  )}
                >
                  <span className="mr-1.5 font-mono text-[0.68rem] text-aura-400">
                    Paso {index + 1}.
                  </span>
                  {node}
                </div>
                {index < bfsRoute.length - 1 && (
                  <ArrowRight className="h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>

          <p className="text-[0.72rem] text-graphite-400">
            Cada etapa desbloquea la siguiente: completar tus fundamentos y verificar tu portafolio te conecta directo con el rol objetivo.
          </p>
        </section>

        <section className="card-3d flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-aura-400" aria-hidden="true" />
              <h4 className="hud-label text-aura-400">
                Salud y Calidad de la Informacion de tu Perfil
              </h4>
            </div>
            <AuraInfoBubble
              title="Por que revisamos la calidad de tus datos"
              explanation="Un perfil con fechas vacias, habilidades repetidas o porcentajes fuera de lugar puede confundir la lectura de tu CV. AURA separa lo que ya esta listo de lo que conviene revisar para que ningun logro tuyo se pierda."
              benefit="Mantener tus secciones completas y sin duplicados mejora la claridad de tu perfil ante las empresas."
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Campos completos</p>
              <p className="mt-1 font-mono text-sm font-semibold text-success">Verificados</p>
              <p className="mt-0.5 text-[0.68rem] text-graphite-400">Sin huecos criticos</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Sin duplicados</p>
              <p className="mt-1 font-mono text-sm font-semibold text-aura-300">Limpio</p>
              <p className="mt-0.5 text-[0.68rem] text-graphite-400">Registros unicos</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Rangos validos</p>
              <p className="mt-1 font-mono text-sm font-semibold text-aura-300">0% - 100%</p>
              <p className="mt-0.5 text-[0.68rem] text-graphite-400">Escalas consistentes</p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-graphite-300">
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
            <span>
              <strong className="text-bone">Nota importante:</strong> Las estadisticas y estimaciones te ayudan a conocer tu avance, pero no determinan por si solas una contratacion. La decision final siempre la toma una persona.
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
