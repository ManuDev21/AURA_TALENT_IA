import { useMutation, useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
  Table as TableIcon,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import {
  auraApi,
  type MlCnnTrajectorySimulation,
  type MlCompetenciaDossierRow,
  type MlDossierEvaluationResponse,
  type MlTalentSuiteResponse,
} from '@/api/aura'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { useDebouncedCallback } from '@/utils/useDebouncedCallback'

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ============================================================================
// 1. GRAFICA DE PASTEL / DONA (PIE / DONUT CHART SVG)
// ============================================================================

export function DonutChartSvg({
  title,
  subtitle,
  slices,
}: {
  title: string
  subtitle: string
  slices: Array<{ label: string; value: number; pct: number; color: string }>
}) {
  const total = Math.max(
    1,
    slices.reduce((acc, s) => acc + s.value, 0),
  )
  const cx = 125
  const cy = 115
  const rOuter = 82
  const rInner = 46

  let accAngle = -Math.PI / 2

  const paths = slices.map((s) => {
    const frac = s.value / total
    const startAngle = accAngle
    const endAngle = accAngle + frac * Math.PI * 2
    accAngle = endAngle

    const largeArc = frac > 0.5 ? 1 : 0
    const x1 = cx + rOuter * Math.cos(startAngle)
    const y1 = cy + rOuter * Math.sin(startAngle)
    const x2 = cx + rOuter * Math.cos(endAngle)
    const y2 = cy + rOuter * Math.sin(endAngle)

    const x3 = cx + rInner * Math.cos(endAngle)
    const y3 = cy + rInner * Math.sin(endAngle)
    const x4 = cx + rInner * Math.cos(startAngle)
    const y4 = cy + rInner * Math.sin(startAngle)

    const d = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      'Z',
    ].join(' ')

    const mid = (startAngle + endAngle) / 2
    const lx = cx + ((rOuter + rInner) / 2) * Math.cos(mid)
    const ly = cy + ((rOuter + rInner) / 2) * Math.sin(mid)

    return { ...s, d, lx, ly }
  })

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#070911] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 font-mono text-xs font-bold text-orange-400">
          {total.toLocaleString()} registros
        </span>
      </div>
      <svg
        viewBox="0 0 480 230"
        className="h-auto w-full min-w-[380px]"
        role="img"
        aria-label={title}
      >
        {paths.map((p) => (
          <g key={p.label}>
            <path
              d={p.d}
              fill={p.color}
              stroke="#070911"
              strokeWidth={2.5}
              opacity={0.92}
            />
            {p.pct >= 10 && (
              <text
                x={p.lx}
                y={p.ly + 4}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {p.pct}%
              </text>
            )}
          </g>
        ))}
        <circle cx={cx} cy={cy} r={rInner - 2} fill="#070911" />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="#f8fafc"
          fontSize="13"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {(total / 1000).toFixed(0)}K
        </text>
        <text
          x={cx}
          y={cy + 13}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="9.5"
        >
          evaluaciones
        </text>

        {slices.map((s, idx) => {
          const y = 48 + idx * 54
          return (
            <g key={s.label}>
              <rect
                x={245}
                y={y - 12}
                width={220}
                height={44}
                rx={8}
                fill="rgba(255,255,255,0.03)"
                stroke="rgba(255,255,255,0.08)"
              />
              <circle cx={263} cy={y + 10} r={7} fill={s.color} />
              <text
                x={278}
                y={y + 6}
                fill="#f8fafc"
                fontSize="12"
                fontWeight="bold"
              >
                {s.label}
              </text>
              <text
                x={278}
                y={y + 22}
                fill="#94a3b8"
                fontSize="11"
                fontFamily="monospace"
              >
                {s.value.toLocaleString()} ({s.pct}%)
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ============================================================================
// 2. HISTOGRAMA DE DISTRIBUCION CONTINUA (HISTOGRAM SVG)
// ============================================================================

export function HistogramChartSvg({
  title,
  subtitle,
  bins,
  thresholdIndex,
  thresholdLabel,
  barColor = '#ff7a1a',
  highlightColor = '#10b981',
}: {
  title: string
  subtitle: string
  bins: Array<{ rango: string; frecuencia: number; porcentaje?: number }>
  thresholdIndex?: number
  thresholdLabel?: string
  barColor?: string
  highlightColor?: string
}) {
  const width = 680
  const height = 255
  const padL = 56
  const padR = 24
  const padT = 28
  const padB = 52
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const maxFreq = Math.max(1, ...bins.map((b) => b.frecuencia))
  const slotW = innerW / Math.max(1, bins.length)
  const barW = Math.max(6, slotW - 3)

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#070911] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[440px]"
        role="img"
        aria-label={title}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padT + innerH - frac * innerH
          const val = Math.round(frac * maxFreq)
          return (
            <g key={frac}>
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
                {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
              </text>
            </g>
          )
        })}

        {bins.map((b, i) => {
          const h = Math.max(2, (b.frecuencia / maxFreq) * innerH)
          const x = padL + i * slotW + 1.5
          const y = padT + innerH - h
          const isAbove = thresholdIndex !== undefined && i >= thresholdIndex
          return (
            <g key={b.rango}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={3}
                fill={isAbove ? highlightColor : barColor}
                opacity={0.88}
              />
              {(i % 2 === 0 || bins.length <= 12) && (
                <text
                  x={x + barW / 2}
                  y={height - 22}
                  textAnchor="middle"
                  fill="#cbd5e1"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {b.rango}
                </text>
              )}
            </g>
          )
        })}

        {thresholdIndex !== undefined && (
          <g>
            <line
              x1={padL + thresholdIndex * slotW}
              y1={padT - 6}
              x2={padL + thresholdIndex * slotW}
              y2={padT + innerH}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 3"
            />
            {thresholdLabel && (
              <text
                x={padL + thresholdIndex * slotW + 6}
                y={padT + 10}
                fill="#10b981"
                fontSize="10.5"
                fontWeight="bold"
              >
                {thresholdLabel}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  )
}

// ============================================================================
// 3. GRAFICA DE TRIANGULO (DIAGRAMA TERNARIO BARICENTRICO + PIRAMIDE)
// ============================================================================

export function TernaryTriangleChartSvg({
  points,
  activePoint,
}: {
  points: Array<{
    id: string
    p_ascenso: number
    p_estable: number
    p_refuerzo: number
    trayectoria: string
  }>
  activePoint?: {
    p_ascenso: number
    p_estable: number
    p_refuerzo: number
    label?: string
  }
}) {
  // Vertices del triangulo equilatero en el viewBox 480 x 310
  // Vertice Superior (A): En Ascenso = (240, 32)
  // Vertice Inferior Izquierdo (B): Requiere Refuerzo = (68, 266)
  // Vertice Inferior Derecho (C): Estable = (412, 266)
  const Ax = 240
  const Ay = 32
  const Bx = 68
  const By = 266
  const Cx = 412
  const Cy = 266

  const toXY = (pAsc: number, pRef: number, pEst: number) => {
    const s = Math.max(1e-6, pAsc + pRef + pEst)
    const a = pAsc / s
    const b = pRef / s
    const c = pEst / s
    return {
      x: a * Ax + b * Bx + c * Cx,
      y: a * Ay + b * By + c * Cy,
    }
  }

  const colorMap: Record<string, string> = {
    'En Ascenso': '#10b981',
    Estable: '#38bdf8',
    'Requiere Refuerzo': '#f43f5e',
  }

  const activeCoords = activePoint
    ? toXY(activePoint.p_ascenso, activePoint.p_refuerzo, activePoint.p_estable)
    : null

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#070911] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">
            Grafica de Triangulo Baricentrico (Ternaria de Trayectorias)
          </p>
          <p className="text-xs text-slate-400">
            Cada punto ubica las 3 probabilidades (Ascenso + Estable + Refuerzo = 100%)
          </p>
        </div>
      </div>
      <svg
        viewBox="0 0 480 305"
        className="h-auto w-full min-w-[380px]"
        role="img"
        aria-label="Diagrama triangular ternario de probabilidades de trayectoria"
      >
        {/* Lineas guia internas del triangulo (25%, 50%, 75%) */}
        {[0.25, 0.5, 0.75].map((f) => {
          const p1 = toXY(f, 1 - f, 0)
          const p2 = toXY(f, 0, 1 - f)
          const q1 = toXY(0, f, 1 - f)
          const q2 = toXY(1 - f, f, 0)
          const r1 = toXY(0, 1 - f, f)
          const r2 = toXY(1 - f, 0, f)
          return (
            <g key={f} stroke="rgba(148,163,184,0.16)" strokeDasharray="3 3">
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
              <line x1={q1.x} y1={q1.y} x2={q2.x} y2={q2.y} />
              <line x1={r1.x} y1={r1.y} x2={r2.x} y2={r2.y} />
            </g>
          )
        })}

        {/* Contorno del Triangulo */}
        <polygon
          points={`${Ax},${Ay} ${Bx},${By} ${Cx},${Cy}`}
          fill="rgba(255,122,26,0.04)"
          stroke="#ff7a1a"
          strokeWidth={2.2}
        />

        {/* Etiquetas de los 3 vertices */}
        <text
          x={Ax}
          y={18}
          textAnchor="middle"
          fill="#10b981"
          fontSize="12"
          fontWeight="bold"
        >
          100% En Ascenso
        </text>
        <text
          x={Bx}
          y={288}
          textAnchor="middle"
          fill="#f43f5e"
          fontSize="11.5"
          fontWeight="bold"
        >
          100% Requiere Refuerzo
        </text>
        <text
          x={Cx}
          y={288}
          textAnchor="middle"
          fill="#38bdf8"
          fontSize="11.5"
          fontWeight="bold"
        >
          100% Estable
        </text>

        {/* Puntos de la muestra de 100,000 registros */}
        {points.map((pt) => {
          const { x, y } = toXY(pt.p_ascenso, pt.p_refuerzo, pt.p_estable)
          return (
            <circle
              key={pt.id}
              cx={x}
              cy={y}
              r={3.3}
              fill={colorMap[pt.trayectoria] ?? '#38bdf8'}
              opacity={0.72}
            />
          )
        })}

        {/* Punto del candidato simulado en vivo */}
        {activeCoords && (
          <g>
            <circle
              cx={activeCoords.x}
              cy={activeCoords.y}
              r={11}
              fill="rgba(255,106,0,0.25)"
              stroke="#ff6a00"
              strokeWidth={2}
            />
            <circle
              cx={activeCoords.x}
              cy={activeCoords.y}
              r={5}
              fill="#ff6a00"
              stroke="#ffffff"
              strokeWidth={1.8}
            />
            <text
              x={activeCoords.x + 14}
              y={activeCoords.y + 4}
              fill="#ffffff"
              fontSize="11"
              fontWeight="bold"
            >
              {activePoint?.label ?? 'Candidato Actual'}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

export function PyramidChartSvg({
  levels,
}: {
  levels: Array<{
    nivel: string
    cantidad: number
    porcentaje: number
    color: string
  }>
}) {
  const width = 480
  const height = 275
  const topY = 26
  const botY = 248
  const centerX = 165
  const maxHalfW = 135
  const n = Math.max(1, levels.length)
  const layerH = (botY - topY) / n

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#070911] p-4">
      <div className="mb-2">
        <p className="text-sm font-bold text-white">
          Piramide Triangular de Madurez de Talento (100,000 Registros)
        </p>
        <p className="text-xs text-slate-400">
          Jerarquia de preparacion desde Etapa Inicial hasta Dominio Sobresaliente
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[380px]"
        role="img"
        aria-label="Piramide triangular de niveles de madurez laboral"
      >
        {levels.map((lv, i) => {
          const y1 = topY + i * layerH
          const y2 = y1 + layerH - 3
          const w1 = ((i + 0.35) / n) * maxHalfW
          const w2 = ((i + 1) / n) * maxHalfW
          const pts = [
            `${centerX - w1},${y1}`,
            `${centerX + w1},${y1}`,
            `${centerX + w2},${y2}`,
            `${centerX - w2},${y2}`,
          ].join(' ')
          const midY = (y1 + y2) / 2
          return (
            <g key={lv.nivel}>
              <polygon
                points={pts}
                fill={lv.color}
                opacity={0.86}
                stroke="#070911"
                strokeWidth={2}
              />
              <line
                x1={centerX + w2 + 8}
                y1={midY}
                x2={312}
                y2={midY}
                stroke="rgba(255,255,255,0.22)"
                strokeDasharray="2 2"
              />
              <text
                x={318}
                y={midY - 2}
                fill="#f8fafc"
                fontSize="11"
                fontWeight="bold"
              >
                {lv.nivel}
              </text>
              <text
                x={318}
                y={midY + 13}
                fill="#94a3b8"
                fontSize="10.5"
                fontFamily="monospace"
              >
                {lv.cantidad.toLocaleString()} ({lv.porcentaje}%)
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ============================================================================
// 4. MODELO 3D INTERACTIVO ROTATORIO (PROYECCION ESPACIAL 3D DE TALENTO)
// ============================================================================

export function Interactive3DPointCloudSvg({
  points,
}: {
  points: Array<{
    id: string
    competencia: string
    x: number
    y: number
    z: number
    indice: number
    trayectoria: string
    clase: number
  }>
}) {
  const [yawDeg, setYawDeg] = useState(38)
  const [pitchDeg, setPitchDeg] = useState(24)

  const yaw = (yawDeg * Math.PI) / 180
  const pitch = (pitchDeg * Math.PI) / 180

  const cx = 310
  const cy = 155
  const scale = 19

  // Proyecta un punto 3D (x, y, z en [0..10]) al lienzo 2D con profundidad
  const project = (x: number, y: number, z: number) => {
    const nx = x - 5
    const ny = y - 5
    const nz = z - 5

    const rx = nx * Math.cos(yaw) - ny * Math.sin(yaw)
    const ry = nx * Math.sin(yaw) + ny * Math.cos(yaw)

    const py = ry * Math.cos(pitch) - nz * Math.sin(pitch)
    const pz = ry * Math.sin(pitch) + nz * Math.cos(pitch)

    const perspective = 1 + pz * 0.035
    return {
      sx: cx + rx * scale * perspective,
      sy: cy - py * scale * perspective,
      depth: pz,
    }
  }

  const origin = project(0, 0, 0)
  const axisX = project(10, 0, 0)
  const axisY = project(0, 10, 0)
  const axisZ = project(0, 0, 10)

  const projectedPoints = points
    .map((p) => {
      const pr = project(p.x, p.y, p.z)
      return { ...p, ...pr }
    })
    .sort((a, b) => a.depth - b.depth)

  const colorByClass: Record<number, string> = {
    0: '#f43f5e',
    1: '#38bdf8',
    2: '#10b981',
  }

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#070911] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">
            Modelo Espacial 3D Interactivo (Etapa 1 CV × Etapa 3 STAR × Constancia)
          </p>
          <p className="text-xs text-slate-400">
            Rota la camara en 3D con los controles para inspeccionar la separacion de trayectorias
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <label className="flex items-center gap-2">
            <span>Rotacion Z ({yawDeg}°):</span>
            <input
              type="range"
              min={-180}
              max={180}
              value={yawDeg}
              onChange={(e) => setYawDeg(Number(e.target.value))}
              className="w-24 accent-orange-500"
            />
          </label>
          <label className="flex items-center gap-2">
            <span>Inclinacion ({pitchDeg}°):</span>
            <input
              type="range"
              min={-60}
              max={60}
              value={pitchDeg}
              onChange={(e) => setPitchDeg(Number(e.target.value))}
              className="w-24 accent-orange-500"
            />
          </label>
        </div>
      </div>

      <svg
        viewBox="0 0 640 300"
        className="h-auto w-full min-w-[440px]"
        role="img"
        aria-label="Modelo 3D interactivo de candidatos por etapa y constancia"
      >
        {/* Rejilla de piso z=0 */}
        {[0, 2.5, 5, 7.5, 10].map((g) => {
          const a1 = project(g, 0, 0)
          const a2 = project(g, 10, 0)
          const b1 = project(0, g, 0)
          const b2 = project(10, g, 0)
          return (
            <g key={g} stroke="rgba(148,163,184,0.14)" strokeWidth={1}>
              <line x1={a1.sx} y1={a1.sy} x2={a2.sx} y2={a2.sy} />
              <line x1={b1.sx} y1={b1.sy} x2={b2.sx} y2={b2.sy} />
            </g>
          )
        })}

        {/* Ejes X, Y, Z */}
        <line
          x1={origin.sx}
          y1={origin.sy}
          x2={axisX.sx}
          y2={axisX.sy}
          stroke="#ff7a1a"
          strokeWidth={2.4}
        />
        <text x={axisX.sx + 6} y={axisX.sy} fill="#ff7a1a" fontSize="11" fontWeight="bold">
          Eje X: Etapa 1 CV
        </text>

        <line
          x1={origin.sx}
          y1={origin.sy}
          x2={axisY.sx}
          y2={axisY.sy}
          stroke="#10b981"
          strokeWidth={2.4}
        />
        <text x={axisY.sx + 6} y={axisY.sy} fill="#10b981" fontSize="11" fontWeight="bold">
          Eje Y: Etapa 3 STAR
        </text>

        <line
          x1={origin.sx}
          y1={origin.sy}
          x2={axisZ.sx}
          y2={axisZ.sy}
          stroke="#38bdf8"
          strokeWidth={2.4}
        />
        <text x={axisZ.sx + 6} y={axisZ.sy} fill="#38bdf8" fontSize="11" fontWeight="bold">
          Eje Z: Constancia
        </text>

        {/* Nube de puntos 3D ordenada por profundidad Z */}
        {projectedPoints.map((pt, i) => {
          const r = Math.max(2.6, Math.min(5.5, 3.8 + pt.depth * 0.22))
          return (
            <circle
              key={`${pt.id}-${i}`}
              cx={pt.sx}
              cy={pt.sy}
              r={r}
              fill={colorByClass[pt.clase] ?? '#38bdf8'}
              opacity={0.78}
              stroke="#070911"
              strokeWidth={0.7}
            />
          )
        })}
      </svg>
    </div>
  )
}

// ============================================================================
// 5. GRAFICA DE RADAR PENTAGONAL DE COMPETENCIAS (RADAR CHART SVG)
// ============================================================================

export function CompetencyRadarChartSvg({
  rows,
}: {
  rows: MlCompetenciaDossierRow[]
}) {
  const cx = 185
  const cy = 135
  const radius = 92
  const n = Math.max(3, rows.length)

  const angleFor = (idx: number) => -Math.PI / 2 + (idx * 2 * Math.PI) / n
  const pointFor = (idx: number, val10: number) => {
    const a = angleFor(idx)
    const r = (Math.min(10, Math.max(0, val10)) / 10) * radius
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
    }
  }

  const polyE1 = rows
    .map((r, i) => {
      const p = pointFor(i, r.etapa1)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')

  const polyE3 = rows
    .map((r, i) => {
      const p = pointFor(i, r.etapa3)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#070911] p-4">
      <p className="text-sm font-bold text-white">
        Radar de Evolucion por Competencia (Etapa 1 vs Etapa 3)
      </p>
      <p className="mb-2 text-xs text-slate-400">
        Comparacion poligonal entre el diagnostico inicial y el desempeno en entrevista STAR
      </p>
      <svg
        viewBox="0 0 380 265"
        className="h-auto w-full min-w-[330px]"
        role="img"
        aria-label="Radar pentagonal de competencias del candidato"
      >
        {[2.5, 5, 7.5, 10].map((lvl) => {
          const ringPts = rows
            .map((_, i) => {
              const p = pointFor(i, lvl)
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
            })
            .join(' ')
          return (
            <polygon
              key={lvl}
              points={ringPts}
              fill="none"
              stroke="rgba(148,163,184,0.18)"
              strokeDasharray="3 3"
            />
          )
        })}

        {rows.map((r, i) => {
          const end = pointFor(i, 10)
          const labelPt = pointFor(i, 12.1)
          return (
            <g key={r.competencia}>
              <line
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                stroke="rgba(148,163,184,0.22)"
              />
              <text
                x={labelPt.x}
                y={labelPt.y + 3}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="9"
                fontWeight="bold"
              >
                {r.competencia}
              </text>
            </g>
          )
        })}

        <polygon
          points={polyE1}
          fill="rgba(56,189,248,0.18)"
          stroke="#38bdf8"
          strokeWidth={2}
        />
        <polygon
          points={polyE3}
          fill="rgba(255,106,0,0.26)"
          stroke="#ff6a00"
          strokeWidth={2.4}
        />
      </svg>
    </div>
  )
}

// ============================================================================
// 6. VISTAS PRINCIPALES INTEGRADAS EN EL LABORATORIO EMPRESARIAL
// ============================================================================

export function AuraTalentBigDataViews({
  mode,
}: {
  mode: 'spark_100k' | 'cnn_1d' | 'dossier_integral'
}) {
  const { data: suiteData, isLoading, refetch } = useQuery({
    queryKey: ['aura', 'ml-lab', 'talent-suite'],
    queryFn: auraApi.mlLabTalentSuite,
  })

  // Estado del simulador CNN 1D en vivo
  const [e1Cv, setE1Cv] = useState(6.5)
  const [e2Tec, setE2Tec] = useState(7.8)
  const [constE1, setConstE1] = useState(82)
  const [constE2, setConstE2] = useState(88)

  const cnnMutation = useMutation({
    mutationFn: auraApi.mlLabCnnTrajectory,
  })

  const scheduleCnnSim = useDebouncedCallback(
    (next: {
      etapa1_cv: number
      etapa2_tecnica: number
      constancia_e1: number
      constancia_e2: number
    }) => {
      cnnMutation.mutate(next)
    },
    350,
  )

  // Estado del Expediente Integral del Candidato
  const [candId, setCandId] = useState('AURA-2026-001')
  const [candNombre, setCandNombre] = useState('Valeria Mendoza')
  const [candRol, setCandRol] = useState('Full Stack Developer')
  const [candHoras, setCandHoras] = useState(6.5)
  const [candEvidencias, setCandEvidencias] = useState(18)
  const [candParticipacion, setCandParticipacion] = useState(78)
  const [compRows, setCompRows] = useState<MlCompetenciaDossierRow[]>([
    {
      competencia: 'Arquitectura y Codigo',
      evaluador: 'Mentor Tecnico',
      etapa1: 7.8,
      etapa2: 8.4,
      etapa3: 8.9,
      sesiones_programadas: 12,
      sesiones_cumplidas: 11,
    },
    {
      competencia: 'Algoritmos y Logica',
      evaluador: 'Laboratorio IA',
      etapa1: 7.2,
      etapa2: 8.0,
      etapa3: 8.5,
      sesiones_programadas: 10,
      sesiones_cumplidas: 9,
    },
    {
      competencia: 'Calidad de CV y ATS',
      evaluador: 'Analizador CV',
      etapa1: 8.0,
      etapa2: 8.6,
      etapa3: 9.1,
      sesiones_programadas: 6,
      sesiones_cumplidas: 6,
    },
    {
      competencia: 'Comunicacion STAR',
      evaluador: 'Coach Entrevista',
      etapa1: 6.9,
      etapa2: 7.7,
      etapa3: 8.3,
      sesiones_programadas: 8,
      sesiones_cumplidas: 7,
    },
    {
      competencia: 'Portafolio y Evidencias',
      evaluador: 'Revisor Senior',
      etapa1: 7.5,
      etapa2: 8.2,
      etapa3: 8.7,
      sesiones_programadas: 10,
      sesiones_cumplidas: 9,
    },
  ])

  const dossierMutation = useMutation({
    mutationFn: auraApi.mlLabEvaluateDossier,
    onSuccess: () => {
      toast.success('Expediente de candidato evaluado y registrado en el historial.')
    },
  })

  if (isLoading || !suiteData) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 p-8">
        <AuraLoader />
        <p className="text-sm text-graphite-300">
          Cargando la simulacion de 100,000 perfiles...
        </p>
      </div>
    )
  }

  const spark: MlTalentSuiteResponse['spark_100k'] = suiteData.spark_100k
  const cnnBench: MlTalentSuiteResponse['cnn_benchmark'] = suiteData.cnn_benchmark
  const activeCnnSim: MlCnnTrajectorySimulation =
    cnnMutation.data ?? suiteData.cnn_simulacion_inicial
  const activeDossier: MlDossierEvaluationResponse =
    dossierMutation.data ?? suiteData.expediente_integral

  // -------------------------------------------------------------------------
  // VISTA A: INYECCION Y PROCESAMIENTO MASIVO PYSPARK (100,000 REGISTROS)
  // -------------------------------------------------------------------------
  if (mode === 'spark_100k') {
    const trayColors: Record<string, string> = {
      'En Ascenso': '#10b981',
      Estable: '#38bdf8',
      'Requiere Refuerzo': '#f43f5e',
    }
    const empColors: Record<string, string> = {
      'Listo para Vacante': '#ff7a1a',
      'En Preparacion': '#64748b',
    }

    return (
      <div className="flex flex-col gap-6">
        {/* KPIs del motor PySpark de 100,000 registros */}
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-6">
          <div className="neo-inset rounded-xl p-3.5">
            <p className="text-xs text-graphite-400">Registros Procesados</p>
            <p className="mt-1 font-mono text-lg font-bold text-aura-400">
              {spark.validaciones_integridad.registros_encontrados.toLocaleString()}
            </p>
            <p className="text-xs text-graphite-400">
              {spark.configuracion.total_candidatos.toLocaleString()} candidatos × 5 competencias
            </p>
          </div>
          <div className="neo-inset rounded-xl p-3.5">
            <p className="text-xs text-graphite-400">Partes del procesamiento</p>
            <p className="mt-1 font-mono text-lg font-bold text-bone">
              {spark.configuracion.num_particiones} particiones
            </p>
            <p className="text-xs text-graphite-400">
              {spark.tiempo_procesamiento_ms} ms en memoria
            </p>
          </div>
          <div className="neo-inset rounded-xl p-3.5">
            <p className="text-xs text-graphite-400">Integridad de Datos</p>
            <p className="mt-1 font-mono text-lg font-bold text-success">
              0 nulos · 0 dup
            </p>
            <p className="text-xs text-graphite-400">
              {spark.validaciones_integridad.estado}
            </p>
          </div>
          <div className="neo-inset rounded-xl p-3.5">
            <p className="text-xs text-graphite-400">Indice Promedio Global</p>
            <p className="mt-1 font-mono text-lg font-bold text-bone">
              {spark.kpis_globales.indice_preparacion_promedio} / 10
            </p>
            <p className="text-xs text-graphite-400">
              Constancia: {spark.kpis_globales.constancia_promedio_pct}%
            </p>
          </div>
          <div className="neo-inset rounded-xl p-3.5">
            <p className="text-xs text-graphite-400">Listos para Vacante</p>
            <p className="mt-1 font-mono text-lg font-bold text-success">
              {spark.kpis_globales.total_listos_vacante.toLocaleString()}
            </p>
            <p className="text-xs text-graphite-400">
              {spark.kpis_globales.tasa_listos_pct}% del lote masivo
            </p>
          </div>
          <div className="neo-inset rounded-xl p-3.5">
            <p className="text-xs text-graphite-400">Trayectoria en Ascenso</p>
            <p className="mt-1 font-mono text-lg font-bold text-sky-300">
              {spark.kpis_globales.total_en_ascenso.toLocaleString()}
            </p>
            <p className="text-xs text-graphite-400">
              {spark.kpis_globales.porcentaje_en_ascenso}% evolucion positiva
            </p>
          </div>
        </div>

        {/* Barra de acciones y descarga CSV de Spark */}
        <div className="neo-inset flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-aura-400" aria-hidden="true" />
            <div>
              <h4 className="font-display text-sm font-bold text-bone">
                Procesamiento distribuido (lote {spark.lote_id}) — {spark.motor}
              </h4>
              <p className="text-xs text-graphite-300">
                Esquema definido de 15 campos, validacion de rangos y escritura particionada por competencia.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AuraButton
              size="sm"
              variant="neo"
              icon={RefreshCw}
              onClick={() => refetch()}
            >
              Verificar Lote 100K
            </AuraButton>
            <AuraButton
              size="sm"
              variant="neo"
              icon={Download}
              onClick={() => {
                downloadCsv('aura_spark_100k_competencias.csv', spark.resumen_csv)
                toast.success('Resumen distribuido de 100,000 registros descargado.')
              }}
            >
              Descargar resumen (CSV)
            </AuraButton>
            <AuraButton
              size="sm"
              variant="neo"
              icon={Download}
              onClick={() => {
                downloadCsv('aura_spark_100k_muestra.csv', spark.muestra_csv)
                toast.success('Muestra de registros descargada.')
              }}
            >
              Descargar muestra (CSV)
            </AuraButton>
          </div>
        </div>

        {/* Fila 1 de Graficas: 2 Graficas de Pastel/Dona */}
        <div className="grid gap-5 lg:grid-cols-2">
          <DonutChartSvg
            title="Grafica de Pastel / Dona — Trayectoria de Evolucion (100,000 Registros)"
            subtitle="Clasificacion del cambio entre Etapa 1 (Filtro CV) y Etapa 3 (Entrevista STAR)"
            slices={spark.distribucion_trayectorias.map((d) => ({
              label: d.categoria,
              value: d.cantidad,
              pct: d.porcentaje,
              color: trayColors[d.categoria] ?? '#38bdf8',
            }))}
          />
          <DonutChartSvg
            title="Grafica de Pastel / Dona — Estado de Empleabilidad Estimado"
            subtitle="Candidatos que superan el umbral integral (>= 7.0 y constancia >= 70%)"
            slices={spark.distribucion_empleabilidad.map((d) => ({
              label: d.estado,
              value: d.cantidad,
              pct: d.porcentaje,
              color: empColors[d.estado] ?? '#ff7a1a',
            }))}
          />
        </div>

        {/* Fila 2: Histograma de 20 intervalos + Modelo 3D Interactivo */}
        <div className="grid gap-5 lg:grid-cols-2">
          <HistogramChartSvg
            title="Histograma de Distribucion del Indice de Preparacion (100,000 Evaluaciones)"
            subtitle="20 intervalos de 0.5 puntos; en verde los registros listos para vacante (>= 7.0)"
            bins={spark.histograma_preparacion}
            thresholdIndex={14}
            thresholdLabel="Umbral Listo (7.0)"
          />
          <Interactive3DPointCloudSvg points={spark.nube_3d} />
        </div>

        {/* Fila 3: Grafica de Triangulo Baricentrico + Piramide Triangular */}
        <div className="grid gap-5 lg:grid-cols-2">
          <TernaryTriangleChartSvg
            points={spark.puntos_ternarios}
            activePoint={{
              ...activeCnnSim.clasificacion_trayectoria_cnn.coordenada_ternaria,
              label: 'Simulacion Actual',
            }}
          />
          <PyramidChartSvg levels={spark.piramide_madurez} />
        </div>

        {/* Fila 4: Tabla agregada por Competencia + Tabla de las 8 Particiones Spark */}
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
            <span className="hud-label flex items-center gap-2 text-aura-400">
              <TableIcon className="h-4 w-4" aria-hidden="true" />
              Estadisticas por competencia (agrupadas automaticamente)
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 uppercase text-graphite-400">
                    <th className="py-2 pr-2">Competencia</th>
                    <th className="py-2 pr-2 text-right">Registros</th>
                    <th className="py-2 pr-2 text-right">Etapa 1</th>
                    <th className="py-2 pr-2 text-right">Etapa 2</th>
                    <th className="py-2 pr-2 text-right">Etapa 3</th>
                    <th className="py-2 pr-2 text-right">Promedio</th>
                    <th className="py-2 text-right">% Listos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {spark.resumen_competencias.map((row) => (
                    <tr key={row.competencia}>
                      <td className="py-2 pr-2 font-sans font-semibold text-bone">
                        {row.competencia}
                      </td>
                      <td className="py-2 pr-2 text-right text-graphite-300">
                        {row.registros.toLocaleString()}
                      </td>
                      <td className="py-2 pr-2 text-right text-graphite-300">
                        {row.etapa1_promedio}
                      </td>
                      <td className="py-2 pr-2 text-right text-sky-300">
                        {row.etapa2_promedio}
                      </td>
                      <td className="py-2 pr-2 text-right text-aura-300">
                        {row.etapa3_promedio}
                      </td>
                      <td className="py-2 pr-2 text-right font-bold text-bone">
                        {row.indice_promedio}
                      </td>
                      <td className="py-2 text-right font-bold text-success">
                        {row.tasa_listos_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="neo-inset flex flex-col gap-3 rounded-2xl p-4">
            <span className="hud-label flex items-center gap-2 text-aura-400">
              <Layers className="h-4 w-4" aria-hidden="true" />
              Reparto del trabajo en las 8 particiones
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 uppercase text-graphite-400">
                    <th className="py-2 pr-2">Particion</th>
                    <th className="py-2 pr-2 text-right">Filas</th>
                    <th className="py-2 pr-2 text-right">Indice</th>
                    <th className="py-2 text-right">% Listos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {spark.resumen_particiones.map((p) => (
                    <tr key={p.particion}>
                      <td className="py-2 pr-2 font-sans font-semibold text-bone">
                        {p.particion}
                      </td>
                      <td className="py-2 pr-2 text-right text-graphite-300">
                        {p.registros.toLocaleString()}
                      </td>
                      <td className="py-2 pr-2 text-right text-aura-300">
                        {p.indice_promedio}
                      </td>
                      <td className="py-2 text-right text-success">
                        {p.tasa_listos_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // VISTA B: RED NEURONAL CONVOLUCIONAL 1D (CNN 1D) VS RANDOM FOREST
  // -------------------------------------------------------------------------
  if (mode === 'cnn_1d') {
    const clf = cnnBench.clasificacion_trayectoria
    const reg = cnnBench.regresion_etapa3

    return (
      <div className="flex flex-col gap-6">
        {/* KPIs de la CNN 1D */}
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-5">
          <div className="neo-inset rounded-xl p-3.5">
            <p className="text-xs text-graphite-400">Modelo Ganador (3 Clases)</p>
            <p className="mt-1 font-display text-base font-bold text-success">
              {clf.ganador}
            </p>
            <p className="text-xs text-graphite-400">
              F1 Macro: {clf.comparacion_modelos[0]?.f1_macro_pct}%
            </p>
          </div>
          <div className="neo-inset rounded-xl p-3.5">
            <p className="text-xs text-graphite-400">Division por candidato</p>
            <p className="mt-1 font-mono text-base font-bold text-bone">
              70K / 15K / 15K
            </p>
            <p className="text-xs text-graphite-400">
              {cnnBench.split.candidatos_compartidos} candidatos compartidos
            </p>
          </div>
          <div className="neo-inset rounded-xl p-3.5">
            <p className="text-xs text-graphite-400">MAE Regresion Etapa 3</p>
            <p className="mt-1 font-mono text-base font-bold text-aura-400">
              {reg.metricas_cnn.mae} pts
            </p>
            <p className="text-xs text-graphite-400">
              Modelo base: {reg.metricas_modelo_base.mae} pts
            </p>
          </div>
          <div className="neo-inset rounded-xl p-3.5">
            <p className="text-xs text-graphite-400">Ajuste de la red neuronal</p>
            <p className="mt-1 font-mono text-base font-bold text-success">
              {(reg.metricas_cnn.r2 * 100).toFixed(1)}% (R²={reg.metricas_cnn.r2})
            </p>
            <p className="text-xs text-graphite-400">
              RMSE: {reg.metricas_cnn.rmse}
            </p>
          </div>
          <div className="neo-inset rounded-xl p-3.5">
            <p className="text-xs text-graphite-400">Mejora vs Modelo Base</p>
            <p className="mt-1 font-mono text-base font-bold text-sky-300">
              -{reg.metricas_modelo_base.mejora_mae_pct}% error
            </p>
            <p className="text-xs text-graphite-400">
              Sin fuga del Parcial/Etapa 3
            </p>
          </div>
        </div>

        {/* Simulador en vivo de la CNN 1D + Triangulo Ternario en vivo */}
        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <div className="neo-inset flex flex-col justify-between gap-4 rounded-2xl p-5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="hud-label flex items-center gap-2 text-aura-400">
                  <Cpu className="h-4 w-4" aria-hidden="true" />
                  Simulador en vivo (predice la etapa 3 a partir de las etapas 1 y 2)
                </span>
                <AuraBadge tone="success">Inferencia en Tiempo Real</AuraBadge>
              </div>
              <p className="mt-1 text-xs text-graphite-300">
                La red neuronal recibe solo las etapas 1 y 2, sin ver la etapa 3, estima el puntaje esperado en la entrevista y clasifica la trayectoria.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-graphite-300">
                    Etapa 1 (Filtro CV/ATS): <strong className="text-bone">{e1Cv} / 10</strong>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.2}
                    value={e1Cv}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setE1Cv(v)
                      scheduleCnnSim({
                        etapa1_cv: v,
                        etapa2_tecnica: e2Tec,
                        constancia_e1: constE1,
                        constancia_e2: constE2,
                      })
                    }}
                    className="accent-aura-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-graphite-300">
                    Etapa 2 (Prueba Tecnica): <strong className="text-bone">{e2Tec} / 10</strong>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.2}
                    value={e2Tec}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setE2Tec(v)
                      scheduleCnnSim({
                        etapa1_cv: e1Cv,
                        etapa2_tecnica: v,
                        constancia_e1: constE1,
                        constancia_e2: constE2,
                      })
                    }}
                    className="accent-aura-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-graphite-300">
                    Constancia Etapa 1: <strong className="text-bone">{constE1}%</strong>
                  </label>
                  <input
                    type="range"
                    min={30}
                    max={100}
                    step={2}
                    value={constE1}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setConstE1(v)
                      scheduleCnnSim({
                        etapa1_cv: e1Cv,
                        etapa2_tecnica: e2Tec,
                        constancia_e1: v,
                        constancia_e2: constE2,
                      })
                    }}
                    className="accent-aura-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-graphite-300">
                    Constancia Etapa 2: <strong className="text-bone">{constE2}%</strong>
                  </label>
                  <input
                    type="range"
                    min={30}
                    max={100}
                    step={2}
                    value={constE2}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setConstE2(v)
                      scheduleCnnSim({
                        etapa1_cv: e1Cv,
                        etapa2_tecnica: e2Tec,
                        constancia_e1: constE1,
                        constancia_e2: v,
                      })
                    }}
                    className="accent-aura-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-aura-500/40 bg-aura-500/10 p-3.5">
                <p className="text-xs font-semibold text-graphite-300">
                  Etapa 3 (entrevista) estimada por la red neuronal
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-aura-400">
                  {activeCnnSim.prediccion_regresion_etapa3.etapa3_estimada} / 10
                </p>
                <p className="mt-1 text-xs text-graphite-300">
                  Intervalo: [{activeCnnSim.prediccion_regresion_etapa3.intervalo_confianza[0]} -{' '}
                  {activeCnnSim.prediccion_regresion_etapa3.intervalo_confianza[1]}]
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                <p className="text-xs font-semibold text-graphite-300">
                  Trayectoria estimada por la red neuronal
                </p>
                <p className="mt-1 font-display text-lg font-bold text-success">
                  {activeCnnSim.clasificacion_trayectoria_cnn.trayectoria}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 font-mono text-xs text-graphite-300">
                  {Object.entries(
                    activeCnnSim.clasificacion_trayectoria_cnn.probabilidades_pct,
                  ).map(([k, v]) => (
                    <span key={k}>
                      {k}: <strong>{v}%</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <TernaryTriangleChartSvg
            points={spark.puntos_ternarios}
            activePoint={{
              ...activeCnnSim.clasificacion_trayectoria_cnn.coordenada_ternaria,
              label: `E3 est: ${activeCnnSim.prediccion_regresion_etapa3.etapa3_estimada}`,
            }}
          />
        </div>

        {/* Histograma del Error Absoluto de Regresion + Comparacion CNN 1D vs Random Forest */}
        <div className="grid gap-5 lg:grid-cols-2">
          <HistogramChartSvg
            title="Histograma del error de la red neuronal en prueba (15,000 muestras)"
            subtitle="Diferencia entre la calificacion real y la estimada"
            bins={reg.histograma_errores}
            barColor="#38bdf8"
          />

          <div className="neo-inset flex flex-col justify-between gap-3 rounded-2xl p-4">
            <div>
              <span className="hud-label flex items-center gap-2 text-aura-400">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Comparacion justa: red neuronal vs Random Forest (misma division de datos)
              </span>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 uppercase text-graphite-400">
                      <th className="py-2 pr-2">Modelo</th>
                      <th className="py-2 pr-2 text-right">Exactitud</th>
                      <th className="py-2 pr-2 text-right">Precision</th>
                      <th className="py-2 pr-2 text-right">Recall</th>
                      <th className="py-2 text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {clf.comparacion_modelos.map((m, idx) => (
                      <tr key={m.modelo} className={cn(idx === 0 && 'bg-emerald-500/10')}>
                        <td className="py-2.5 pr-2 font-sans">
                          <p className="font-bold text-bone">{m.modelo}</p>
                          <p className="text-xs text-graphite-400">{m.formato_entrada}</p>
                        </td>
                        <td className="py-2.5 pr-2 text-right text-aura-300">
                          {m.accuracy_pct}%
                        </td>
                        <td className="py-2.5 pr-2 text-right text-sky-300">
                          {m.precision_macro_pct}%
                        </td>
                        <td className="py-2.5 pr-2 text-right text-purple-300">
                          {m.recall_macro_pct}%
                        </td>
                        <td className="py-2.5 text-right font-bold text-success">
                          {m.f1_macro_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <AuraButton
                size="sm"
                variant="neo"
                icon={Download}
                onClick={() => {
                  downloadCsv('comparacion_cnn1d_vs_rf.csv', clf.comparacion_csv)
                  toast.success('Comparacion descargada.')
                }}
              >
                Descargar comparacion (CSV)
              </AuraButton>
              <AuraButton
                size="sm"
                variant="neo"
                icon={Download}
                onClick={() => {
                  downloadCsv('predicciones_etapa3_cnn1d.csv', reg.predicciones_csv)
                  toast.success('Predicciones de prueba descargadas.')
                }}
              >
                Predicciones etapa 3 (CSV)
              </AuraButton>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // VISTA C: EXPEDIENTE INTEGRAL DE COMPETENCIAS Y MOTOR DE RECOMENDACIONES
  // -------------------------------------------------------------------------
  const ev = activeDossier.evaluacion_actual
  const agg = activeDossier.agregaciones

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs de las Consultas Inteligentes de Agregacion */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-5">
        <div className="neo-inset rounded-xl p-3.5">
          <p className="text-xs text-graphite-400">Candidatos Unicos</p>
          <p className="mt-1 font-mono text-lg font-bold text-bone">
            {agg.estadisticas_generales.candidatos_unicos}
          </p>
          <p className="text-xs text-graphite-400">
            {agg.estadisticas_generales.total_evaluaciones} evaluaciones totales
          </p>
        </div>
        <div className="neo-inset rounded-xl p-3.5">
          <p className="text-xs text-graphite-400">Probabilidad Media Avance</p>
          <p className="mt-1 font-mono text-lg font-bold text-aura-400">
            {agg.estadisticas_generales.promedio_probabilidad_listo_pct}%
          </p>
          <p className="text-xs text-graphite-400">Modelo supervisado</p>
        </div>
        <div className="neo-inset rounded-xl p-3.5">
          <p className="text-xs text-graphite-400">Perfiles Listos</p>
          <p className="mt-1 font-mono text-lg font-bold text-success">
            {agg.estadisticas_generales.total_listos_estimados}
          </p>
          <p className="text-xs text-graphite-400">
            Constancia media: {agg.estadisticas_generales.promedio_constancia_pct}%
          </p>
        </div>
        <div className="neo-inset rounded-xl p-3.5">
          <p className="text-xs text-graphite-400">Requieren refuerzo</p>
          <p className="mt-1 font-mono text-lg font-bold text-warning">
            {agg.estadisticas_generales.total_requiere_refuerzo} (
            {agg.estadisticas_generales.porcentaje_refuerzo}%)
          </p>
          <p className="text-xs text-graphite-400">Prioridad de acompanamiento</p>
        </div>
        <div className="neo-inset rounded-xl p-3.5">
          <p className="text-xs text-graphite-400">Segmento K-Means Actual</p>
          <p className="mt-1 font-display text-base font-bold text-sky-300">
            {ev.perfil}
          </p>
          <p className="text-xs text-graphite-400">
            PCA: ({ev.PC1}, {ev.PC2})
          </p>
        </div>
      </div>

      {/* Formulario de Expediente del Candidato + Radar de Competencias */}
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="neo-inset flex flex-col gap-4 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="hud-label flex items-center gap-2 text-aura-400">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Expediente Permanente del Candidato y Matriz de Competencias
            </span>
            <AuraButton
              size="sm"
              variant="primary"
              icon={CheckCircle2}
              disabled={dossierMutation.isPending}
              onClick={() =>
                dossierMutation.mutate({
                  id_candidato: candId,
                  nombre_completo: candNombre,
                  rol_objetivo: candRol,
                  seniority: 'Junior / Mid',
                  modalidad: 'Hibrido',
                  horas_practica: candHoras,
                  evidencias_entregadas: candEvidencias,
                  participacion_pct: candParticipacion,
                  competencias: compRows,
                })
              }
            >
              Evaluar Expediente con IA (RF + K-Means + PCA)
            </AuraButton>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-graphite-400">ID Permanente</span>
              <input
                type="text"
                value={candId}
                onChange={(e) => setCandId(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/20 px-2.5 py-1.5 font-mono text-xs text-bone"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-graphite-400">Nombre del Candidato</span>
              <input
                type="text"
                value={candNombre}
                onChange={(e) => setCandNombre(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/20 px-2.5 py-1.5 text-xs text-bone"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-graphite-400">Rol Objetivo</span>
              <input
                type="text"
                value={candRol}
                onChange={(e) => setCandRol(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/20 px-2.5 py-1.5 text-xs text-bone"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-graphite-400">
                Horas practica/sem: <strong className="text-bone">{candHoras}h</strong>
              </span>
              <input
                type="range"
                min={1}
                max={16}
                step={0.5}
                value={candHoras}
                onChange={(e) => setCandHoras(Number(e.target.value))}
                className="accent-aura-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-graphite-400">
                Evidencias (0-30): <strong className="text-bone">{candEvidencias}</strong>
              </span>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={candEvidencias}
                onChange={(e) => setCandEvidencias(Number(e.target.value))}
                className="accent-aura-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-graphite-400">
                Participacion STAR: <strong className="text-bone">{candParticipacion}%</strong>
              </span>
              <input
                type="range"
                min={10}
                max={100}
                step={2}
                value={candParticipacion}
                onChange={(e) => setCandParticipacion(Number(e.target.value))}
                className="accent-aura-500"
              />
            </label>
          </div>

          {/* Tabla editable de competencias */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 uppercase text-graphite-400">
                  <th className="py-1.5 pr-2">Competencia</th>
                  <th className="py-1.5 pr-2 text-right">Etapa 1</th>
                  <th className="py-1.5 pr-2 text-right">Etapa 2</th>
                  <th className="py-1.5 pr-2 text-right">Etapa 3</th>
                  <th className="py-1.5 pr-2 text-right">Sesiones</th>
                  <th className="py-1.5 pr-2 text-right">Cumplidas</th>
                  <th className="py-1.5 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {compRows.map((r, idx) => (
                  <tr key={idx}>
                    <td className="py-1.5 pr-2 font-sans">
                      <input
                        type="text"
                        value={r.competencia}
                        onChange={(e) => {
                          const next = [...compRows]
                          next[idx] = { ...r, competencia: e.target.value }
                          setCompRows(next)
                        }}
                        className="w-full rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-bone"
                      />
                    </td>
                    {(['etapa1', 'etapa2', 'etapa3'] as const).map((field) => (
                      <td key={field} className="py-1.5 pr-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.5}
                          value={r[field]}
                          onChange={(e) => {
                            const next = [...compRows]
                            next[idx] = { ...r, [field]: Number(e.target.value) }
                            setCompRows(next)
                          }}
                          className="w-16 rounded border border-white/10 bg-black/20 px-1.5 py-1 text-right text-xs text-bone"
                        />
                      </td>
                    ))}
                    <td className="py-1.5 pr-2 text-right">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={r.sesiones_programadas}
                        onChange={(e) => {
                          const next = [...compRows]
                          next[idx] = {
                            ...r,
                            sesiones_programadas: Number(e.target.value),
                          }
                          setCompRows(next)
                        }}
                        className="w-14 rounded border border-white/10 bg-black/20 px-1.5 py-1 text-right text-xs text-bone"
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={r.sesiones_programadas}
                        value={r.sesiones_cumplidas}
                        onChange={(e) => {
                          const next = [...compRows]
                          next[idx] = {
                            ...r,
                            sesiones_cumplidas: Number(e.target.value),
                          }
                          setCompRows(next)
                        }}
                        className="w-14 rounded border border-white/10 bg-black/20 px-1.5 py-1 text-right text-xs text-bone"
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      {compRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCompRows(compRows.filter((_, i) => i !== idx))
                          }
                          className="text-graphite-400 hover:text-danger"
                          title="Quitar competencia"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <AuraButton
              size="sm"
              variant="ghost"
              icon={Plus}
              onClick={() =>
                setCompRows([
                  ...compRows,
                  {
                    competencia: 'Diseno de Sistemas Cloud',
                    evaluador: 'Mentor AURA',
                    etapa1: 7.5,
                    etapa2: 8.2,
                    etapa3: 8.8,
                    sesiones_programadas: 8,
                    sesiones_cumplidas: 8,
                  },
                ])
              }
            >
              Agregar Competencia al Expediente
            </AuraButton>
            <div className="flex gap-2">
              <AuraButton
                size="sm"
                variant="neo"
                icon={Download}
                onClick={() => {
                  downloadCsv('aura_historial_evaluaciones.csv', agg.historico_csv)
                  toast.success('Historial de evaluaciones descargado.')
                }}
              >
                Descargar historial (CSV)
              </AuraButton>
              <AuraButton
                size="sm"
                variant="neo"
                icon={Download}
                onClick={() => {
                  downloadCsv('aura_casos_refuerzo.csv', agg.riesgos_csv)
                  toast.success('Reporte de casos que requieren refuerzo descargado.')
                }}
              >
                Descargar casos a reforzar (CSV)
              </AuraButton>
            </div>
          </div>
        </div>

        {/* Radar de Competencias + 6 Recomendaciones Personalizadas */}
        <div className="flex flex-col gap-4">
          <CompetencyRadarChartSvg rows={compRows} />

          <div className="neo-inset flex flex-col gap-2.5 rounded-2xl p-4">
            <span className="hud-label flex items-center gap-2 text-aura-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Motor de 6 Reglas de Recomendacion de Empleabilidad
            </span>
            <div className="flex flex-col gap-2">
              {ev.recomendaciones.map((rec) => (
                <div
                  key={rec.dimension}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-bone">{rec.dimension}</span>
                    <AuraBadge
                      tone={
                        rec.nivel === 'Solido'
                          ? 'success'
                          : rec.nivel === 'Prioritario'
                            ? 'warning'
                            : 'info'
                      }
                    >
                      {rec.nivel}
                    </AuraBadge>
                  </div>
                  <p className="mt-1 text-graphite-300">{rec.accion}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
