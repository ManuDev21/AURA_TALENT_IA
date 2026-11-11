import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  GitBranch,
  Layers,
  Plus,
  RefreshCw,
  Scale,
  Sliders,
  Sparkles,
  Table as TableIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
   auraApi,
  type MlLabOverviewResponse,
  type MlPractice04DepthRow,
  type MlPractice05AlgoRow,
  type MlTreeNode,
} from '@/api/aura'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraInfoBubble } from '@/components/aura/AuraInfoBubble'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type LabTab =
  | 'p01_bfs_vs_rules'
  | 'p02_data_quality'
  | 'p03_ml_vs_rules'
  | 'p04_overfitting'
  | 'p05_algorithms'

interface CustomRow {
  candidato: string
  horas_estudio: number | null
  asistencia: number | null
  actividades_entregadas: number | null
  calificacion: number | null
}

function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function TreeDiagram({ node }: { node: MlTreeNode }) {
  const renderNodeBox = (n: MlTreeNode, title: string, keyPath: string) => {
    const isLeaf = n.is_leaf
    return (
      <div
        key={keyPath}
        className={cn(
          'flex flex-col gap-1.5 rounded-xl border p-3 text-xs',
          isLeaf
            ? n.prediction === 1
              ? 'border-success/40 bg-success/10 text-bone'
              : 'border-warning/40 bg-warning/10 text-bone'
            : 'border-aura-500/35 bg-white/[0.03] text-bone',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-aura-400">
            {title} (Nivel {n.depth})
          </span>
          <AuraBadge tone={n.prediction === 1 ? 'success' : 'warning'}>
            {isLeaf
              ? n.prediction === 1
                ? 'Hoja: Aprueba (1)'
                : 'Hoja: Refuerzo (0)'
              : `${n.feature} <= ${n.threshold}`}
          </AuraBadge>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[0.7rem] text-graphite-300">
          <span>Muestras: {n.samples}</span>
          <span>Gini: {n.gini}</span>
          <span>
            Clases [0, 1]: [{n.class_counts[0]}, {n.class_counts[1]}]
          </span>
        </div>
        {!isLeaf && (n.left || n.right) && (
          <div className="mt-2 grid gap-2 border-t border-white/10 pt-2 md:grid-cols-2">
            {n.left && renderNodeBox(n.left, 'Si cumple (<=)', `${keyPath}-L`)}
            {n.right && renderNodeBox(n.right, 'No cumple (>)', `${keyPath}-R`)}
          </div>
        )}
      </div>
    )
  }

  return renderNodeBox(node, 'Raiz del Arbol CART', 'root')
}

function OverfittingCurveChart({
  rows,
  selectedDepth,
}: {
  rows: MlPractice04DepthRow[]
  selectedDepth: string
}) {
  const width = 680
  const height = 250
  const padL = 52
  const padR = 28
  const padT = 26
  const padB = 42
  const innerW = width - padL - padR
  const innerH = height - padT - padB

  const xFor = (idx: number) =>
    rows.length <= 1 ? padL + innerW / 2 : padL + (idx / (rows.length - 1)) * innerW
  const yFor = (pct: number) => padT + innerH - (Math.max(40, Math.min(100, pct)) - 40) / 60 * innerH

  const trainPoints = rows.map((r, i) => `${xFor(i)},${yFor(r.entrenamiento_pct)}`).join(' ')
  const valPoints = rows.map((r, i) => `${xFor(i)},${yFor(r.validacion_pct)}`).join(' ')

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#070911] p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[460px]"
        role="img"
        aria-label="Curva comparativa de exactitud en Entrenamiento vs Validacion por profundidad del arbol"
      >
        {[50, 60, 70, 80, 90, 100].map((tick) => {
          const y = yFor(tick)
          return (
            <g key={tick}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="rgba(148,163,184,0.16)"
                strokeDasharray="4 4"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="10"
                fontFamily="monospace"
              >
                {tick}%
              </text>
            </g>
          )
        })}

        {/* Sombreado de brecha entre entrenamiento y validacion */}
        {rows.map((r, i) => {
          const x = xFor(i)
          const yT = yFor(r.entrenamiento_pct)
          const yV = yFor(r.validacion_pct)
          const isSelected = r.profundidad === selectedDepth
          return (
            <g key={r.profundidad}>
              <line
                x1={x}
                y1={Math.min(yT, yV)}
                x2={x}
                y2={Math.max(yT, yV)}
                stroke={r.diferencia_pct > 10 ? 'rgba(244,63,94,0.55)' : 'rgba(56,189,248,0.35)'}
                strokeWidth={isSelected ? 4 : 2}
              />
              {isSelected && (
                <rect
                  x={x - 22}
                  y={padT - 6}
                  width={44}
                  height={innerH + 12}
                  rx={8}
                  fill="rgba(16,185,129,0.10)"
                  stroke="rgba(16,185,129,0.45)"
                  strokeDasharray="3 3"
                />
              )}
            </g>
          )
        })}

        {/* Linea de Entrenamiento */}
        <polyline
          fill="none"
          stroke="#ff7a1a"
          strokeWidth="3"
          points={trainPoints}
        />

        {/* Linea de Validacion */}
        <polyline
          fill="none"
          stroke="#38bdf8"
          strokeWidth="3"
          points={valPoints}
        />

        {/* Puntos y etiquetas */}
        {rows.map((r, i) => {
          const x = xFor(i)
          const yT = yFor(r.entrenamiento_pct)
          const yV = yFor(r.validacion_pct)
          return (
            <g key={`pts-${r.profundidad}`}>
              <circle cx={x} cy={yT} r={5} fill="#ff7a1a" stroke="#070911" strokeWidth="1.5" />
              <text
                x={x}
                y={yT - 9}
                textAnchor="middle"
                fill="#ffb878"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {r.entrenamiento_pct}%
              </text>

              <rect
                x={x - 4.5}
                y={yV - 4.5}
                width={9}
                height={9}
                rx={2}
                fill="#38bdf8"
                stroke="#070911"
                strokeWidth="1.5"
              />
              <text
                x={x}
                y={yV + 16}
                textAnchor="middle"
                fill="#7dd3fc"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {r.validacion_pct}%
              </text>

              <text
                x={x}
                y={height - 14}
                textAnchor="middle"
                fill={r.profundidad === selectedDepth ? '#10b981' : '#cbd5e1'}
                fontSize="11"
                fontWeight={r.profundidad === selectedDepth ? 'bold' : 'normal'}
              >
                Prof: {r.profundidad}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-2 text-[11px] text-slate-300">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-aura-500" />
            Exactitud Entrenamiento (60%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-sky-400" />
            Exactitud Validacion (20%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs border border-emerald-400 bg-emerald-500/20" />
            Mejor profundidad elegida ({selectedDepth})
          </span>
        </div>
        <span className="font-mono text-[10px] text-amber-300">
          Brecha &gt; 10% entre curvas = Posible Sobreajuste (Overfitting)
        </span>
      </div>
    </div>
  )
}

function AlgorithmsGroupedBarChart({
  rows,
  winner,
}: {
  rows: MlPractice05AlgoRow[]
  winner: string
}) {
  const width = 680
  const height = 250
  const padL = 48
  const padR = 24
  const padT = 26
  const padB = 44
  const innerW = width - padL - padR
  const innerH = height - padT - padB

  const metrics: Array<{
    key: 'exactitud_pct' | 'precision_pct' | 'recall_pct' | 'f1_pct'
    label: string
    color: string
  }> = [
    { key: 'exactitud_pct', label: 'Exactitud', color: '#ff7a1a' },
    { key: 'precision_pct', label: 'Precision', color: '#38bdf8' },
    { key: 'recall_pct', label: 'Recall', color: '#a855f7' },
    { key: 'f1_pct', label: 'F1-Score', color: '#10b981' },
  ]

  const groupWidth = innerW / Math.max(1, rows.length)
  const barW = Math.min(30, (groupWidth - 36) / metrics.length)

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#070911] p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[460px]"
        role="img"
        aria-label="Comparacion agrupada de Exactitud, Precision, Recall y F1-Score entre Decision Tree, Random Forest y KNN"
      >
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padT + innerH - (tick / 100) * innerH
          return (
            <g key={tick}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="rgba(148,163,184,0.16)"
                strokeDasharray="4 4"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="10"
                fontFamily="monospace"
              >
                {tick}%
              </text>
            </g>
          )
        })}

        {rows.map((algo, gIdx) => {
          const centerX = padL + gIdx * groupWidth + groupWidth / 2
          const totalBarsWidth = metrics.length * barW + (metrics.length - 1) * 6
          const startX = centerX - totalBarsWidth / 2
          const isWinner = algo.algoritmo === winner

          return (
            <g key={algo.algoritmo}>
              {isWinner && (
                <rect
                  x={centerX - totalBarsWidth / 2 - 10}
                  y={padT - 8}
                  width={totalBarsWidth + 20}
                  height={innerH + 14}
                  rx={10}
                  fill="rgba(16,185,129,0.08)"
                  stroke="rgba(16,185,129,0.4)"
                  strokeDasharray="4 3"
                />
              )}

              {metrics.map((m, mIdx) => {
                const val = Number(algo[m.key])
                const h = Math.max(4, (val / 100) * innerH)
                const x = startX + mIdx * (barW + 6)
                const y = padT + innerH - h
                return (
                  <g key={m.key}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx={4}
                      fill={m.color}
                      className="bar-grow"
                    />
                    <text
                      x={x + barW / 2}
                      y={y - 5}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {Math.round(val)}%
                    </text>
                  </g>
                )
              })}

              <text
                x={centerX}
                y={height - 14}
                textAnchor="middle"
                fill={isWinner ? '#10b981' : '#f8fafc'}
                fontSize="12"
                fontWeight="bold"
              >
                {algo.algoritmo} {isWinner ? '(Ganador F1)' : ''}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-2 text-[11px] text-slate-300">
        <div className="flex flex-wrap items-center gap-4">
          {metrics.map((m) => (
            <span key={m.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: m.color }} />
              {m.label}
            </span>
          ))}
        </div>
        <span className="font-mono text-[10px] text-emerald-400">
          Criterio de seleccion: Mayor F1-Score en Validacion
        </span>
      </div>
    </div>
  )
}

export function CompanyDataMlLab() {
  const [activeTab, setActiveTab] = useState<LabTab>('p05_algorithms')

  // Estado interactivo para Practicas 03, 04 y 05
  const [horas, setHoras] = useState(6)
  const [asistencia, setAsistencia] = useState(80)
  const [actividades, setActividades] = useState(75)
  const [participacion, setParticipacion] = useState(7.5)
  const [minHorasRule, setMinHorasRule] = useState(5)
  const [minAsistenciaRule, setMinAsistenciaRule] = useState(70)
  const [minActividadesRule, setMinActividadesRule] = useState(65)
  const [maxDepth, setMaxDepth] = useState(3)

  // Hiperparametros de los Experimentos A, B y C de la Practica 05
  const [knnNeighbors, setKnnNeighbors] = useState(7)
  const [rfEstimators, setRfEstimators] = useState(100)
  const [dtMaxDepth, setDtMaxDepth] = useState(5)

  // Estado interactivo para Practica 02 (Agregar registros validos o con anomalias para auditar)
  const [extraDirtyRows, setExtraDirtyRows] = useState<CustomRow[]>([])
  const [newCandidateName, setNewCandidateName] = useState('Valeria')
  const [newHoras, setNewHoras] = useState('9')
  const [newAsistencia, setNewAsistencia] = useState('92')
  const [newActividades, setNewActividades] = useState('95')
  const [newCalificacion, setNewCalificacion] = useState('94')

  const { data: initialData, isLoading } = useQuery({
    queryKey: ['aura', 'ml-lab', 'overview'],
    queryFn: auraApi.mlLabOverview,
  })

  const simMutation = useMutation({
    mutationFn: auraApi.mlLabSimulate,
  })

  const labData: MlLabOverviewResponse | undefined = simMutation.data ?? initialData

  const triggerSimulation = (overrides?: Partial<{
    horas_estudio: number
    asistencia: number
    actividades_entregadas: number
    participacion: number
    min_horas_rule: number
    min_asistencia_rule: number
    min_actividades_rule: number
    max_depth: number
    knn_neighbors: number
    rf_estimators: number
    dt_max_depth: number
  }>) => {
    const payload = {
      horas_estudio: overrides?.horas_estudio ?? horas,
      asistencia: overrides?.asistencia ?? asistencia,
      actividades_entregadas: overrides?.actividades_entregadas ?? actividades,
      participacion: overrides?.participacion ?? participacion,
      min_horas_rule: overrides?.min_horas_rule ?? minHorasRule,
      min_asistencia_rule: overrides?.min_asistencia_rule ?? minAsistenciaRule,
      min_actividades_rule: overrides?.min_actividades_rule ?? minActividadesRule,
      max_depth: overrides?.max_depth ?? maxDepth,
      knn_neighbors: overrides?.knn_neighbors ?? knnNeighbors,
      rf_estimators: overrides?.rf_estimators ?? rfEstimators,
      dt_max_depth: overrides?.dt_max_depth ?? dtMaxDepth,
    }
    simMutation.mutate(payload)
  }

  // Auditoria combinada en vivo para Practica 02 cuando el usuario agrega filas
  const liveQualityAudit = useMemo(() => {
    if (!labData) return null
    const baseDirty: CustomRow[] = [
      { candidato: 'Ana', horas_estudio: 8, asistencia: 95, actividades_entregadas: 100, calificacion: 92 },
      { candidato: 'Luis', horas_estudio: 3, asistencia: 60, actividades_entregadas: 50, calificacion: 58 },
      { candidato: 'Maria', horas_estudio: null, asistencia: 98, actividades_entregadas: 100, calificacion: 96 },
      { candidato: 'Luis', horas_estudio: 3, asistencia: 60, actividades_entregadas: 50, calificacion: 58 },
      { candidato: 'Carlos', horas_estudio: 5, asistencia: 110, actividades_entregadas: 80, calificacion: null },
      ...extraDirtyRows,
    ]

    const seen = new Set<string>()
    const duplicates: Array<CustomRow & { motivo: string }> = []
    const validRows: CustomRow[] = []
    const reviewRows: Array<CustomRow & { motivo_revision: string }> = []
    const missingCounts = {
      candidato: 0,
      horas_estudio: 0,
      asistencia: 0,
      actividades_entregadas: 0,
      calificacion: 0,
    }

    for (const row of baseDirty) {
      if (!row.candidato) missingCounts.candidato += 1
      if (row.horas_estudio === null) missingCounts.horas_estudio += 1
      if (row.asistencia === null) missingCounts.asistencia += 1
      if (row.actividades_entregadas === null) missingCounts.actividades_entregadas += 1
      if (row.calificacion === null) missingCounts.calificacion += 1

      const sig = `${row.candidato}|${row.horas_estudio}|${row.asistencia}|${row.actividades_entregadas}|${row.calificacion}`
      if (seen.has(sig)) {
        duplicates.push({ ...row, motivo: 'Fila completamente duplicada (duplicated)' })
        continue
      }
      seen.add(sig)

      const reasons: string[] = []
      if (row.horas_estudio === null) reasons.push('Valor faltante en horas_estudio')
      if (row.asistencia === null) reasons.push('Valor faltante en asistencia')
      if (row.actividades_entregadas === null) reasons.push('Valor faltante en actividades_entregadas')
      if (row.calificacion === null) reasons.push('Valor faltante en calificacion')

      if (row.horas_estudio !== null && row.horas_estudio < 0) {
        reasons.push(`Horas negativas (${row.horas_estudio})`)
      }
      if (row.asistencia !== null && (row.asistencia < 0 || row.asistencia > 100)) {
        reasons.push(`Asistencia fuera de rango 0-100 (${row.asistencia}%)`)
      }
      if (
        row.actividades_entregadas !== null &&
        (row.actividades_entregadas < 0 || row.actividades_entregadas > 100)
      ) {
        reasons.push(`Actividades fuera de rango 0-100 (${row.actividades_entregadas}%)`)
      }
      if (row.calificacion !== null && (row.calificacion < 0 || row.calificacion > 100)) {
        reasons.push(`Calificacion fuera de rango 0-100 (${row.calificacion})`)
      }

      if (reasons.length === 0) {
        validRows.push(row)
      } else {
        reviewRows.push({ ...row, motivo_revision: reasons.join(' | ') })
      }
    }

    const toCsv = (rows: Array<Record<string, unknown>>, cols: string[]) => {
      const header = cols.join(',')
      const lines = rows.map((r) =>
        cols
          .map((c) => {
            const v = r[c]
            return v === null || v === undefined ? '' : String(v)
          })
          .join(','),
      )
      return [header, ...lines].join('\n')
    }

    return {
      totalRows: baseDirty.length,
      missingCounts,
      duplicates,
      validRows,
      reviewRows,
      validCsv: toCsv(validRows as unknown as Array<Record<string, unknown>>, [
        'candidato',
        'horas_estudio',
        'asistencia',
        'actividades_entregadas',
        'calificacion',
      ]),
      reviewCsv: toCsv(reviewRows as unknown as Array<Record<string, unknown>>, [
        'candidato',
        'horas_estudio',
        'asistencia',
        'actividades_entregadas',
        'calificacion',
        'motivo_revision',
      ]),
    }
  }, [labData, extraDirtyRows])

  const handleAddCustomRow = (preset?: CustomRow) => {
    if (preset) {
      setExtraDirtyRows((prev) => [...prev, preset])
      toast.success(`Registro de ${preset.candidato} agregado para auditoria.`)
      return
    }
    const parsedHoras = newHoras.trim() === '' ? null : Number(newHoras)
    const parsedAsist = newAsistencia.trim() === '' ? null : Number(newAsistencia)
    const parsedAct = newActividades.trim() === '' ? null : Number(newActividades)
    const parsedCal = newCalificacion.trim() === '' ? null : Number(newCalificacion)

    setExtraDirtyRows((prev) => [
      ...prev,
      {
        candidato: newCandidateName.trim() || 'Postulante',
        horas_estudio: Number.isNaN(parsedHoras) ? null : parsedHoras,
        asistencia: Number.isNaN(parsedAsist) ? null : parsedAsist,
        actividades_entregadas: Number.isNaN(parsedAct) ? null : parsedAct,
        calificacion: Number.isNaN(parsedCal) ? null : parsedCal,
      },
    ])
    toast.success('Registro agregado a la tabla de inspeccion.')
  }

  if (isLoading || !labData || !liveQualityAudit) {
    return (
      <div className="card-3d flex justify-center rounded-2xl p-8">
        <AuraLoader label="Inicializando Laboratorio de Ciencia de Datos, Reglas y Machine Learning" />
      </div>
    )
  }

  const p01 = labData.practice_01
  const p02 = labData.practice_02
  const p03 = labData.practice_03
  const p04 = labData.practice_04
  const p05 = labData.practice_05

  return (
    <section className="card-3d flex flex-col gap-5 rounded-2xl p-5">
      {/* Encabezado y pestañas de las 5 Practicas integradas */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-start gap-3">
          <div className="icon-orb-3d flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-aura-400">
            <GitBranch className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-semibold text-bone">
                Laboratorio de Ciencia de Datos, Validacion (60/20/20) y Algoritmos de Machine Learning
              </h3>
              <AuraBadge tone="info">Vista Empresarial y Auditoria</AuraBadge>
              <AuraInfoBubble
                title="Que integra este laboratorio empresarial"
                explanation="Integra las 5 practicas completas: 1) Busqueda en Grafos (BFS) vs Regla Fija; 2) Calidad, Limpieza CSV y Variables (X, y); 3) Reglas Fijas vs Arbol de Decision; 4) Division 60% Entrenamiento / 20% Validacion / 20% Prueba con diagnostico de Subajuste y Sobreajuste; y 5) Comparacion entre Decision Tree, Random Forest y KNN (StandardScaler)."
                benefit="Todas las graficas, matrices de confusion, validaciones cruzadas 5-Fold y exportaciones CSV son interactivas."
              />
            </div>
            <p className="mt-1 text-xs text-graphite-300">
              Experimenta con hiperparametros en vivo (`n_neighbors`, `n_estimators`, `max_depth`), audita el sobreajuste y compara `Decision Tree`, `Random Forest` y `KNN`.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <AuraButton
            size="sm"
            variant={activeTab === 'p05_algorithms' ? 'primary' : 'ghost'}
            icon={Sparkles}
            onClick={() => setActiveTab('p05_algorithms')}
          >
            5. Decision Tree vs Random Forest vs KNN
          </AuraButton>
          <AuraButton
            size="sm"
            variant={activeTab === 'p04_overfitting' ? 'primary' : 'ghost'}
            icon={Activity}
            onClick={() => setActiveTab('p04_overfitting')}
          >
            4. Split 60/20/20 y Sobreajuste
          </AuraButton>
          <AuraButton
            size="sm"
            variant={activeTab === 'p03_ml_vs_rules' ? 'primary' : 'ghost'}
            icon={Scale}
            onClick={() => setActiveTab('p03_ml_vs_rules')}
          >
            3. Reglas Fijas vs Arbol ML
          </AuraButton>
          <AuraButton
            size="sm"
            variant={activeTab === 'p02_data_quality' ? 'primary' : 'ghost'}
            icon={Database}
            onClick={() => setActiveTab('p02_data_quality')}
          >
            2. Calidad y Limpieza CSV
          </AuraButton>
          <AuraButton
            size="sm"
            variant={activeTab === 'p01_bfs_vs_rules' ? 'primary' : 'ghost'}
            icon={GitBranch}
            onClick={() => setActiveTab('p01_bfs_vs_rules')}
          >
            1. BFS vs Regla Fija
          </AuraButton>
        </div>
      </div>

      {/* =====================================================================
          PESTAÑA 1: BUSQUEDA EN ANCHURA (BFS) FRENTE A REGLA FIJA (PRACTICA 01)
         ===================================================================== */}
      {activeTab === 'p01_bfs_vs_rules' && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Parte A: BFS con cola FIFO */}
            <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="hud-label text-aura-400">
                  Problema A — Encontrar Ruta con Busqueda en Anchura (BFS · Cola FIFO)
                </span>
                <AuraBadge tone="success">
                  {p01.bfs.connections} conexiones directas
                </AuraBadge>
              </div>
              <p className="text-xs text-graphite-300">
                Cuando la empresa necesita trazar una secuencia de etapas conocidas desde el{' '}
                <strong className="text-bone">{p01.bfs.start}</strong> hasta el{' '}
                <strong className="text-bone">{p01.bfs.goal}</strong>, utiliza una cola FIFO (`deque`) y un conjunto de nodos visitados para garantizar el camino con menos saltos:
              </p>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                {(p01.bfs.route ?? []).map((step, idx, arr) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="rounded-lg border border-aura-500/30 bg-aura-500/10 px-2.5 py-1 text-xs font-medium text-bone">
                      {idx + 1}. {step}
                    </span>
                    {idx < arr.length - 1 && (
                      <ArrowRight className="h-3.5 w-3.5 text-aura-400" aria-hidden="true" />
                    )}
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                      <th className="py-1.5 pr-2">Paso</th>
                      <th className="py-1.5 pr-2">Nodo extraido (`popleft`)</th>
                      <th className="py-1.5 pr-2">Ruta en construccion</th>
                      <th className="py-1.5 text-right">Visitados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {p01.bfs.steps_log.map((st, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 pr-2 font-mono text-aura-400">#{idx + 1}</td>
                        <td className="py-1.5 pr-2 font-medium text-bone">{st.current_node}</td>
                        <td className="py-1.5 pr-2 text-graphite-300">
                          {st.current_path.join(' -> ')}
                        </td>
                        <td className="py-1.5 text-right font-mono text-graphite-300">
                          {st.visited_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Parte B: Toma de decision mediante Regla Fija */}
            <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="hud-label text-aura-400">
                  Problema B — Clasificar Preparacion con Regla Fija (`horas &gt;= 6`)
                </span>
                <AuraBadge tone="neutral">Condicion manual</AuraBadge>
              </div>
              <p className="text-xs text-graphite-300">
                Cuando el objetivo no es recorrer un mapa sino estimar si una persona cuenta con la dedicacion suficiente, un primer enfoque es aplicar una regla fija manual antes de pasar a un modelo que aprende de ejemplos:
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                      <th className="py-1.5 pr-2">Postulante</th>
                      <th className="py-1.5 pr-2">Horas semanales</th>
                      <th className="py-1.5">Resultado con regla fija (`&gt;= 6 h`)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {p01.fixed_rule_batch.map((item) => (
                      <tr key={item.nombre}>
                        <td className="py-2 pr-2 font-medium text-bone">{item.nombre}</td>
                        <td className="py-2 pr-2 font-mono text-aura-300">{item.horas_estudio} h</td>
                        <td className="py-2">
                          <AuraBadge
                            tone={item.horas_estudio >= 6 ? 'success' : 'warning'}
                          >
                            {item.resultado}
                          </AuraBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-graphite-300">
                <p className="font-semibold text-bone">
                  Conclusion metodologica (Busqueda vs Aprendizaje):
                </p>
                <p className="mt-1">
                  Aunque ambos forman parte de AURA, resuelven problemas distintos: <strong>BFS</strong> explora estados y conexiones conocidas en un grafo; en cambio, <strong>estimar resultados a partir de historicos</strong> requiere reglas multivariables o modelos supervisados de Machine Learning.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: EXPLORACION, CALIDAD, LIMPIEZA CSV Y VARIABLES X/y (PRACTICA 02)
         ===================================================================== */}
      {activeTab === 'p02_data_quality' && (
        <div className="flex flex-col gap-5">
          {/* KPIs de estructura tabular (shape, mean, registros validos vs revision) */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Dimensiones base (`shape`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-bone">
                ({p02.shape[0]} filas, {p02.shape[1]} cols)
              </p>
              <p className="text-[0.68rem] text-graphite-400">Tabla limpia original</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Promedio calificacion (`mean`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-aura-300">
                {p02.mean_score} pts
              </p>
              <p className="text-[0.68rem] text-graphite-400">Sobre {p02.shape[0]} perfiles</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Filas con anomalias</p>
              <p className="mt-1 font-mono text-base font-semibold text-warning">
                {liveQualityAudit.reviewRows.length} en revision
              </p>
              <p className="text-[0.68rem] text-graphite-400">
                +{liveQualityAudit.duplicates.length} duplicadas
              </p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Registros validados</p>
              <p className="mt-1 font-mono text-base font-semibold text-success">
                {liveQualityAudit.validRows.length} limpios
              </p>
              <p className="text-[0.68rem] text-graphite-400">Listos para entrenar</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Alineacion `X` e `y`</p>
              <p className="mt-1 font-mono text-base font-semibold text-aura-300">
                X({p02.variables_xy.x_shape[0]}x{p02.variables_xy.x_shape[1]}) = y({p02.variables_xy.y_shape[0]})
              </p>
              <p className="text-[0.68rem] text-graphite-400">Correspondencia 1 a 1</p>
            </div>
          </div>

          {/* Exploracion Estadistica: describe() y dtypes */}
          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Estadisticas Descriptivas (`df.describe()`)
                </span>
                <AuraInfoBubble
                  title="Que resume describe()"
                  explanation="Calcula la media (mean), desviacion estandar (std), minimo, maximo y percentiles (25%, 50%, 75%) de todas las columnas numericas."
                  benefit={p02.caution_note}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                      <th className="py-1.5 pr-2">Variable</th>
                      <th className="py-1.5 pr-2 text-right">Count</th>
                      <th className="py-1.5 pr-2 text-right">Mean</th>
                      <th className="py-1.5 pr-2 text-right">Std</th>
                      <th className="py-1.5 pr-2 text-right">Min</th>
                      <th className="py-1.5 pr-2 text-right">25%</th>
                      <th className="py-1.5 pr-2 text-right">50%</th>
                      <th className="py-1.5 pr-2 text-right">75%</th>
                      <th className="py-1.5 text-right">Max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {Object.entries(p02.describe).map(([col, st]) => (
                      <tr key={col}>
                        <td className="py-2 pr-2 font-sans font-medium text-bone">{col}</td>
                        <td className="py-2 pr-2 text-right text-graphite-300">{st.count}</td>
                        <td className="py-2 pr-2 text-right text-aura-300">{st.mean}</td>
                        <td className="py-2 pr-2 text-right text-graphite-300">{st.std}</td>
                        <td className="py-2 pr-2 text-right text-graphite-300">{st.min}</td>
                        <td className="py-2 pr-2 text-right text-graphite-300">{st.p25}</td>
                        <td className="py-2 pr-2 text-right text-bone">{st.p50}</td>
                        <td className="py-2 pr-2 text-right text-graphite-300">{st.p75}</td>
                        <td className="py-2 text-right text-aura-300">{st.max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[0.7rem] text-graphite-400">{p02.caution_note}</p>
            </div>

            <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
              <span className="hud-label flex items-center gap-1.5 text-aura-400">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                Tipos de Datos (`dtypes`) y Separacion `X` vs `y`
              </span>
              <ul className="flex flex-col gap-1.5 text-xs">
                {Object.entries(p02.dtypes).map(([col, dtype]) => (
                  <li
                    key={col}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5"
                  >
                    <span className="font-mono text-bone">{col}</span>
                    <span className="text-graphite-400">{dtype}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-xl border border-aura-500/25 bg-aura-500/5 p-3 text-xs">
                <p className="font-semibold text-bone">
                  Variables de entrada `X` y Variable objetivo `y`:
                </p>
                <p className="mt-1 font-mono text-[0.72rem] text-aura-300">
                  X = [{p02.variables_xy.x_columns.join(', ')}]
                </p>
                <p className="mt-0.5 font-mono text-[0.72rem] text-success">
                  y = [{p02.variables_xy.y_column}]
                </p>
              </div>
            </div>
          </div>

          {/* Auditoria de Calidad, Limpieza y Exportacion CSV (Practica 2C y 2D) */}
          <div className="neo-inset flex flex-col gap-4 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="hud-label flex items-center gap-1.5 text-aura-400">
                  <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  Auditoria de Calidad, Limpieza y Exportacion Dual (`limpios.csv` vs `revision.csv`)
                </h4>
                <p className="mt-0.5 text-xs text-graphite-300">
                  Detecta valores faltantes (`isnull`), duplicados (`drop_duplicates`) y valores fuera de rango (`0-100`). Ningun registro descartado desaparece sin explicacion: se conserva en el archivo de revision para auditoria humana.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AuraButton
                  size="sm"
                  variant="neo"
                  icon={Download}
                  onClick={() => {
                    downloadCsvFile('candidatos_limpios.csv', liveQualityAudit.validCsv)
                    toast.success('Archivo candidatos_limpios.csv descargado.')
                  }}
                >
                  Descargar validos CSV ({liveQualityAudit.validRows.length})
                </AuraButton>
                <AuraButton
                  size="sm"
                  variant="ghost"
                  icon={Download}
                  onClick={() => {
                    downloadCsvFile('candidatos_revision.csv', liveQualityAudit.reviewCsv)
                    toast.success('Archivo candidatos_revision.csv descargado.')
                  }}
                >
                  Descargar en revision CSV ({liveQualityAudit.reviewRows.length})
                </AuraButton>
              </div>
            </div>

            {/* Formulario para agregar un registro nuevo (valido o con error intencional) */}
            <div className="flex flex-wrap items-end gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex flex-col gap-1">
                <label className="text-[0.68rem] text-graphite-400">Postulante</label>
                <input
                  type="text"
                  value={newCandidateName}
                  onChange={(e) => setNewCandidateName(e.target.value)}
                  className="w-28 rounded-lg border border-white/10 bg-obsidian-900/70 px-2.5 py-1.5 text-xs text-bone"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.68rem] text-graphite-400">Horas (vacío = nulo)</label>
                <input
                  type="number"
                  value={newHoras}
                  onChange={(e) => setNewHoras(e.target.value)}
                  className="w-28 rounded-lg border border-white/10 bg-obsidian-900/70 px-2.5 py-1.5 text-xs text-bone"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.68rem] text-graphite-400">Asistencia % (0-100)</label>
                <input
                  type="number"
                  value={newAsistencia}
                  onChange={(e) => setNewAsistencia(e.target.value)}
                  className="w-28 rounded-lg border border-white/10 bg-obsidian-900/70 px-2.5 py-1.5 text-xs text-bone"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.68rem] text-graphite-400">Actividades % (0-100)</label>
                <input
                  type="number"
                  value={newActividades}
                  onChange={(e) => setNewActividades(e.target.value)}
                  className="w-28 rounded-lg border border-white/10 bg-obsidian-900/70 px-2.5 py-1.5 text-xs text-bone"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.68rem] text-graphite-400">Calificacion (0-100)</label>
                <input
                  type="number"
                  value={newCalificacion}
                  onChange={(e) => setNewCalificacion(e.target.value)}
                  className="w-28 rounded-lg border border-white/10 bg-obsidian-900/70 px-2.5 py-1.5 text-xs text-bone"
                />
              </div>
              <AuraButton size="sm" variant="primary" icon={Plus} onClick={() => handleAddCustomRow()}>
                Agregar fila
              </AuraButton>
              <AuraButton
                size="sm"
                variant="ghost"
                onClick={() =>
                  handleAddCustomRow({
                    candidato: 'Registro Fuera Rango',
                    horas_estudio: 6,
                    asistencia: 125,
                    actividades_entregadas: 80,
                    calificacion: 88,
                  })
                }
              >
                + Simular error (&gt;100%)
              </AuraButton>
              {extraDirtyRows.length > 0 && (
                <AuraButton
                  size="sm"
                  variant="ghost"
                  icon={RefreshCw}
                  onClick={() => setExtraDirtyRows([])}
                >
                  Restaurar lote original
                </AuraButton>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Tabla de registros validos */}
              <div className="rounded-xl border border-success/30 bg-success/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-bone">
                    <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                    Registros Validos (`df_validos` · {liveQualityAudit.validRows.length})
                  </span>
                  <AuraBadge tone="success">Cumplen completitud y rango</AuraBadge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                        <th className="py-1 pr-2">Candidato</th>
                        <th className="py-1 pr-2 text-right">Horas</th>
                        <th className="py-1 pr-2 text-right">Asistencia</th>
                        <th className="py-1 pr-2 text-right">Actividades</th>
                        <th className="py-1 text-right">Calif.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {liveQualityAudit.validRows.map((r, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-2 font-sans text-bone">{r.candidato}</td>
                          <td className="py-1.5 pr-2 text-right text-graphite-300">{r.horas_estudio}</td>
                          <td className="py-1.5 pr-2 text-right text-graphite-300">{r.asistencia}%</td>
                          <td className="py-1.5 pr-2 text-right text-graphite-300">
                            {r.actividades_entregadas}%
                          </td>
                          <td className="py-1.5 text-right text-success">{r.calificacion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabla de registros que requieren revision + duplicados */}
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-bone">
                    <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                    Registros que Requieren Revision (`df_revision` · {liveQualityAudit.reviewRows.length})
                  </span>
                  <AuraBadge tone="warning">Auditables con motivo</AuraBadge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                        <th className="py-1 pr-2">Candidato</th>
                        <th className="py-1 pr-2">Horas / Asist. / Calif.</th>
                        <th className="py-1">Motivo de exclusion y revision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {liveQualityAudit.reviewRows.map((r, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-2 font-medium text-bone">{r.candidato}</td>
                          <td className="py-1.5 pr-2 font-mono text-graphite-300">
                            {r.horas_estudio ?? 'NULL'}h | {r.asistencia ?? 'NULL'}% |{' '}
                            {r.calificacion ?? 'NULL'}
                          </td>
                          <td className="py-1.5 text-warning">{r.motivo_revision}</td>
                        </tr>
                      ))}
                      {liveQualityAudit.duplicates.map((d, i) => (
                        <tr key={`dup-${i}`}>
                          <td className="py-1.5 pr-2 font-medium text-bone">{d.candidato}</td>
                          <td className="py-1.5 pr-2 font-mono text-graphite-300">
                            {d.horas_estudio}h | {d.asistencia}% | {d.calificacion}
                          </td>
                          <td className="py-1.5 text-aura-300">{d.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 3: REGLAS FIJAS VS ARBOL DE DECISION ML (PRACTICA 03)
         ===================================================================== */}
      {activeTab === 'p03_ml_vs_rules' && (
        <div className="flex flex-col gap-5">
          {/* KPIs del Experimento Supervisado (30 registros -> 21 train / 9 test) */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Dataset Historico</p>
              <p className="mt-1 font-mono text-base font-semibold text-bone">
                {p03.total_records} registros
              </p>
              <p className="text-[0.68rem] text-graphite-400">
                Clase 0: {p03.class_distribution.no_aprueba_0} · Clase 1: {p03.class_distribution.aprueba_1}
              </p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Entrenamiento (`70%`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-aura-300">
                {p03.train_count} ejemplos (`fit`)
              </p>
              <p className="text-[0.68rem] text-graphite-400">Estratificado (semilla 42)</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Prueba (`30%`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-aura-300">
                {p03.test_count} ejemplos (`predict`)
              </p>
              <p className="text-[0.68rem] text-graphite-400">No vistos en entrenamiento</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Exactitud Reglas Fijas</p>
              <p className="mt-1 font-mono text-base font-semibold text-warning">
                {p03.metrics_rules.accuracy_pct}%
              </p>
              <p className="text-[0.68rem] text-graphite-400">Condiciones manuales</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Exactitud Arbol ML</p>
              <p className="mt-1 font-mono text-base font-semibold text-success">
                {p03.metrics_ml.accuracy_pct}%
              </p>
              <p className="text-[0.68rem] text-graphite-400">
                `DecisionTree(max_depth={maxDepth})`
              </p>
            </div>
          </div>

          {/* Controles de Umbrales de Reglas Fijas vs Hiperparametro max_depth + Simulador de Caso Nuevo */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                  Configurar Reglas Fijas Manuales y Profundidad del Arbol (`max_depth`)
                </span>
                <AuraInfoBubble
                  title="Reglas Manuales vs Arbol que aprende (fit)"
                  explanation="El sistema de reglas fijas exige que la persona cumpla simultaneamente los 3 minimos que definas aqui. El Arbol de Decisiones aprende automaticamente los cortes optimos a partir del 70% de los datos."
                  benefit="Modifica los umbrales para observar como cambia la exactitud del sistema de reglas frente al modelo entrenado."
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[0.68rem] text-graphite-400">Regla: Horas min.</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={minHorasRule}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setMinHorasRule(v)
                      triggerSimulation({ min_horas_rule: v })
                    }}
                    className="rounded-lg border border-white/10 bg-obsidian-900/70 px-2.5 py-1.5 font-mono text-xs text-bone"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.68rem] text-graphite-400">Regla: Asist. min %</label>
                  <input
                    type="number"
                    min={30}
                    max={100}
                    value={minAsistenciaRule}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setMinAsistenciaRule(v)
                      triggerSimulation({ min_asistencia_rule: v })
                    }}
                    className="rounded-lg border border-white/10 bg-obsidian-900/70 px-2.5 py-1.5 font-mono text-xs text-bone"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.68rem] text-graphite-400">Regla: Activ. min %</label>
                  <input
                    type="number"
                    min={20}
                    max={100}
                    value={minActividadesRule}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setMinActividadesRule(v)
                      triggerSimulation({ min_actividades_rule: v })
                    }}
                    className="rounded-lg border border-white/10 bg-obsidian-900/70 px-2.5 py-1.5 font-mono text-xs text-bone"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.68rem] text-graphite-400">Arbol `max_depth`</label>
                  <select
                    value={maxDepth}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setMaxDepth(v)
                      triggerSimulation({ max_depth: v })
                    }}
                    className="rounded-lg border border-white/10 bg-obsidian-900/70 px-2.5 py-1.5 font-mono text-xs text-bone"
                  >
                    {[1, 2, 3, 4, 5].map((d) => (
                      <option key={d} value={d}>
                        Profundidad {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Estructura del Arbol de Decisiones entrenado */}
              <div className="mt-1">
                <p className="mb-2 text-xs font-medium text-graphite-300">
                  Reglas internas aprendidas por el Arbol de Decisiones (`modelo.fit(X_entrenamiento, y_entrenamiento)`):
                </p>
                <TreeDiagram node={p03.tree} />
              </div>
            </div>

            {/* Simulador de Caso Nuevo + Matriz de Confusion 2x2 y Reporte F1 */}
            <div className="flex flex-col gap-4">
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="hud-label flex items-center gap-1.5 text-aura-400">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Probar un Postulante Nuevo (`predict` individual)
                  </span>
                  <AuraBadge tone="neutral">No pertenece a la tabla</AuraBadge>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.68rem] text-graphite-400">
                      Horas estudio: <strong className="text-bone">{horas}h</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={horas}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setHoras(v)
                        triggerSimulation({ horas_estudio: v })
                      }}
                      className="accent-aura-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.68rem] text-graphite-400">
                      Asistencia: <strong className="text-bone">{asistencia}%</strong>
                    </label>
                    <input
                      type="range"
                      min={40}
                      max={100}
                      step={5}
                      value={asistencia}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setAsistencia(v)
                        triggerSimulation({ asistencia: v })
                      }}
                      className="accent-aura-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.68rem] text-graphite-400">
                      Actividades: <strong className="text-bone">{actividades}%</strong>
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={actividades}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setActividades(v)
                        triggerSimulation({ actividades_entregadas: v })
                      }}
                      className="accent-aura-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[0.68rem] uppercase text-graphite-400">
                      Resultado con Reglas Fijas
                    </p>
                    <p className="mt-1 font-display text-sm font-semibold text-bone">
                      {p03.new_case.rule_label}
                    </p>
                    <p className="mt-0.5 font-mono text-[0.68rem] text-graphite-400">
                      Clase predicha: {p03.new_case.rule_prediction}
                    </p>
                  </div>
                  <div className="rounded-xl border border-aura-500/35 bg-aura-500/10 p-3">
                    <p className="text-[0.68rem] uppercase text-aura-300">
                      Resultado con Machine Learning
                    </p>
                    <p className="mt-1 font-display text-sm font-semibold text-bone">
                      {p03.new_case.ml_label}
                    </p>
                    <p className="mt-0.5 font-mono text-[0.68rem] text-aura-300">
                      Traza: {p03.new_case.ml_decision_trace.join(' -> ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Matriz de Confusion 2x2 y Reporte de Clasificacion */}
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="hud-label flex items-center gap-1.5 text-aura-400">
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    Matriz de Confusion (`[[VN, FP], [FN, VP]]`) y Reporte F1
                  </span>
                  <AuraInfoBubble
                    title="Como leer la Matriz de Confusion y el Reporte"
                    explanation="Filas = resultados reales; Columnas = resultados predichos por el modelo en el 30% de prueba. Precision indica cuantos predichos positivos eran reales; Recall indica cuantos positivos reales detecto; F1 combina ambos."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-center font-mono text-xs">
                  <div className="rounded-xl border border-success/30 bg-success/10 p-2.5">
                    <p className="text-[0.65rem] text-graphite-300">Verdaderos Negativos (VN)</p>
                    <p className="text-lg font-bold text-bone">
                      {p03.metrics_ml.confusion_matrix[0][0]}
                    </p>
                  </div>
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-2.5">
                    <p className="text-[0.65rem] text-graphite-300">Falsos Positivos (FP)</p>
                    <p className="text-lg font-bold text-warning">
                      {p03.metrics_ml.confusion_matrix[0][1]}
                    </p>
                  </div>
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-2.5">
                    <p className="text-[0.65rem] text-graphite-300">Falsos Negativos (FN)</p>
                    <p className="text-lg font-bold text-warning">
                      {p03.metrics_ml.confusion_matrix[1][0]}
                    </p>
                  </div>
                  <div className="rounded-xl border border-success/30 bg-success/10 p-2.5">
                    <p className="text-[0.65rem] text-graphite-300">Verdaderos Positivos (VP)</p>
                    <p className="text-lg font-bold text-success">
                      {p03.metrics_ml.confusion_matrix[1][1]}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                        <th className="py-1 pr-2">Clase</th>
                        <th className="py-1 pr-2 text-right">Precision</th>
                        <th className="py-1 pr-2 text-right">Recall</th>
                        <th className="py-1 pr-2 text-right">F1-Score</th>
                        <th className="py-1 text-right">Support</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {p03.metrics_ml.report.map((row) => (
                        <tr key={row.class_id}>
                          <td className="py-1.5 pr-2 font-sans font-medium text-bone">
                            {row.label}
                          </td>
                          <td className="py-1.5 pr-2 text-right text-aura-300">{row.precision}</td>
                          <td className="py-1.5 pr-2 text-right text-aura-300">{row.recall}</td>
                          <td className="py-1.5 pr-2 text-right font-semibold text-bone">
                            {row.f1_score}
                          </td>
                          <td className="py-1.5 text-right text-graphite-300">{row.support}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla Comparativa del Conjunto de Prueba (30% = 9 casos) */}
          <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="hud-label flex items-center gap-1.5 text-aura-400">
                <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Comparacion de Predicciones en el Conjunto de Prueba (`X_prueba` · {p03.test_count} registros)
              </span>
              <span className="text-xs text-graphite-400">
                Punto clave: `fit()` entrena; `predict()` predice casos no usados en entrenamiento.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                    <th className="py-1.5 pr-2">ID</th>
                    <th className="py-1.5 pr-2 text-right">Horas</th>
                    <th className="py-1.5 pr-2 text-right">Asistencia</th>
                    <th className="py-1.5 pr-2 text-right">Actividades</th>
                    <th className="py-1.5 pr-2 text-center">Resultado Real</th>
                    <th className="py-1.5 pr-2 text-center">Prediccion Reglas</th>
                    <th className="py-1.5 pr-2 text-center">Prediccion ML</th>
                    <th className="py-1.5">Traza del Arbol ML</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {p03.comparison_table.map((row) => (
                    <tr key={row.id}>
                      <td className="py-1.5 pr-2 text-aura-400">#{row.id}</td>
                      <td className="py-1.5 pr-2 text-right text-bone">{row.horas_estudio}h</td>
                      <td className="py-1.5 pr-2 text-right text-bone">{row.asistencia}%</td>
                      <td className="py-1.5 pr-2 text-right text-bone">
                        {row.actividades_entregadas}%
                      </td>
                      <td className="py-1.5 pr-2 text-center">
                        <AuraBadge tone={row.resultado_real === 1 ? 'success' : 'neutral'}>
                          {row.resultado_real}
                        </AuraBadge>
                      </td>
                      <td className="py-1.5 pr-2 text-center">
                        <AuraBadge tone={row.coincide_reglas ? 'success' : 'warning'}>
                          {row.prediccion_reglas} {row.coincide_reglas ? '(OK)' : '(Fallo)'}
                        </AuraBadge>
                      </td>
                      <td className="py-1.5 pr-2 text-center">
                        <AuraBadge tone={row.coincide_ml ? 'success' : 'warning'}>
                          {row.prediccion_ml} {row.coincide_ml ? '(OK)' : '(Fallo)'}
                        </AuraBadge>
                      </td>
                      <td className="py-1.5 font-sans text-[0.7rem] text-graphite-300">
                        {row.traza_ml.join(' -> ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="grid gap-2 border-t border-white/10 pt-3 text-xs text-graphite-300 md:grid-cols-2">
              {p03.conclusions.map((c, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-aura-400" aria-hidden="true" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 4: ENTRENAMIENTO (60%), VALIDACION (20%), PRUEBA (20%) Y SOBREAJUSTE (PRACTICA 04)
         ===================================================================== */}
      {activeTab === 'p04_overfitting' && (
        <div className="flex flex-col gap-5">
          {/* KPIs de la division 60% / 20% / 20% y seleccion del mejor modelo */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Entrenamiento (`60%`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-aura-300">
                {p04.split_counts.train} registros
              </p>
              <p className="text-[0.68rem] text-graphite-400">Para aprender patrones (`fit`)</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Validacion (`20%`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-sky-300">
                {p04.split_counts.validation} registros
              </p>
              <p className="text-[0.68rem] text-graphite-400">Elegir mejor profundidad</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Prueba (`20%`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-bone">
                {p04.split_counts.test} registros
              </p>
              <p className="text-[0.68rem] text-graphite-400">Evaluacion final sin tocar</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Mejor Profundidad</p>
              <p className="mt-1 font-mono text-base font-semibold text-success">
                max_depth = {p04.selected_depth}
              </p>
              <p className="text-[0.68rem] text-graphite-400">
                Validacion: {p04.selected_validation_pct}%
              </p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Validacion Cruzada (`cv=5`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-aura-300">
                {p04.cross_validation.mean_pct}% ± {p04.cross_validation.std_pct}%
              </p>
              <p className="text-[0.68rem] text-graphite-400">5 particiones en entrenamiento</p>
            </div>
          </div>

          {/* Grafica SVG Entrenamiento vs Validacion por profundidad del arbol */}
          <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-aura-400" aria-hidden="true" />
                <h4 className="hud-label text-aura-400">
                  Curva de Rendimiento: Entrenamiento vs Validacion (`profundidades = [1, 2, 3, 5, 10, Sin limite]`)
                </h4>
                <AuraInfoBubble
                  title="Subajuste vs Buen Ajuste vs Sobreajuste (Overfitting)"
                  explanation="Un modelo que obtiene 100% en entrenamiento (como profundidad 10 o Sin limite) memoriza el ruido de los ejemplos conocidos pero pierde capacidad de generalizar en datos nuevos. El mejor modelo es el que maximiza la exactitud en Validacion sin abrir una brecha excesiva."
                  benefit="Te permite elegir cientificamente la complejidad optima del arbol antes de tocar el conjunto de prueba."
                />
              </div>
              <AuraButton
                size="sm"
                variant="neo"
                icon={Download}
                onClick={() => {
                  downloadCsvFile('comparacion_modelos_p04.csv', p04.comparison_csv)
                  toast.success('Archivo comparacion_modelos_p04.csv descargado.')
                }}
              >
                Descargar CSV (`comparacion_modelos.csv`)
              </AuraButton>
            </div>

            <OverfittingCurveChart
              rows={p04.depth_comparison}
              selectedDepth={p04.selected_depth}
            />
          </div>

          {/* Tabla de Analisis de Ajuste + Validacion Cruzada 5-Fold y Matriz de Confusion Final */}
          <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
            <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
              <span className="hud-label flex items-center gap-1.5 text-aura-400">
                <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Tabla de Comparacion de Profundidades y Diagnostico de Ajuste
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                      <th className="py-1.5 pr-2">Profundidad</th>
                      <th className="py-1.5 pr-2 text-right">Entrenamiento</th>
                      <th className="py-1.5 pr-2 text-right">Validacion</th>
                      <th className="py-1.5 pr-2 text-right">Diferencia</th>
                      <th className="py-1.5">Diagnostico de Ajuste</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {p04.depth_comparison.map((row) => {
                      const isBest = row.profundidad === p04.selected_depth
                      return (
                        <tr
                          key={row.profundidad}
                          className={cn(isBest && 'bg-emerald-500/10')}
                        >
                          <td className="py-2 pr-2 font-sans font-semibold text-bone">
                            {row.profundidad} {isBest && '(Seleccionado)'}
                          </td>
                          <td className="py-2 pr-2 text-right text-aura-300">
                            {row.entrenamiento_pct}%
                          </td>
                          <td className="py-2 pr-2 text-right text-sky-300">
                            {row.validacion_pct}%
                          </td>
                          <td className="py-2 pr-2 text-right text-graphite-300">
                            {row.diferencia_pct > 0 ? `+${row.diferencia_pct}%` : `${row.diferencia_pct}%`}
                          </td>
                          <td className="py-2 font-sans">
                            <AuraBadge
                              tone={
                                row.tone === 'success'
                                  ? 'success'
                                  : row.tone === 'danger'
                                    ? 'danger'
                                    : 'warning'
                              }
                            >
                              {row.diagnostico}
                            </AuraBadge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="neo-inset flex flex-col justify-between gap-4 rounded-2xl p-4">
              <div>
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Evaluacion Final en Conjunto de Prueba (`20%`) y Validacion Cruzada (`cv=5`)
                </span>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center font-mono text-xs">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
                    <p className="text-[10px] text-graphite-400">Exactitud</p>
                    <p className="mt-0.5 text-sm font-bold text-bone">
                      {p04.final_test_metrics.accuracy_pct}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
                    <p className="text-[10px] text-graphite-400">Precision</p>
                    <p className="mt-0.5 text-sm font-bold text-sky-300">
                      {p04.final_test_metrics.precision_pct}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
                    <p className="text-[10px] text-graphite-400">Recall</p>
                    <p className="mt-0.5 text-sm font-bold text-aura-300">
                      {p04.final_test_metrics.recall_pct}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2">
                    <p className="text-[10px] text-emerald-300">F1-Score</p>
                    <p className="mt-0.5 text-sm font-bold text-emerald-400">
                      {p04.final_test_metrics.f1_pct}%
                    </p>
                  </div>
                </div>
              </div>

              {/* 5 Particiones de Validacion Cruzada */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-bone">
                    Estabilidad en 5 Particiones (`cross_val_score cv=5`):
                  </span>
                  <span className="font-mono text-aura-300">
                    Media: {p04.cross_validation.mean_pct}% · Std: {p04.cross_validation.std_pct}%
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-5 gap-2">
                  {p04.cross_validation.folds.map((score, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-aura-500/25 bg-aura-500/10 p-2 text-center font-mono text-xs"
                    >
                      <p className="text-[10px] text-graphite-400">Fold #{i + 1}</p>
                      <p className="font-bold text-bone">{score}%</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matriz de Confusion de Prueba */}
              <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs">
                <div className="rounded-xl border border-success/30 bg-success/10 p-2">
                  <p className="text-[10px] text-graphite-300">Verdaderos Negativos (VN)</p>
                  <p className="text-base font-bold text-bone">
                    {p04.final_test_metrics.confusion_matrix[0][0]}
                  </p>
                </div>
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-2">
                  <p className="text-[10px] text-graphite-300">Falsos Positivos (FP)</p>
                  <p className="text-base font-bold text-warning">
                    {p04.final_test_metrics.confusion_matrix[0][1]}
                  </p>
                </div>
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-2">
                  <p className="text-[10px] text-graphite-300">Falsos Negativos (FN)</p>
                  <p className="text-base font-bold text-warning">
                    {p04.final_test_metrics.confusion_matrix[1][0]}
                  </p>
                </div>
                <div className="rounded-xl border border-success/30 bg-success/10 p-2">
                  <p className="text-[10px] text-graphite-300">Verdaderos Positivos (VP)</p>
                  <p className="text-base font-bold text-success">
                    {p04.final_test_metrics.confusion_matrix[1][1]}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 5: COMPARACION DECISION TREE vs RANDOM FOREST vs KNN (PRACTICA 05)
         ===================================================================== */}
      {activeTab === 'p05_algorithms' && (
        <div className="flex flex-col gap-5">
          {/* KPIs del Torneo de los 3 Algoritmos Supervisados */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Algoritmo Seleccionado</p>
              <p className="mt-1 font-display text-base font-bold text-success">
                {p05.selected_algorithm}
              </p>
              <p className="text-[0.68rem] text-graphite-400">Mayor F1 en Validacion</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">F1-Score Validacion (`20%`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-aura-300">
                {p05.selected_validation_f1_pct}%
              </p>
              <p className="text-[0.68rem] text-graphite-400">Criterio de seleccion</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Reentrenamiento (`80%`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-bone">
                {p05.retrained_samples} registros
              </p>
              <p className="text-[0.68rem] text-graphite-400">Entrenamiento + Validacion</p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">F1 Final en Prueba (`20%`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-success">
                {p05.final_test_metrics.f1_pct}%
              </p>
              <p className="text-[0.68rem] text-graphite-400">
                Exactitud: {p05.final_test_metrics.accuracy_pct}%
              </p>
            </div>
            <div className="neo-inset rounded-xl p-3">
              <p className="text-[0.68rem] text-graphite-400">Validacion Cruzada F1 (`cv=5`)</p>
              <p className="mt-1 font-mono text-base font-semibold text-sky-300">
                {p05.cross_validation_f1.mean_pct}% ± {p05.cross_validation_f1.std_pct}%
              </p>
              <p className="text-[0.68rem] text-graphite-400">5 particiones sobre el 80%</p>
            </div>
          </div>

          {/* Controles de los 3 Experimentos Interactivos (Experimentos A, B y C de Practica 05) */}
          <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-aura-400" aria-hidden="true" />
                <h4 className="hud-label text-aura-400">
                  Experimentos de Hiperparametros en Vivo (Experimentos A, B y C)
                </h4>
                <AuraInfoBubble
                  title="Los 3 Algoritmos Comparados"
                  explanation="1) Decision Tree construye reglas jerarquicas; 2) Random Forest combina multiples arboles independientes mediante votacion; 3) KNN (con Pipeline StandardScaler) normaliza las 4 variables a media 0 y desviacion 1 usando solo entrenamiento y consulta los K vecinos mas cercanos ponderados por distancia."
                  benefit="Cambia los hiperparametros abajo para comprobar como responde cada algoritmo y cual logra el mayor F1-Score."
                />
              </div>
              <AuraButton
                size="sm"
                variant="neo"
                icon={Download}
                onClick={() => {
                  downloadCsvFile('p05_resultados_comparacion.csv', p05.comparison_csv)
                  toast.success('Archivo p05_resultados_comparacion.csv descargado.')
                }}
              >
                Descargar CSV (`p05_resultados_comparacion.csv`)
              </AuraButton>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {/* Experimento A: KNN n_neighbors */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs font-semibold text-bone">
                  Experimento A — KNN (`n_neighbors`)
                </p>
                <p className="mt-0.5 text-[11px] text-graphite-400">
                  Pipeline `StandardScaler` + `weights="distance"`
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[3, 5, 7, 9, 15].map((k) => (
                    <AuraButton
                      key={k}
                      size="sm"
                      variant={knnNeighbors === k ? 'primary' : 'ghost'}
                      onClick={() => {
                        setKnnNeighbors(k)
                        triggerSimulation({ knn_neighbors: k })
                      }}
                    >
                      k = {k}
                    </AuraButton>
                  ))}
                </div>
              </div>

              {/* Experimento B: Random Forest n_estimators */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs font-semibold text-bone">
                  Experimento B — Random Forest (`n_estimators`)
                </p>
                <p className="mt-0.5 text-[11px] text-graphite-400">
                  Cantidad de arboles en el bosque (`min_samples_leaf=2`)
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[50, 100, 200, 500].map((est) => (
                    <AuraButton
                      key={est}
                      size="sm"
                      variant={rfEstimators === est ? 'primary' : 'ghost'}
                      onClick={() => {
                        setRfEstimators(est)
                        triggerSimulation({ rf_estimators: est })
                      }}
                    >
                      {est} arboles
                    </AuraButton>
                  ))}
                </div>
              </div>

              {/* Experimento C: Decision Tree max_depth */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs font-semibold text-bone">
                  Experimento C — Decision Tree (`max_depth`)
                </p>
                <p className="mt-0.5 text-[11px] text-graphite-400">
                  Profundidad maxima (`min_samples_leaf=4`)
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { label: '2', val: 2 },
                    { label: '3', val: 3 },
                    { label: '5', val: 5 },
                    { label: '8', val: 8 },
                    { label: 'Sin limite', val: 14 },
                  ].map((d) => (
                    <AuraButton
                      key={d.label}
                      size="sm"
                      variant={dtMaxDepth === d.val ? 'primary' : 'ghost'}
                      onClick={() => {
                        setDtMaxDepth(d.val)
                        triggerSimulation({ dt_max_depth: d.val })
                      }}
                    >
                      {d.label}
                    </AuraButton>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Grafica Comparativa Agrupada de las 4 Metricas por Algoritmo */}
          <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
            <span className="hud-label flex items-center gap-1.5 text-aura-400">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              Grafica Comparativa de Algoritmos de Clasificacion (Exactitud, Precision, Recall y F1-Score)
            </span>
            <AlgorithmsGroupedBarChart
              rows={p05.validation_comparison}
              winner={p05.selected_algorithm}
            />
          </div>

          {/* Tabla Comparativa Ordenada por F1 + Prediccion de Caso Nuevo con los 3 Algoritmos */}
          <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
            <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
              <span className="hud-label flex items-center gap-1.5 text-aura-400">
                <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Tabla Comparativa Ordenada por F1-Score (Conjunto de Validacion)
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                      <th className="py-1.5 pr-2">Algoritmo</th>
                      <th className="py-1.5 pr-2 text-right">Exactitud</th>
                      <th className="py-1.5 pr-2 text-right">Precision</th>
                      <th className="py-1.5 pr-2 text-right">Recall</th>
                      <th className="py-1.5 text-right">F1-Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {p05.validation_comparison.map((row, idx) => (
                      <tr
                        key={row.algoritmo}
                        className={cn(idx === 0 && 'bg-emerald-500/10')}
                      >
                        <td className="py-2 pr-2 font-sans">
                          <div className="flex items-center gap-2 font-semibold text-bone">
                            <span>{row.algoritmo}</span>
                            {idx === 0 && <AuraBadge tone="success">Seleccionado</AuraBadge>}
                          </div>
                          <p className="mt-0.5 text-[11px] text-graphite-400">{row.descripcion}</p>
                        </td>
                        <td className="py-2 pr-2 text-right text-aura-300">
                          {row.exactitud_pct}%
                        </td>
                        <td className="py-2 pr-2 text-right text-sky-300">
                          {row.precision_pct}%
                        </td>
                        <td className="py-2 pr-2 text-right text-purple-300">
                          {row.recall_pct}%
                        </td>
                        <td className="py-2 text-right font-bold text-emerald-400">
                          {row.f1_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Matriz de Confusion del Modelo Ganador Reentrenado (80% -> 20% Prueba) */}
              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs font-semibold text-bone">
                  Matriz de Confusion en Prueba (`20%`) tras Reentrenar `{p05.selected_algorithm}` con el `80%`:
                </p>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center font-mono text-xs">
                  <div className="rounded-lg border border-success/30 bg-success/10 p-2">
                    <p className="text-[10px] text-graphite-300">VN (0-&gt;0)</p>
                    <p className="text-sm font-bold text-bone">
                      {p05.final_test_metrics.confusion_matrix[0][0]}
                    </p>
                  </div>
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-2">
                    <p className="text-[10px] text-graphite-300">FP (0-&gt;1)</p>
                    <p className="text-sm font-bold text-warning">
                      {p05.final_test_metrics.confusion_matrix[0][1]}
                    </p>
                  </div>
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-2">
                    <p className="text-[10px] text-graphite-300">FN (1-&gt;0)</p>
                    <p className="text-sm font-bold text-warning">
                      {p05.final_test_metrics.confusion_matrix[1][0]}
                    </p>
                  </div>
                  <div className="rounded-lg border border-success/30 bg-success/10 p-2">
                    <p className="text-[10px] text-graphite-300">VP (1-&gt;1)</p>
                    <p className="text-sm font-bold text-success">
                      {p05.final_test_metrics.confusion_matrix[1][1]}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Simulador de Postulante Nuevo con las 4 variables evaluado por los 3 algoritmos */}
            <div className="neo-inset flex flex-col justify-between gap-3 rounded-2xl p-4">
              <div>
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Simulador de Postulante en los 3 Algoritmos (4 Variables Predictoras)
                </span>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.68rem] text-graphite-400">
                      Horas estudio: <strong className="text-bone">{horas} h</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={18}
                      value={horas}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setHoras(v)
                        triggerSimulation({ horas_estudio: v })
                      }}
                      className="accent-aura-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.68rem] text-graphite-400">
                      Asistencia: <strong className="text-bone">{asistencia}%</strong>
                    </label>
                    <input
                      type="range"
                      min={40}
                      max={100}
                      step={5}
                      value={asistencia}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setAsistencia(v)
                        triggerSimulation({ asistencia: v })
                      }}
                      className="accent-aura-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.68rem] text-graphite-400">
                      Actividades: <strong className="text-bone">{actividades}%</strong>
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={actividades}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setActividades(v)
                        triggerSimulation({ actividades_entregadas: v })
                      }}
                      className="accent-aura-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.68rem] text-graphite-400">
                      Participacion (0-10): <strong className="text-bone">{participacion}</strong>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={participacion}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setParticipacion(v)
                        triggerSimulation({ participacion: v })
                      }}
                      className="accent-aura-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
                  <span className="font-semibold text-bone">1. Decision Tree</span>
                  <AuraBadge
                    tone={
                      p05.new_case_predictions.decision_tree.prediction === 1
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {p05.new_case_predictions.decision_tree.label}
                  </AuraBadge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
                  <div>
                    <span className="font-semibold text-bone">2. Random Forest</span>
                    <span className="ml-2 font-mono text-[11px] text-graphite-400">
                      ({p05.new_case_predictions.random_forest.vote_confidence_pct}% votos favor)
                    </span>
                  </div>
                  <AuraBadge
                    tone={
                      p05.new_case_predictions.random_forest.prediction === 1
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {p05.new_case_predictions.random_forest.label}
                  </AuraBadge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
                  <div>
                    <span className="font-semibold text-bone">
                      3. KNN (`StandardScaler`, k={knnNeighbors})
                    </span>
                    <span className="ml-2 font-mono text-[11px] text-graphite-400">
                      ({p05.new_case_predictions.knn.distance_confidence_pct}% afinidad vecinal)
                    </span>
                  </div>
                  <AuraBadge
                    tone={
                      p05.new_case_predictions.knn.prediction === 1 ? 'success' : 'warning'
                    }
                  >
                    {p05.new_case_predictions.knn.label}
                  </AuraBadge>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
