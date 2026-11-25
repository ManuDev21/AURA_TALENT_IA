import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  GitBranch,
  Layers,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Scale,
  Sigma,
  Sliders,
  Sparkles,
  Table as TableIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  auraApi,
  type MlAdvancedResponse,
  type MlClusterProfile,
  type MlLabOverviewResponse,
  type MlPractice04DepthRow,
  type MlPractice05AlgoRow,
  type MlTreeNode,
} from '@/api/aura'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraInfoBubble } from '@/components/aura/AuraInfoBubble'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraTalentBigDataViews } from '@/features/career/AuraTalentBigDataViews'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { useDebouncedCallback } from '@/utils/useDebouncedCallback'

type LabTab =
  | 'p01_bfs_vs_rules'
  | 'p02_data_quality'
  | 'p03_ml_vs_rules'
  | 'p04_overfitting'
  | 'p05_algorithms'
  | 'p06_optimization'
  | 'p07_kmeans'
  | 'p08_stability'
  | 'p09_pca'
  | 'p10_dossier'
  | 'p11_spark_100k'
  | 'p12_cnn_1d'

const CLUSTER_COLORS = ['#38bdf8', '#a855f7', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6']

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

// ============================================================================
// GRAFICAS SVG DE LAS PRACTICAS AVANZADAS (06: OPTIMIZACION, 07: K-MEANS,
// 08: ESTABILIDAD Y ATIPICOS, 09: PCA)
// ============================================================================

function ChartFrame({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#070911] p-3">
      <svg viewBox="0 0 680 260" className="h-auto w-full min-w-[430px]" role="img" aria-label={label}>
        {children}
      </svg>
    </div>
  )
}

function GridVsRandomChart({
  comparacion,
  winner,
}: {
  comparacion: MlAdvancedResponse['practice_06']['comparacion']
  winner: string
}) {
  const padL = 48
  const innerW = 680 - padL - 24
  const innerH = 260 - 30 - 48
  const groupW = innerW / Math.max(1, comparacion.length)
  const barW = 34
  const series = [
    { key: 'gridsearch_f1_pct' as const, label: 'GridSearchCV', color: '#38bdf8' },
    { key: 'randomizedsearch_f1_pct' as const, label: 'RandomizedSearchCV (n_iter=20)', color: '#a855f7' },
  ]
  return (
    <ChartFrame label="Barras agrupadas del mejor F1 en validacion cruzada por metodo de optimizacion">
      {[0, 25, 50, 75, 100].map((t) => {
        const y = 30 + innerH - (t / 100) * innerH
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={656} y2={y} stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">
              {t}%
            </text>
          </g>
        )
      })}
      {comparacion.map((row, gi) => {
        const cx = padL + gi * groupW + groupW / 2
        const isWin = row.algoritmo === winner
        return (
          <g key={row.algoritmo}>
            {isWin && (
              <rect x={cx - barW - 14} y={22} width={barW * 2 + 40} height={innerH + 14} rx={10} fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.4)" strokeDasharray="4 3" />
            )}
            {series.map((s, si) => {
              const val = row[s.key]
              const h = Math.max(4, (val / 100) * innerH)
              const x = cx - barW - 4 + si * (barW + 8)
              return (
                <g key={s.key}>
                  <rect x={x} y={30 + innerH - h} width={barW} height={h} rx={4} fill={s.color} />
                  <text x={x + barW / 2} y={30 + innerH - h - 5} textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="monospace" fontWeight="bold">
                    {Math.round(val)}%
                  </text>
                </g>
              )
            })}
            <text x={cx} y={250} textAnchor="middle" fill={isWin ? '#10b981' : '#f8fafc'} fontSize="11" fontWeight="bold">
              {row.algoritmo}
            </text>
          </g>
        )
      })}
      {series.map((s, i) => (
        <g key={s.key}>
          <rect x={380 + i * 150} y={6} width={9} height={9} rx={2} fill={s.color} />
          <text x={392 + i * 150} y={14} fill="#cbd5e1" fontSize="9">{s.label}</text>
        </g>
      ))}
    </ChartFrame>
  )
}

function ElbowChart({ elbow, kFinal }: { elbow: Array<{ k: number; inercia: number }>; kFinal: number }) {
  const padL = 62
  const innerW = 680 - padL - 30
  const innerH = 260 - 34 - 40
  const maxI = Math.max(...elbow.map((e) => e.inercia))
  const minI = Math.min(...elbow.map((e) => e.inercia))
  const xFor = (i: number) => padL + (i / Math.max(1, elbow.length - 1)) * innerW
  const yFor = (v: number) => 30 + innerH - ((v - minI) / Math.max(1, maxI - minI)) * innerH
  const pts = elbow.map((e, i) => `${xFor(i)},${yFor(e.inercia)}`).join(' ')
  return (
    <ChartFrame label="Metodo del codo: inercia WCSS frente a cantidad de grupos K">
      {elbow.map((e, i) => {
        const x = xFor(i)
        const y = yFor(e.inercia)
        const sel = e.k === kFinal
        return (
          <g key={e.k}>
            <line x1={x} y1={30} x2={x} y2={30 + innerH} stroke="rgba(148,163,184,0.08)" />
            <text x={x} y={248} textAnchor="middle" fill={sel ? '#10b981' : '#94a3b8'} fontSize="11" fontWeight={sel ? 'bold' : 'normal'}>
              K={e.k}
            </text>
            {sel && <rect x={x - 18} y={26} width={36} height={innerH + 6} rx={8} fill="rgba(16,185,129,0.08)" />}
            <circle cx={x} cy={y} r={sel ? 6 : 4} fill={sel ? '#10b981' : '#38bdf8'} stroke="#070911" strokeWidth={2} />
            <text x={x} y={y - 10} textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="monospace">
              {Math.round(e.inercia)}
            </text>
          </g>
        )
      })}
      <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth={2.5} strokeLinejoin="round" />
      <text x={padL - 10} y={24} textAnchor="start" fill="#94a3b8" fontSize="10" fontFamily="monospace">
        Inercia (WCSS)
      </text>
    </ChartFrame>
  )
}

function SilhouetteBars({ rows, kFinal }: { rows: Array<{ k: number; silhouette: number }>; kFinal: number }) {
  const padL = 48
  const innerW = 680 - padL - 30
  const innerH = 260 - 34 - 40
  const maxS = Math.max(...rows.map((r) => r.silhouette), 0.1)
  const best = rows.reduce((a, b) => (b.silhouette > a.silhouette ? b : a))
  const barW = innerW / rows.length - 14
  return (
    <ChartFrame label="Silhouette Score por cantidad de grupos K: cohesion y separacion">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = 30 + innerH - (t / maxS) * innerH * 0.92
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={650} y2={y} stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">
              {t.toFixed(2)}
            </text>
          </g>
        )
      })}
      {rows.map((r, i) => {
        const x = padL + i * (innerW / rows.length) + 7
        const h = Math.max(3, (r.silhouette / maxS) * innerH * 0.92)
        const isBest = r.k === best.k
        const isSel = r.k === kFinal
        return (
          <g key={r.k}>
            <rect x={x} y={30 + innerH - h} width={barW} height={h} rx={5} fill={isBest ? '#10b981' : isSel ? '#38bdf8' : 'rgba(56,189,248,0.35)'} />
            <text x={x + barW / 2} y={30 + innerH - h - 5} textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="monospace" fontWeight="bold">
              {r.silhouette.toFixed(3)}
            </text>
            <text x={x + barW / 2} y={248} textAnchor="middle" fill={isSel ? '#10b981' : '#94a3b8'} fontSize="11" fontWeight={isSel ? 'bold' : 'normal'}>
              K={r.k}
            </text>
          </g>
        )
      })}
      <text x={padL} y={14} fill="#94a3b8" fontSize="10">Verde = mejor separacion · Azul marcado = K seleccionado</text>
    </ChartFrame>
  )
}

function ClusterScatter({
  points,
  centroids,
  kFinal,
  xLabel = 'Horas de estudio',
  yLabel = 'Asistencia (%)',
}: {
  points: Array<{ x: number; y: number; cluster: number }>
  centroids: Array<{ x: number; y: number; cluster: number; perfil: string }>
  kFinal: number
  xLabel?: string
  yLabel?: string
}) {
  const padL = 52
  const innerW = 680 - padL - 26
  const innerH = 260 - 30 - 42
  const maxX = Math.max(12, ...points.map((p) => p.x)) * 1.05
  const xFor = (x: number) => padL + (x / maxX) * innerW
  const yFor = (y: number) => 26 + innerH - (Math.min(100, Math.max(0, y)) / 100) * innerH
  return (
    <ChartFrame label={`Dispersion de perfiles por cluster: ${xLabel} vs ${yLabel} con centroides`}>
      {[0, 25, 50, 75, 100].map((t) => {
        const y = yFor(t)
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={654} y2={y} stroke="rgba(148,163,184,0.12)" strokeDasharray="4 4" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">
              {t}%
            </text>
          </g>
        )
      })}
      {points.map((p, i) => (
        <circle key={i} cx={xFor(p.x)} cy={yFor(p.y)} r={3} fill={CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length]} opacity={0.55} />
      ))}
      {centroids.map((c) => {
        const cx = xFor(c.x)
        const cy = yFor(c.y)
        return (
          <g key={c.cluster}>
            <line x1={cx - 9} y1={cy - 9} x2={cx + 9} y2={cy + 9} stroke="#f8fafc" strokeWidth={3.4} />
            <line x1={cx - 9} y1={cy + 9} x2={cx + 9} y2={cy - 9} stroke="#f8fafc" strokeWidth={3.4} />
            <line x1={cx - 9} y1={cy - 9} x2={cx + 9} y2={cy + 9} stroke={CLUSTER_COLORS[c.cluster % CLUSTER_COLORS.length]} strokeWidth={2} />
            <line x1={cx - 9} y1={cy + 9} x2={cx + 9} y2={cy - 9} stroke={CLUSTER_COLORS[c.cluster % CLUSTER_COLORS.length]} strokeWidth={2} />
            <text x={cx + 12} y={cy - 10} fill="#f8fafc" fontSize="10" fontWeight="bold">
              {c.perfil}
            </text>
          </g>
        )
      })}
      <text x={680 / 2} y={256} textAnchor="middle" fill="#94a3b8" fontSize="10">
        {xLabel} (X) · {yLabel} (Y) · X = Centroide · {kFinal} grupos
      </text>
    </ChartFrame>
  )
}

function AriMatrix({ semillas, matriz }: { semillas: number[]; matriz: number[][] }) {
  const padL = 60
  const cell = Math.min(30, (620 - padL) / semillas.length)
  return (
    <ChartFrame label="Matriz de estabilidad ARI entre ejecuciones con distintas semillas">
      {semillas.map((s, i) => (
        <g key={`x${s}`}>
          <text x={padL + i * cell + cell / 2} y={44} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
            {s}
          </text>
          <text x={padL - 8} y={52 + i * cell + cell / 2 + 3} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">
            {s}
          </text>
        </g>
      ))}
      {matriz.map((row, i) =>
        row.map((v, j) => {
          const col = `rgba(${Math.round(56 + (16 - 56) * (1 - v))},${Math.round(189 - 100 * (1 - v))},${Math.round(248 - 120 * (1 - v))},${0.25 + v * 0.7})`
          return (
            <g key={`${i}-${j}`}>
              <rect x={padL + j * cell} y={48 + i * cell} width={cell - 2} height={cell - 2} rx={4} fill={i === j ? 'rgba(16,185,129,0.5)' : col} />
              <text x={padL + j * cell + cell / 2 - 1} y={48 + i * cell + cell / 2 + 3} textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="monospace">
                {v.toFixed(2)}
              </text>
            </g>
          )
        }),
      )}
      <text x={padL} y={20} fill="#94a3b8" fontSize="10">
        ARI: 1.00 = particiones identicas · 0 = coincidencia al azar (semillas en ejes)
      </text>
    </ChartFrame>
  )
}

function DistanceScatter({
  distancias,
  umbral,
}: {
  distancias: Array<{ id: string; cluster: number; distancia: number; atipico: boolean }>
  umbral: number
}) {
  const padL = 48
  const innerW = 680 - padL - 26
  const innerH = 260 - 32 - 40
  const maxD = Math.max(umbral * 1.15, ...distancias.map((d) => d.distancia))
  const xFor = (i: number) => padL + (i / Math.max(1, distancias.length - 1)) * innerW
  const yFor = (d: number) => 28 + innerH - (d / maxD) * innerH
  const uy = yFor(umbral)
  return (
    <ChartFrame label="Distancia euclidiana de cada registro al centroide de su cluster con umbral percentil 95">
      <line x1={padL} y1={uy} x2={654} y2={uy} stroke="#f43f5e" strokeWidth={1.6} strokeDasharray="6 4" />
      <text x={654} y={uy - 6} textAnchor="end" fill="#f43f5e" fontSize="10" fontWeight="bold">
        Umbral P95 = {umbral.toFixed(3)}
      </text>
      {distancias.map((d, i) => (
        <circle key={d.id} cx={xFor(i)} cy={yFor(d.distancia)} r={d.atipico ? 4 : 2.2} fill={d.atipico ? '#f43f5e' : CLUSTER_COLORS[d.cluster % CLUSTER_COLORS.length]} opacity={d.atipico ? 0.95 : 0.45} />
      ))}
      <text x={padL - 10} y={20} textAnchor="start" fill="#94a3b8" fontSize="10" fontFamily="monospace">
        Distancia al centroide
      </text>
      <text x={340} y={256} textAnchor="middle" fill="#94a3b8" fontSize="10">
        Registros ordenados por indice (rojo = posible caso atipico para revision humana)
      </text>
    </ChartFrame>
  )
}

function ScreeChart({
  table,
  objetivoPct,
}: {
  table: Array<{ componente: string; varianza_pct: number; acumulada_pct: number }>
  objetivoPct: number
}) {
  const padL = 48
  const innerW = 680 - padL - 30
  const innerH = 260 - 34 - 42
  const barW = innerW / table.length - 44
  const xFor = (i: number) => padL + i * (innerW / table.length) + 22
  const yFor = (v: number) => 30 + innerH - (v / 100) * innerH
  const linePts = table.map((r, i) => `${xFor(i) + barW / 2},${yFor(r.acumulada_pct)}`).join(' ')
  const oy = yFor(objetivoPct)
  return (
    <ChartFrame label="Sedimentacion PCA: varianza explicada por componente y varianza acumulada">
      {[0, 25, 50, 75, 100].map((t) => {
        const y = yFor(t)
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={650} y2={y} stroke="rgba(148,163,184,0.14)" strokeDasharray="4 4" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">
              {t}%
            </text>
          </g>
        )
      })}
      <line x1={padL} y1={oy} x2={650} y2={oy} stroke="#f59e0b" strokeWidth={1.4} strokeDasharray="6 4" />
      <text x={648} y={oy - 6} textAnchor="end" fill="#f59e0b" fontSize="10" fontWeight="bold">
        Objetivo {objetivoPct}%
      </text>
      {table.map((r, i) => {
        const h = Math.max(3, (r.varianza_pct / 100) * innerH)
        return (
          <g key={r.componente}>
            <rect x={xFor(i)} y={30 + innerH - h} width={barW} height={h} rx={5} fill="#38bdf8" opacity={0.85} />
            <text x={xFor(i) + barW / 2} y={30 + innerH - h - 5} textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="monospace" fontWeight="bold">
              {r.varianza_pct}%
            </text>
            <text x={xFor(i) + barW / 2} y={250} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold">
              {r.componente}
            </text>
          </g>
        )
      })}
      <polyline points={linePts} fill="none" stroke="#10b981" strokeWidth={2.4} strokeLinejoin="round" />
      {table.map((r, i) => (
        <g key={`p${r.componente}`}>
          <circle cx={xFor(i) + barW / 2} cy={yFor(r.acumulada_pct)} r={4.5} fill="#10b981" stroke="#070911" strokeWidth={2} />
          <text x={xFor(i) + barW / 2} y={yFor(r.acumulada_pct) - 9} textAnchor="middle" fill="#10b981" fontSize="9" fontFamily="monospace" fontWeight="bold">
            {r.acumulada_pct}%
          </text>
        </g>
      ))}
      <text x={padL} y={14} fill="#94a3b8" fontSize="10">
        Barras = varianza por componente · Linea verde = varianza acumulada
      </text>
    </ChartFrame>
  )
}

function LoadingsHeatmap({
  loadings,
  variables,
}: {
  loadings: MlAdvancedResponse['practice_09']['loadings']
  variables: string[]
}) {
  const padL = 70
  const cellW = (640 - padL) / variables.length
  const cellH = 40
  const varLabels: Record<string, string> = {
    horas_estudio: 'Horas estudio',
    asistencia: 'Asistencia',
    actividades: 'Actividades',
    participacion: 'Participacion',
  }
  const colorFor = (v: number) => {
    const a = Math.min(1, Math.abs(v))
    return v >= 0 ? `rgba(56,189,248,${0.15 + a * 0.75})` : `rgba(244,63,94,${0.15 + a * 0.75})`
  }
  return (
    <ChartFrame label="Mapa de calor de cargas PCA: contribucion de cada variable a cada componente">
      {variables.map((v, j) => (
        <text key={v} x={padL + j * cellW + cellW / 2} y={44} textAnchor="middle" fill="#94a3b8" fontSize="10">
          {varLabels[v] ?? v}
        </text>
      ))}
      {loadings.map((row, i) => (
        <g key={row.componente}>
          <text x={padL - 8} y={52 + i * cellH + cellH / 2 + 3} textAnchor="end" fill="#f8fafc" fontSize="11" fontWeight="bold">
            {row.componente}
          </text>
          {variables.map((v, j) => {
            const val = Number(row[v as keyof typeof row] ?? 0)
            return (
              <g key={v}>
                <rect x={padL + j * cellW} y={50 + i * cellH} width={cellW - 3} height={cellH - 3} rx={6} fill={colorFor(val)} />
                <text x={padL + j * cellW + cellW / 2} y={50 + i * cellH + cellH / 2 + 4} textAnchor="middle" fill="#f8fafc" fontSize="10" fontFamily="monospace">
                  {val.toFixed(2)}
                </text>
              </g>
            )
          })}
        </g>
      ))}
      <text x={padL} y={52 + loadings.length * cellH + 18} fill="#94a3b8" fontSize="10">
        Azul = contribucion positiva · Rojo = contribucion negativa (rango -1 a 1)
      </text>
    </ChartFrame>
  )
}

function PcaScatter({
  points,
  perfiles,
}: {
  points: Array<{ x: number; y: number; cluster: number }>
  perfiles: MlClusterProfile[]
}) {
  const padL = 56
  const innerW = 680 - padL - 30
  const innerH = 260 - 32 - 42
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const xFor = (x: number) => padL + ((x - minX) / Math.max(1e-6, maxX - minX)) * innerW
  const yFor = (y: number) => 28 + innerH - ((y - minY) / Math.max(1e-6, maxY - minY)) * innerH
  return (
    <ChartFrame label="Proyeccion PCA en 2D de los perfiles coloreada por segmento K-Means">
      {points.map((p, i) => (
        <circle key={i} cx={xFor(p.x)} cy={yFor(p.y)} r={3} fill={CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length]} opacity={0.6} />
      ))}
      {perfiles.map((pf, i) => (
        <g key={pf.cluster}>
          <rect x={padL + i * 190} y={248 - 6} width={9} height={9} rx={2} fill={CLUSTER_COLORS[pf.cluster % CLUSTER_COLORS.length]} />
          <text x={padL + i * 190 + 14} y={255} fill="#cbd5e1" fontSize="10">
            {pf.perfil ?? `Cluster ${pf.cluster}`}
          </text>
        </g>
      ))}
      <text x={padL} y={16} fill="#94a3b8" fontSize="10" fontFamily="monospace">
        Eje X = PC1 · Eje Y = PC2 (proyeccion de las 4 variables estandarizadas)
      </text>
    </ChartFrame>
  )
}

function MissingBars({ missing }: { missing: Record<string, number> }) {
  const entries = Object.entries(missing)
  const padL = 120
  const maxV = Math.max(1, ...entries.map(([, v]) => v))
  const rowH = 30
  const labels: Record<string, string> = {
    horas_estudio: 'Horas estudio',
    asistencia: 'Asistencia',
    actividades: 'Actividades',
    participacion: 'Participacion',
  }
  return (
    <ChartFrame label="Valores faltantes detectados por variable antes de la imputacion por mediana">
      {entries.map(([k, v], i) => {
        const w = (v / maxV) * (640 - padL)
        return (
          <g key={k}>
            <text x={padL - 8} y={52 + i * rowH + 14} textAnchor="end" fill="#cbd5e1" fontSize="11">
              {labels[k] ?? k}
            </text>
            <rect x={padL} y={42 + i * rowH} width={Math.max(2, w)} height={18} rx={5} fill={v > 0 ? '#f59e0b' : 'rgba(16,185,129,0.4)'} />
            <text x={padL + Math.max(2, w) + 8} y={55 + i * rowH} fill="#f8fafc" fontSize="11" fontFamily="monospace" fontWeight="bold">
              {v}
            </text>
          </g>
        )
      })}
      <text x={padL} y={52 + entries.length * rowH + 6} fill="#94a3b8" fontSize="10">
        Cada faltante se reemplaza por la mediana de su columna (imputacion auditable)
      </text>
    </ChartFrame>
  )
}

export function CompanyDataMlLab() {
  const [activeTab, setActiveTab] = useState<LabTab>('p11_spark_100k')

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

  // Numero de grupos K configurable para las Practicas 07 y 08 (K-Means)
  const [kmeansK, setKmeansK] = useState(3)

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

  // Laboratorio avanzado (Practicas 06-09): ejecucion bajo demanda por su costo de calculo
  const advMutation = useMutation({
    mutationFn: auraApi.mlLabAdvanced,
  })

  const advancedData: MlAdvancedResponse | undefined = advMutation.data

  const runAdvanced = (k?: number) => {
    const targetK = k ?? kmeansK
    advMutation.mutate(
      {
        kmeans_k: targetK,
        horas_estudio: horas,
        asistencia,
        actividades_entregadas: actividades,
        participacion,
      },
      {
        onError: () => toast.error('No se pudo ejecutar el laboratorio avanzado.'),
      },
    )
  }

  const renderAdvancedGate = (title: string, description: string) => (
    <div className="neo-inset flex flex-col items-center gap-4 rounded-2xl p-8 text-center">
      <div className="rounded-full border border-aura-500/30 bg-aura-500/10 p-4">
        <Layers className="h-7 w-7 text-aura-400" aria-hidden="true" />
      </div>
      <div className="max-w-lg">
        <h4 className="font-display text-base font-bold text-bone">{title}</h4>
        <p className="mt-2 text-sm leading-relaxed text-graphite-300">{description}</p>
      </div>
      {advMutation.isPending ? (
        <div className="flex flex-col items-center gap-2">
          <AuraLoader />
          <p className="text-xs text-graphite-400">
            Ejecutando busqueda de hiperparametros, K-Means, analisis de estabilidad y PCA
            (aproximadamente 20 segundos)...
          </p>
        </div>
      ) : (
        <AuraButton icon={Play} onClick={() => runAdvanced()}>
          Ejecutar laboratorio avanzado (P06-P09)
        </AuraButton>
      )}
      <p className="max-w-md text-[11px] leading-relaxed text-graphite-400">
        Los resultados son estadisticos y orientativos: agrupan perfiles parecidos para apoyar la
        revision humana, nunca para contratar ni rechazar automaticamente.
      </p>
    </div>
  )

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

  // Los deslizadores actualizan el estado al instante pero solo envian la
  // simulacion al servidor cuando el usuario deja de moverlos (debounce).
  const scheduleSimulation = useDebouncedCallback(triggerSimulation, 450)

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
            variant={activeTab === 'p11_spark_100k' ? 'primary' : 'ghost'}
            icon={Database}
            onClick={() => setActiveTab('p11_spark_100k')}
          >
            12. PySpark 100,000 Datos + 3D + Triangulo
          </AuraButton>
          <AuraButton
            size="sm"
            variant={activeTab === 'p12_cnn_1d' ? 'primary' : 'ghost'}
            icon={Activity}
            onClick={() => setActiveTab('p12_cnn_1d')}
          >
            11. CNN 1D Evolucion vs Random Forest
          </AuraButton>
          <AuraButton
            size="sm"
            variant={activeTab === 'p10_dossier' ? 'primary' : 'ghost'}
            icon={FileSpreadsheet}
            onClick={() => setActiveTab('p10_dossier')}
          >
            10. Expediente Integral y Recomendaciones
          </AuraButton>
          <AuraButton
            size="sm"
            variant={activeTab === 'p09_pca' ? 'primary' : 'ghost'}
            icon={Sigma}
            onClick={() => setActiveTab('p09_pca')}
          >
            9. PCA y Varianza
          </AuraButton>
          <AuraButton
            size="sm"
            variant={activeTab === 'p08_stability' ? 'primary' : 'ghost'}
            icon={Radar}
            onClick={() => setActiveTab('p08_stability')}
          >
            8. Estabilidad y Atipicos
          </AuraButton>
          <AuraButton
            size="sm"
            variant={activeTab === 'p07_kmeans' ? 'primary' : 'ghost'}
            icon={Boxes}
            onClick={() => setActiveTab('p07_kmeans')}
          >
            7. K-Means y Limpieza
          </AuraButton>
          <AuraButton
            size="sm"
            variant={activeTab === 'p06_optimization' ? 'primary' : 'ghost'}
            icon={Sliders}
            onClick={() => setActiveTab('p06_optimization')}
          >
            6. Optimizacion de Hiperparametros
          </AuraButton>
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

      {activeTab === 'p11_spark_100k' && <AuraTalentBigDataViews mode="spark_100k" />}
      {activeTab === 'p12_cnn_1d' && <AuraTalentBigDataViews mode="cnn_1d" />}
      {activeTab === 'p10_dossier' && <AuraTalentBigDataViews mode="dossier_integral" />}

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
                      scheduleSimulation({ min_horas_rule: v })
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
                      scheduleSimulation({ min_asistencia_rule: v })
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
                      scheduleSimulation({ min_actividades_rule: v })
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
                      scheduleSimulation({ max_depth: v })
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
                        scheduleSimulation({ horas_estudio: v })
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
                        scheduleSimulation({ asistencia: v })
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
                        scheduleSimulation({ actividades_entregadas: v })
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
                        scheduleSimulation({ knn_neighbors: k })
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
                        scheduleSimulation({ rf_estimators: est })
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
                        scheduleSimulation({ dt_max_depth: d.val })
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
                        scheduleSimulation({ horas_estudio: v })
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
                        scheduleSimulation({ asistencia: v })
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
                        scheduleSimulation({ actividades_entregadas: v })
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
                        scheduleSimulation({ participacion: v })
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

      {/* =====================================================================
          PESTAÑA 6: OPTIMIZACION DE HIPERPARAMETROS (PRACTICA 06)
          GridSearchCV vs RandomizedSearchCV con StratifiedKFold (cv=5) sobre
          los 3 algoritmos; el conjunto de prueba permanece intacto.
         ===================================================================== */}
      {activeTab === 'p06_optimization' &&
        (advancedData ? (
          <div className="flex flex-col gap-5">
            {/* KPIs de la optimizacion */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Mejor Algoritmo</p>
                <p className="mt-1 font-display text-base font-bold text-success">
                  {advancedData.practice_06.mejor_algoritmo}
                </p>
                <p className="text-[0.68rem] text-graphite-400">Mayor F1 en CV</p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Mejor F1 (CV 5-Fold)</p>
                <p className="mt-1 font-mono text-base font-semibold text-aura-300">
                  {advancedData.practice_06.mejor_f1_cv_pct}%
                </p>
                <p className="text-[0.68rem] text-graphite-400">Promedio estratificado</p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Datos de Optimizacion / Prueba</p>
                <p className="mt-1 font-mono text-base font-semibold text-bone">
                  {advancedData.practice_06.split_counts.optimizacion} /{' '}
                  {advancedData.practice_06.split_counts.prueba}
                </p>
                <p className="text-[0.68rem] text-graphite-400">
                  {advancedData.practice_06.split_counts.ratios}
                </p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Combinaciones Grid</p>
                <p className="mt-1 font-mono text-base font-semibold text-sky-300">
                  {advancedData.practice_06.grid_search.reduce(
                    (a, r) => a + (r.combinaciones ?? 0),
                    0,
                  )}
                </p>
                <p className="text-[0.68rem] text-graphite-400">
                  Random:{' '}
                  {advancedData.practice_06.random_search.reduce(
                    (a, r) => a + (r.iteraciones ?? 0),
                    0,
                  )}{' '}
                  iteraciones
                </p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">F1 Final en Prueba</p>
                <p className="mt-1 font-mono text-base font-semibold text-success">
                  {advancedData.practice_06.final_test_metrics.f1_pct}%
                </p>
                <p className="text-[0.68rem] text-graphite-400">
                  Exactitud: {advancedData.practice_06.final_test_metrics.accuracy_pct}%
                </p>
              </div>
            </div>

            {/* Grafica agrupada GridSearch vs RandomizedSearch */}
            <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
              <span className="hud-label flex items-center gap-1.5 text-aura-400">
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                GridSearchCV (exhaustivo) vs RandomizedSearchCV (muestreo) por Algoritmo
                <AuraInfoBubble
                  title="Parametros vs Hiperparametros"
                  explanation="Los parametros los aprende el modelo de los datos (los cortes del arbol); los hiperparametros los fija el equipo antes de entrenar (max_depth, n_neighbors...). GridSearchCV prueba todas las combinaciones del espacio; RandomizedSearchCV muestrea iteraciones al azar, util cuando el espacio es grande."
                  benefit="Ambas busquedas usan la misma validacion cruzada estratificada de 5 particiones con F1-Score como metrica de seleccion, por lo que la comparacion es justa."
                />
              </span>
              <GridVsRandomChart
                comparacion={advancedData.practice_06.comparacion}
                winner={advancedData.practice_06.mejor_algoritmo}
              />
            </div>

            {/* Tablas de mejores hiperparametros por metodo */}
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Mejores Hiperparametros — GridSearchCV
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                        <th className="py-1.5 pr-2">Algoritmo</th>
                        <th className="py-1.5 pr-2 text-right">Combos</th>
                        <th className="py-1.5 pr-2 text-right">Mejor F1</th>
                        <th className="py-1.5">Hiperparametros</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {advancedData.practice_06.grid_search.map((row) => (
                        <tr key={row.algoritmo}>
                          <td className="py-2 pr-2 font-semibold text-bone">{row.algoritmo}</td>
                          <td className="py-2 pr-2 text-right font-mono text-graphite-300">
                            {row.combinaciones}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono text-aura-300">
                            {row.mejor_f1_pct}%
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(row.mejores_hiperparametros).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-sky-300"
                                >
                                  {k}={String(v)}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Mejores Hiperparametros — RandomizedSearchCV
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                        <th className="py-1.5 pr-2">Algoritmo</th>
                        <th className="py-1.5 pr-2 text-right">Iters</th>
                        <th className="py-1.5 pr-2 text-right">Mejor F1</th>
                        <th className="py-1.5">Hiperparametros</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {advancedData.practice_06.random_search.map((row) => (
                        <tr key={row.algoritmo}>
                          <td className="py-2 pr-2 font-semibold text-bone">{row.algoritmo}</td>
                          <td className="py-2 pr-2 text-right font-mono text-graphite-300">
                            {row.iteraciones}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono text-aura-300">
                            {row.mejor_f1_pct}%
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(row.mejores_hiperparametros).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-purple-300"
                                >
                                  {k}={String(v)}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Evaluacion final del ganador + notas metodologicas */}
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Evaluacion Final sobre el Conjunto de Prueba (intacto)
                </span>
                <p className="text-xs text-graphite-300">
                  El ganador{' '}
                  <strong className="text-bone">{advancedData.practice_06.mejor_algoritmo}</strong>{' '}
                  se reentreno con todos los datos de optimizacion y se evaluo una sola vez contra
                  el conjunto de prueba reservado.
                </p>
                <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
                  <div className="rounded-lg border border-aura-500/30 bg-aura-500/10 p-2">
                    <p className="text-[10px] text-graphite-300">Exactitud</p>
                    <p className="text-sm font-bold text-bone">
                      {advancedData.practice_06.final_test_metrics.accuracy_pct}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2">
                    <p className="text-[10px] text-graphite-300">Precision</p>
                    <p className="text-sm font-bold text-sky-300">
                      {advancedData.practice_06.final_test_metrics.precision_pct}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-2">
                    <p className="text-[10px] text-graphite-300">Recall</p>
                    <p className="text-sm font-bold text-purple-300">
                      {advancedData.practice_06.final_test_metrics.recall_pct}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-success/30 bg-success/10 p-2">
                    <p className="text-[10px] text-graphite-300">F1-Score</p>
                    <p className="text-sm font-bold text-success">
                      {advancedData.practice_06.final_test_metrics.f1_pct}%
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
                  <div className="rounded-lg border border-success/30 bg-success/10 p-2">
                    <p className="text-[10px] text-graphite-300">VN (0-&gt;0)</p>
                    <p className="text-sm font-bold text-bone">
                      {advancedData.practice_06.final_test_metrics.confusion_matrix[0][0]}
                    </p>
                  </div>
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-2">
                    <p className="text-[10px] text-graphite-300">FP (0-&gt;1)</p>
                    <p className="text-sm font-bold text-warning">
                      {advancedData.practice_06.final_test_metrics.confusion_matrix[0][1]}
                    </p>
                  </div>
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-2">
                    <p className="text-[10px] text-graphite-300">FN (1-&gt;0)</p>
                    <p className="text-sm font-bold text-warning">
                      {advancedData.practice_06.final_test_metrics.confusion_matrix[1][0]}
                    </p>
                  </div>
                  <div className="rounded-lg border border-success/30 bg-success/10 p-2">
                    <p className="text-[10px] text-graphite-300">VP (1-&gt;1)</p>
                    <p className="text-sm font-bold text-success">
                      {advancedData.practice_06.final_test_metrics.confusion_matrix[1][1]}
                    </p>
                  </div>
                </div>
                <AuraButton
                  size="sm"
                  variant="neo"
                  icon={Download}
                  className="self-start"
                  onClick={() => {
                    downloadCsvFile(
                      'p06_comparacion_busquedas.csv',
                      advancedData.practice_06.comparacion_csv,
                    )
                    toast.success('Archivo p06_comparacion_busquedas.csv descargado.')
                  }}
                >
                  Descargar CSV de comparacion
                </AuraButton>
              </div>
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Notas Metodologicas
                </span>
                <ul className="flex flex-col gap-2 text-xs leading-relaxed text-graphite-300">
                  {advancedData.practice_06.notas_metodologicas.map((nota) => (
                    <li key={nota} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                      <span>{nota}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          renderAdvancedGate(
            'Optimizacion de Hiperparametros (Practica 06)',
            'Ejecuta GridSearchCV y RandomizedSearchCV con validacion cruzada estratificada de 5 particiones sobre Decision Tree, Random Forest y KNN. Compara ambas estrategias por F1-Score, elige el mejor modelo y lo evalua una sola vez contra el conjunto de prueba reservado.',
          )
        ))}

      {/* =====================================================================
          PESTAÑA 7: SEGMENTACION K-MEANS Y LIMPIEZA COMPLETA (PRACTICA 07)
         ===================================================================== */}
      {activeTab === 'p07_kmeans' &&
        (advancedData ? (
          <div className="flex flex-col gap-5">
            {/* KPIs de segmentacion y calidad de datos */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Registros Procesados</p>
                <p className="mt-1 font-mono text-base font-semibold text-bone">
                  {advancedData.practice_07.limpieza.registros_finales}
                </p>
                <p className="text-[0.68rem] text-graphite-400">
                  de {advancedData.practice_07.limpieza.registros_iniciales} generados
                </p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Faltantes Imputados</p>
                <p className="mt-1 font-mono text-base font-semibold text-warning">
                  {advancedData.practice_07.limpieza.total_faltantes}
                </p>
                <p className="text-[0.68rem] text-graphite-400">con la mediana</p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Duplicados Retirados</p>
                <p className="mt-1 font-mono text-base font-semibold text-warning">
                  {advancedData.practice_07.limpieza.duplicados_eliminados}
                </p>
                <p className="text-[0.68rem] text-graphite-400">filas exactas</p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Valores Corregidos</p>
                <p className="mt-1 font-mono text-base font-semibold text-warning">
                  {advancedData.practice_07.limpieza.correcciones_rango.length}
                </p>
                <p className="text-[0.68rem] text-graphite-400">fuera de rango (clip)</p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">K Seleccionado</p>
                <p className="mt-1 font-mono text-base font-semibold text-success">
                  K = {advancedData.practice_07.k_final}
                </p>
                <p className="text-[0.68rem] text-graphite-400">
                  Inercia {Math.round(advancedData.practice_07.inercia_final)}
                </p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Silhouette Final</p>
                <p className="mt-1 font-mono text-base font-semibold text-aura-300">
                  {advancedData.practice_07.silhouette_final.toFixed(3)}
                </p>
                <p className="text-[0.68rem] text-graphite-400">cohesion + separacion</p>
              </div>
            </div>

            {/* Auditoria de limpieza */}
            <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  Auditoria de Limpieza de Datos (antes de segmentar)
                  <AuraInfoBubble
                    title="Limpieza completa"
                    explanation="Antes de aplicar K-Means se detectan valores faltantes (imputados con la mediana de cada columna), duplicados exactos (retirados) y valores fuera de rango valido (recortados con clip). Nada desaparece sin registro: cada correccion queda en la auditoria."
                    benefit="Los 4 rasgos estan en escalas distintas (horas 0-12 vs porcentajes 0-100), por eso despues se estandarizan para que ninguna variable domine la distancia."
                  />
                </span>
                <MissingBars missing={advancedData.practice_07.limpieza.missing_by_column} />
                <p className="text-[11px] leading-relaxed text-graphite-400">
                  {advancedData.practice_07.limpieza.estrategia}
                </p>
              </div>
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  Registro de Correcciones (muestra)
                </span>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-[#0b0e17]">
                      <tr className="border-b border-white/10 text-[0.65rem] uppercase text-graphite-400">
                        <th className="py-1 pr-2">Registro</th>
                        <th className="py-1 pr-2">Variable</th>
                        <th className="py-1 pr-2 text-right">Antes</th>
                        <th className="py-1 text-right">Despues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {advancedData.practice_07.limpieza.imputaciones_mediana
                        .slice(0, 9)
                        .map((imp) => (
                          <tr key={`${imp.id}-${imp.variable}`}>
                            <td className="py-1.5 pr-2 text-bone">{imp.id}</td>
                            <td className="py-1.5 pr-2 text-graphite-300">{imp.variable}</td>
                            <td className="py-1.5 pr-2 text-right text-warning">faltante</td>
                            <td className="py-1.5 text-right text-success">
                              {imp.mediana_usada} (mediana)
                            </td>
                          </tr>
                        ))}
                      {advancedData.practice_07.limpieza.correcciones_rango
                        .slice(0, 9)
                        .map((cor) => (
                          <tr key={`${cor.id}-${cor.variable}`}>
                            <td className="py-1.5 pr-2 text-bone">{cor.id}</td>
                            <td className="py-1.5 pr-2 text-graphite-300">{cor.variable}</td>
                            <td className="py-1.5 pr-2 text-right text-warning">
                              {cor.valor_original}
                            </td>
                            <td className="py-1.5 text-right text-success">
                              {cor.valor_ajustado} (clip)
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Codo + Silhouette */}
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                  Metodo del Codo (Inercia / WCSS)
                  <AuraInfoBubble
                    title="Como leer el codo"
                    explanation="La inercia mide que tan compactos son los grupos. Siempre baja al aumentar K, pero llega un punto donde la mejora se aplana: ese 'codo' sugiere el K razonable."
                  />
                </span>
                <ElbowChart
                  elbow={advancedData.practice_07.elbow}
                  kFinal={advancedData.practice_07.k_final}
                />
              </div>
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Silhouette Score por K
                  <AuraInfoBubble
                    title="Silhouette"
                    explanation="Combina cohesion (que tan cerca esta cada punto de su grupo) y separacion (que tan lejos esta de los demas grupos). Va de -1 a 1: valores altos indican segmentos bien definidos."
                  />
                </span>
                <SilhouetteBars
                  rows={advancedData.practice_07.silhouette_por_k}
                  kFinal={advancedData.practice_07.k_final}
                />
              </div>
            </div>

            {/* Selector de K + scatter de clusters */}
            <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
                  Segmentos por K-Means (k-means++, n_init con semilla fija)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-graphite-400">Probar otro K:</span>
                  {[2, 3, 4, 5, 6, 7, 8].map((k) => (
                    <AuraButton
                      key={k}
                      size="sm"
                      variant={kmeansK === k ? 'primary' : 'ghost'}
                      disabled={advMutation.isPending}
                      onClick={() => {
                        setKmeansK(k)
                        runAdvanced(k)
                      }}
                    >
                      {k}
                    </AuraButton>
                  ))}
                </div>
              </div>
              <ClusterScatter
                points={advancedData.practice_07.scatter}
                centroids={advancedData.practice_07.centroides}
                kFinal={advancedData.practice_07.k_final}
              />
            </div>

            {/* Perfiles interpretables + nuevo caso + exportacion */}
            <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Perfiles Interpretables (promedios reales por segmento)
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                        <th className="py-1.5 pr-2">Perfil</th>
                        <th className="py-1.5 pr-2 text-right">Cant.</th>
                        <th className="py-1.5 pr-2 text-right">Horas</th>
                        <th className="py-1.5 pr-2 text-right">Asist.</th>
                        <th className="py-1.5 pr-2 text-right">Activ.</th>
                        <th className="py-1.5 text-right">Partic.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {advancedData.practice_07.perfiles.map((pf) => (
                        <tr key={pf.cluster}>
                          <td className="py-2 pr-2 font-sans">
                            <span
                              className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                              style={{
                                backgroundColor:
                                  pf.color ?? CLUSTER_COLORS[pf.cluster % CLUSTER_COLORS.length],
                              }}
                            />
                            <span className="font-semibold text-bone">{pf.perfil}</span>
                          </td>
                          <td className="py-2 pr-2 text-right text-graphite-300">{pf.cantidad}</td>
                          <td className="py-2 pr-2 text-right text-aura-300">
                            {pf.horas_estudio}h
                          </td>
                          <td className="py-2 pr-2 text-right text-sky-300">{pf.asistencia}%</td>
                          <td className="py-2 pr-2 text-right text-purple-300">
                            {pf.actividades}%
                          </td>
                          <td className="py-2 text-right text-warning">{pf.participacion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AuraButton
                    size="sm"
                    variant="neo"
                    icon={Download}
                    onClick={() => {
                      downloadCsvFile(
                        'p07_registros_segmentados.csv',
                        advancedData.practice_07.segmentados_csv,
                      )
                      toast.success('Archivo p07_registros_segmentados.csv descargado.')
                    }}
                  >
                    CSV registros + cluster
                  </AuraButton>
                  <AuraButton
                    size="sm"
                    variant="neo"
                    icon={Download}
                    onClick={() => {
                      downloadCsvFile(
                        'p07_perfiles_clusters.csv',
                        advancedData.practice_07.perfiles_csv,
                      )
                      toast.success('Archivo p07_perfiles_clusters.csv descargado.')
                    }}
                  >
                    CSV perfiles
                  </AuraButton>
                </div>
              </div>
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Clasificacion del Caso Simulado
                </span>
                {advancedData.practice_07.new_case_segment ? (
                  <>
                    <p className="text-xs text-graphite-300">
                      El perfil simulado ({horas}h, {asistencia}%, {actividades}%, partic.{' '}
                      {participacion}) queda mas cerca del centroide:
                    </p>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                      <span className="flex items-center gap-2 text-sm font-semibold text-bone">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor:
                              advancedData.practice_07.new_case_segment.color,
                          }}
                        />
                        {advancedData.practice_07.new_case_segment.perfil}
                      </span>
                      <AuraBadge tone="info">
                        dist {advancedData.practice_07.new_case_segment.distancia_centroide}
                      </AuraBadge>
                    </div>
                    <p className="text-[11px] leading-relaxed text-graphite-400">
                      La distancia al centroide indica que tan representativo es el perfil dentro
                      de su grupo: menor distancia = mas parecido al promedio del segmento.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-graphite-400">
                    No se clasifico un caso nuevo en esta ejecucion.
                  </p>
                )}
                <div className="rounded-xl border border-warning/20 bg-warning/[0.06] p-3">
                  <p className="text-[11px] leading-relaxed text-warning">
                    El segmento describe grupos de perfiles parecidos para orientar el
                    acompanamiento; no es una calificacion ni una decision de empleo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          renderAdvancedGate(
            'Segmentacion K-Means y Limpieza (Practica 07)',
            'Procesa 500 perfiles con 4 variables, audita la limpieza completa (faltantes con mediana, duplicados, rangos), estandariza y segmenta con K-Means. Evalua K=2..8 por metodo del codo y Silhouette Score, e interpreta los perfiles resultantes.',
          )
        ))}

      {/* =====================================================================
          PESTAÑA 8: ANALISIS AVANZADO DE CLUSTERS (PRACTICA 08)
         ===================================================================== */}
      {activeTab === 'p08_stability' &&
        (advancedData ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Estabilidad (ARI promedio)</p>
                <p className="mt-1 font-mono text-base font-semibold text-success">
                  {advancedData.practice_08.estabilidad.ari_promedio.toFixed(3)}
                </p>
                <p className="text-[0.68rem] text-graphite-400">
                  entre {advancedData.practice_08.estabilidad.semillas.length} semillas
                </p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Silhouette (config. final)</p>
                <p className="mt-1 font-mono text-base font-semibold text-aura-300">
                  {advancedData.practice_08.silhouette_final.toFixed(3)}
                </p>
                <p className="text-[0.68rem] text-graphite-400">k-means++ + StandardScaler</p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Posibles Atipicos</p>
                <p className="mt-1 font-mono text-base font-semibold text-warning">
                  {advancedData.practice_08.atipicos.total_candidatos} (
                  {advancedData.practice_08.atipicos.porcentaje}%)
                </p>
                <p className="text-[0.68rem] text-graphite-400">sobre el percentil 95</p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Umbral P95 de Distancia</p>
                <p className="mt-1 font-mono text-base font-semibold text-bone">
                  {advancedData.practice_08.atipicos.umbral_distancia.toFixed(3)}
                </p>
                <p className="text-[0.68rem] text-graphite-400">al centroide propio</p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Comparacion de inicializaciones */}
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
                  Inicializacion: k-means++ vs random
                  <AuraInfoBubble
                    title="k-means++ vs random"
                    explanation="k-means++ elige los centroides iniciales separados entre si (determinista y suele converger mejor); random los ubica al azar. Se comparan inercia y Silhouette con la misma semilla."
                  />
                </span>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                      <th className="py-1.5 pr-2">Metodo</th>
                      <th className="py-1.5 pr-2 text-right">Inercia</th>
                      <th className="py-1.5 text-right">Silhouette</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {advancedData.practice_08.inicializaciones.map((row) => (
                      <tr key={row.inicializacion}>
                        <td className="py-2 pr-2 font-sans font-semibold text-bone">
                          {row.inicializacion}
                        </td>
                        <td className="py-2 pr-2 text-right text-aura-300">
                          {row.inercia.toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-success">
                          {row.silhouette.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Comparacion de escaladores */}
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                  Escalamiento: StandardScaler vs MinMaxScaler
                  <AuraInfoBubble
                    title="Escaladores"
                    explanation="StandardScaler lleva cada variable a media 0 y desviacion 1; MinMaxScaler la comprime al rango 0-1. La inercia NO es comparable entre escaladores (cambia la escala de las distancias): comparar solo el Silhouette."
                  />
                </span>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                      <th className="py-1.5 pr-2">Escalador</th>
                      <th className="py-1.5 pr-2 text-right">Inercia</th>
                      <th className="py-1.5 text-right">Silhouette</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {advancedData.practice_08.escaladores.map((row) => (
                      <tr key={row.escalador}>
                        <td className="py-2 pr-2 font-sans font-semibold text-bone">
                          {row.escalador}
                        </td>
                        <td className="py-2 pr-2 text-right text-aura-300">
                          {row.inercia.toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-success">
                          {row.silhouette.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Matriz ARI + distancias P95 */}
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <Radar className="h-3.5 w-3.5" aria-hidden="true" />
                  Matriz de Estabilidad ARI entre Semillas
                  <AuraInfoBubble
                    title="Adjusted Rand Index"
                    explanation="El ARI compara dos particiones: 1.00 significa que las semillas producen los mismos grupos (estable), 0 coincidencia al azar. Se entrena K-Means con 6 semillas distintas y se cruzan las asignaciones."
                  />
                </span>
                <AriMatrix
                  semillas={advancedData.practice_08.estabilidad.semillas}
                  matriz={advancedData.practice_08.estabilidad.matriz_ari}
                />
                <p className="text-[11px] leading-relaxed text-graphite-400">
                  {advancedData.practice_08.estabilidad.interpretacion}
                </p>
              </div>
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                  Distancia al Centroide y Atipicos (P95)
                </span>
                <DistanceScatter
                  distancias={advancedData.practice_08.atipicos.distancias}
                  umbral={advancedData.practice_08.atipicos.umbral_distancia}
                />
              </div>
            </div>

            {/* Top candidatos atipicos + reporte */}
            <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Registros mas Distantes de su Centroide (revision humana)
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[0.68rem] uppercase text-graphite-400">
                        <th className="py-1.5 pr-2">Registro</th>
                        <th className="py-1.5 pr-2 text-right">Cluster</th>
                        <th className="py-1.5 pr-2 text-right">Distancia</th>
                        <th className="py-1.5 pr-2 text-right">Silhouette</th>
                        <th className="py-1.5 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {advancedData.practice_08.atipicos.top_candidatos.map((row) => (
                        <tr key={row.id} className={cn(row.atipico && 'bg-rose-500/10')}>
                          <td className="py-2 pr-2 text-bone">{row.id}</td>
                          <td className="py-2 pr-2 text-right">
                            <span
                              className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                              style={{
                                backgroundColor:
                                  CLUSTER_COLORS[row.cluster % CLUSTER_COLORS.length],
                              }}
                            />
                            {row.cluster}
                          </td>
                          <td className="py-2 pr-2 text-right text-aura-300">
                            {row.distancia.toFixed(3)}
                          </td>
                          <td className="py-2 pr-2 text-right text-sky-300">
                            {row.silhouette.toFixed(3)}
                          </td>
                          <td className="py-2 text-right">
                            {row.atipico ? (
                              <AuraBadge tone="warning">Revisar</AuraBadge>
                            ) : (
                              <AuraBadge tone="success">Normal</AuraBadge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  Reporte Integral y Salvaguarda
                </span>
                <p className="text-xs leading-relaxed text-graphite-300">
                  {advancedData.practice_08.nota_atipicos}
                </p>
                <AuraButton
                  size="sm"
                  variant="neo"
                  icon={Download}
                  className="self-start"
                  onClick={() => {
                    downloadCsvFile(
                      'p08_reporte_clusters.csv',
                      advancedData.practice_08.reporte_csv,
                    )
                    toast.success('Archivo p08_reporte_clusters.csv descargado.')
                  }}
                >
                  Descargar reporte CSV
                </AuraButton>
              </div>
            </div>
          </div>
        ) : (
          renderAdvancedGate(
            'Analisis Avanzado de Clusters (Practica 08)',
            'Compara k-means++ vs random, StandardScaler vs MinMaxScaler, mide la estabilidad entre ejecuciones con Adjusted Rand Index (semillas 42/7/123) y detecta posibles casos atipicos con el percentil 95 de distancia al centroide.',
          )
        ))}

      {/* =====================================================================
          PESTAÑA 9: PCA — REDUCCION DE DIMENSIONALIDAD (PRACTICA 09)
         ===================================================================== */}
      {activeTab === 'p09_pca' &&
        (advancedData ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Varianza de PC1</p>
                <p className="mt-1 font-mono text-base font-semibold text-aura-300">
                  {advancedData.practice_09.variance_table[0]?.varianza_pct ?? 0}%
                </p>
                <p className="text-[0.68rem] text-graphite-400">direccion principal</p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Componentes Necesarias</p>
                <p className="mt-1 font-mono text-base font-semibold text-success">
                  {advancedData.practice_09.componentes_necesarias}
                </p>
                <p className="text-[0.68rem] text-graphite-400">
                  para {advancedData.practice_09.varianza_objetivo_pct}% de varianza
                </p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">Varianza Conservada</p>
                <p className="mt-1 font-mono text-base font-semibold text-sky-300">
                  {advancedData.practice_09.varianza_conservada_pct}%
                </p>
                <p className="text-[0.68rem] text-graphite-400">tras reducir dimensiones</p>
              </div>
              <div className="neo-inset rounded-xl p-3">
                <p className="text-[0.68rem] text-graphite-400">MSE de Reconstruccion</p>
                <p className="mt-1 font-mono text-base font-semibold text-bone">
                  {advancedData.practice_09.reconstruccion_mse.toFixed(4)}
                </p>
                <p className="text-[0.68rem] text-graphite-400">error al volver a 4 variables</p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Grafica de Sedimentacion (Scree) y Varianza Acumulada
                  <AuraInfoBubble
                    title="Varianza explicada"
                    explanation="PCA encuentra direcciones (componentes) que resumen la variacion de las 4 variables. PC1 siempre captura lo maximo posible; la linea verde muestra cuanto se acumula al sumar componentes."
                  />
                </span>
                <ScreeChart
                  table={advancedData.practice_09.variance_table}
                  objetivoPct={advancedData.practice_09.varianza_objetivo_pct}
                />
              </div>
              <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
                <span className="hud-label flex items-center gap-1.5 text-aura-400">
                  <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Cargas (Loadings): que Variable Pesa en cada Componente
                  <AuraInfoBubble
                    title="Como leer las cargas"
                    explanation="Cada celda indica cuanto contribuye una variable a un componente. Valores positivos altos en PC1 significan que esas variables crecen juntas y dominan la variacion entre perfiles."
                  />
                </span>
                <LoadingsHeatmap
                  loadings={advancedData.practice_09.loadings}
                  variables={advancedData.practice_09.variables}
                />
              </div>
            </div>

            <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
              <span className="hud-label flex items-center gap-1.5 text-aura-400">
                <Sigma className="h-3.5 w-3.5" aria-hidden="true" />
                Proyeccion PCA en 2D Coloreada por Segmento K-Means
              </span>
              <PcaScatter
                points={advancedData.practice_09.scatter_2d}
                perfiles={advancedData.practice_07.perfiles}
              />
              <p className="text-[11px] leading-relaxed text-graphite-400">
                {advancedData.practice_09.nota_pca}
              </p>
              <div className="flex flex-wrap gap-2">
                <AuraButton
                  size="sm"
                  variant="neo"
                  icon={Download}
                  onClick={() => {
                    downloadCsvFile(
                      'p09_coordenadas_pca.csv',
                      advancedData.practice_09.coords_csv,
                    )
                    toast.success('Archivo p09_coordenadas_pca.csv descargado.')
                  }}
                >
                  CSV coordenadas PCA
                </AuraButton>
                <AuraButton
                  size="sm"
                  variant="neo"
                  icon={Download}
                  onClick={() => {
                    downloadCsvFile(
                      'p09_varianza_explicada.csv',
                      advancedData.practice_09.varianza_csv,
                    )
                    toast.success('Archivo p09_varianza_explicada.csv descargado.')
                  }}
                >
                  CSV varianza explicada
                </AuraButton>
              </div>
            </div>
          </div>
        ) : (
          renderAdvancedGate(
            'PCA — Reduccion de Dimensionalidad (Practica 09)',
            'Estandariza las 4 variables, calcula los componentes principales con varianza explicada individual y acumulada, interpreta las cargas, proyecta los perfiles en 2D coloreados por cluster K-Means y mide el error de reconstruccion.',
          )
        ))}
    </section>
  )
}
