import { useMemo } from 'react'
import type { CandidateSkill } from '@/types/talent'
import { PROFICIENCY } from '@/utils/labels'

interface SkillConstellationProps {
  skills: CandidateSkill[]
  selectedId: string | null
  onSelect: (skillId: string) => void
}

const W = 640
const H = 380
const CX = W / 2
const CY = H / 2

interface NodeLayout {
  entry: CandidateSkill
  x: number
  y: number
  r: number
  ax: number
  ay: number
}

/** Constelacion de habilidades: cada categoria es un cumulo que orbita el nucleo. */
export function SkillConstellation({ skills, selectedId, onSelect }: SkillConstellationProps) {
  const { anchors, nodes } = useMemo(() => {
    const groups = new Map<string, CandidateSkill[]>()
    for (const entry of skills) {
      const key = entry.skill.category?.name ?? 'Otras'
      groups.set(key, [...(groups.get(key) ?? []), entry])
    }
    const names = [...groups.keys()].sort()
    const anchorList = names.map((name, i) => {
      const angle = (i / Math.max(names.length, 1)) * Math.PI * 2 - Math.PI / 2
      const spread = names.length === 1 ? 0 : 1
      return { name, x: CX + Math.cos(angle) * 200 * spread, y: CY + Math.sin(angle) * 118 * spread }
    })
    const nodeList: NodeLayout[] = []
    anchorList.forEach((anchor) => {
      const items = groups.get(anchor.name) ?? []
      const radius = 30 + items.length * 5
      items.forEach((entry, j) => {
        const angle = (j / items.length) * Math.PI * 2 + anchor.x * 0.01
        nodeList.push({
          entry,
          x: anchor.x + Math.cos(angle) * radius,
          y: anchor.y + Math.sin(angle) * radius * 0.8,
          r: 4 + entry.proficiency * 1.6,
          ax: anchor.x,
          ay: anchor.y,
        })
      })
    })
    return { anchors: anchorList, nodes: nodeList }
  }, [skills])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label="Constelacion de habilidades">
      <defs>
        <radialGradient id="star" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe2bf" />
          <stop offset="55%" stopColor="#ff9a4a" />
          <stop offset="100%" stopColor="#f05a00" stopOpacity="0.2" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={10} fill="url(#star)" />
      <circle cx={CX} cy={CY} r={22} fill="none" stroke="rgb(255 122 26 / 0.25)" strokeDasharray="2 4" />
      {anchors.map((a) => (
        <g key={a.name}>
          <line x1={CX} y1={CY} x2={a.x} y2={a.y} stroke="rgb(255 122 26 / 0.15)" strokeDasharray="3 5" />
          <text x={a.x} y={a.y - 50} textAnchor="middle" className="fill-graphite-400 font-mono text-[9px] uppercase tracking-[0.2em]">
            {a.name}
          </text>
        </g>
      ))}
      {nodes.map((n) => (
        <line key={`l-${n.entry.skill.id}`} x1={n.ax} y1={n.ay} x2={n.x} y2={n.y} stroke="rgb(255 179 71 / 0.18)" />
      ))}
      {nodes.map((n) => {
        const selected = n.entry.skill.id === selectedId
        const label = `${n.entry.skill.name}, nivel ${PROFICIENCY[n.entry.proficiency]}`
        return (
          <g
            key={n.entry.skill.id}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => onSelect(n.entry.skill.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(n.entry.skill.id)
              }
            }}
            className="cursor-pointer outline-none [&:focus-visible_circle.core]:stroke-bone"
          >
            <title>{label}</title>
            <circle cx={n.x} cy={n.y} r={n.r * 2.4} fill="rgb(255 122 26 / 0.08)" />
            <circle
              className="core transition-all"
              cx={n.x}
              cy={n.y}
              r={selected ? n.r + 2 : n.r}
              fill="url(#star)"
              stroke={selected ? '#f4f2ee' : 'transparent'}
              strokeWidth={1.5}
              style={{ filter: `drop-shadow(0 0 ${selected ? 10 : 5}px rgb(255 122 26 / 0.8))` }}
            />
            <text x={n.x} y={n.y + n.r + 12} textAnchor="middle" className="pointer-events-none fill-bone text-[10px]">
              {n.entry.skill.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
