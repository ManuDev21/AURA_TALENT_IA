import { useState } from 'react'
import { useReducedMotion } from '@/hooks/useMediaQuery'
import type { MatchRequirement, RequirementStatus } from '@/types/match'
import { cn } from '@/utils/cn'

const STATUS_STYLE: Record<RequirementStatus, { stroke: string; fill: string; dash?: string; label: string }> = {
  met: { stroke: '#ff7a1a', fill: '#ff7a1a', label: 'Cumple' },
  partial: { stroke: '#ffb547', fill: '#ffb547', dash: '5 5', label: 'Parcial' },
  missing: { stroke: '#4a4a52', fill: '#2a2a30', dash: '2 6', label: 'Falta' },
}

interface Props {
  requirements: MatchRequirement[]
  score: number
  candidateLabel: string
  jobLabel: string
}

/** Nodos: candidato -> requisitos -> vacante. El color de cada conexion expresa si el requisito se cumple. */
export function MatchVisualization({ requirements, score, candidateLabel, jobLabel }: Props) {
  const reduced = useReducedMotion()
  const [hover, setHover] = useState<number | null>(null)
  const items = requirements.slice(0, 12)
  const W = 640
  const rowH = 34
  const H = Math.max(200, items.length * rowH + 40)
  const cy = H / 2
  const left = { x: 70, y: cy }
  const right = { x: W - 70, y: cy }
  const midX = W / 2
  const y = (i: number) => 20 + rowH / 2 + i * rowH + (H - 40 - items.length * rowH) / 2
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`

  return (
    <figure className="neo-inset overflow-hidden rounded-2xl p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Conexiones de compatibilidad: ${Math.round(score)} por ciento`}>
        <defs>
          <radialGradient id="mv-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd08a" />
            <stop offset="55%" stopColor="#ff7a1a" />
            <stop offset="100%" stopColor="#7a2e00" />
          </radialGradient>
          <filter id="mv-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {items.map((r, i) => {
          const s = STATUS_STYLE[r.status]
          const active = hover === null || hover === i
          return (
            <g key={`${r.kind}-${r.label}`} opacity={active ? 1 : 0.18} className="transition-opacity duration-200">
              {r.status !== 'missing' && (
                <path d={curve(left.x, left.y, midX - 8, y(i))} fill="none" stroke={s.stroke} strokeWidth={r.required ? 1.6 : 1} strokeDasharray={s.dash} className={cn(!reduced && r.status === 'met' && 'mv-flow')} />
              )}
              <path d={curve(midX + 8, y(i), right.x, right.y)} fill="none" stroke={s.stroke} strokeWidth={r.required ? 1.6 : 1} strokeDasharray={s.dash} opacity={0.8} />
              <circle cx={midX} cy={y(i)} r={r.required ? 6 : 4.5} fill={s.fill} stroke={s.stroke} filter={r.status === 'met' ? 'url(#mv-glow)' : undefined} />
              <text
                x={midX - 14}
                y={y(i) + 4}
                textAnchor="end"
                className="fill-graphite-300 font-mono text-[10px]"
                stroke="#0e0e11"
                strokeWidth={5}
                strokeLinejoin="round"
                style={{ paintOrder: 'stroke' }}
              >
                {r.label.length > 26 ? `${r.label.slice(0, 25)}...` : r.label}
              </text>
              <rect
                x={midX - 200}
                y={y(i) - rowH / 2}
                width={400}
                height={rowH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${r.label}: ${s.label}. ${r.detail}`}</title>
              </rect>
            </g>
          )
        })}

        <g>
          <circle cx={left.x} cy={left.y} r={26} fill="#16161a" stroke="#ff7a1a" strokeWidth={1.5} filter="url(#mv-glow)" />
          <circle cx={left.x} cy={left.y} r={9} fill="url(#mv-core)" className={cn(!reduced && 'mv-pulse')} />
          <text x={left.x} y={left.y + 44} textAnchor="middle" className="fill-bone text-[11px]">
            {candidateLabel}
          </text>
        </g>
        <g>
          <rect x={right.x - 26} y={right.y - 26} width={52} height={52} rx={12} fill="#16161a" stroke="#ffb547" strokeWidth={1.5} />
          <text x={right.x} y={right.y + 5} textAnchor="middle" className="fill-aura-400 font-display text-[15px]">
            {Math.round(score)}
          </text>
          <text x={right.x} y={right.y + 44} textAnchor="middle" className="fill-bone text-[11px]">
            {jobLabel.length > 22 ? `${jobLabel.slice(0, 21)}...` : jobLabel}
          </text>
        </g>
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-4 pb-1 text-[0.65rem] text-graphite-400">
        {(Object.keys(STATUS_STYLE) as RequirementStatus[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_STYLE[k].fill }} aria-hidden="true" />
            {STATUS_STYLE[k].label}
          </span>
        ))}
        <span>Nodo grande = requisito obligatorio</span>
      </figcaption>
      {/* Alternativa accesible a la visualizacion */}
      <ul className="sr-only">
        {items.map((r) => (
          <li key={`${r.kind}-${r.label}`}>{`${r.label}: ${STATUS_STYLE[r.status].label}. ${r.detail}`}</li>
        ))}
      </ul>
    </figure>
  )
}
