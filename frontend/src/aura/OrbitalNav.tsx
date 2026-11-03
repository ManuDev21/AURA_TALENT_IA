import { motion } from 'motion/react'
import { Link } from 'react-router'
import type { AuraModule } from '@/aura/modules'
import { useAuraStore } from '@/store/auraStore'
import { cn } from '@/utils/cn'
import type { AuraArea } from '@/utils/roles'

interface OrbitalNavProps {
  area: AuraArea
  modules: AuraModule[]
}

/** Navegacion radial: los modulos orbitan el AURA Core en una elipse. */
export function OrbitalNav({ area, modules }: OrbitalNavProps) {
  const rx = 40
  const ry = 31
  const cy = 46
  const setCoreState = useAuraStore((s) => s.setCoreState)

  return (
    <nav aria-label="Modulos de AURA" className="pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <ellipse cx="50" cy={cy} rx={rx} ry={ry} fill="none" stroke="rgb(255 122 26 / 0.12)" strokeWidth="0.15" strokeDasharray="0.6 0.9" vectorEffect="non-scaling-stroke" />
      </svg>
      <ul>
        {modules.map((module, i) => {
          const angle = (i / modules.length) * Math.PI * 2 - Math.PI / 2
          const left = 50 + Math.cos(angle) * rx
          const top = cy + Math.sin(angle) * ry
          const Icon = module.icon
          return (
            <motion.li
              key={module.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%`, top: `${top}%` }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <Link
                to={`/${area}/${module.id}`}
                onMouseEnter={() => setCoreState('LISTENING')}
                onMouseLeave={() => setCoreState('IDLE')}
                onFocus={() => setCoreState('LISTENING')}
                onBlur={() => setCoreState('IDLE')}
                className="group pointer-events-auto flex flex-col items-center gap-2 rounded-2xl p-2 focus-visible:outline-offset-4"
              >
                <span
                  className={cn(
                    'neo relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 ease-aura',
                    'group-hover:scale-110 group-hover:text-aura-400 group-hover:shadow-[0_0_30px_-4px_rgb(255_122_26/0.7)]',
                    module.available ? 'text-aura-400' : 'text-graphite-300',
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="absolute -right-1 -top-1 rounded-full bg-graphite-700 px-1.5 font-mono text-[0.6rem] text-graphite-300">
                    F{module.phase}
                  </span>
                </span>
                <span className="hud-label text-graphite-300 transition group-hover:text-bone">{module.label}</span>
              </Link>
            </motion.li>
          )
        })}
      </ul>
    </nav>
  )
}
