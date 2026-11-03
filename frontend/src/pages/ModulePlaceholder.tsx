import { Construction } from 'lucide-react'
import type { AuraModule } from '@/aura/modules'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraPanel } from '@/components/aura/AuraPanel'

export function ModulePlaceholder({ module }: { module: AuraModule }) {
  const Icon = module.icon
  return (
    <AuraPanel eyebrow={`Modulo  /  Fase ${module.phase}`} title={module.label}>
      <div className="flex items-start gap-4">
        <span className="neo flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-aura-400">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-graphite-300">{module.description}</p>
      </div>
      <div className="holo-line my-6 h-px" aria-hidden="true" />
      <div className="neo-inset flex items-center gap-3 rounded-xl p-4">
        <Construction className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="flex-1 text-sm text-graphite-300">
          Este modulo se construye en la <strong className="text-bone">Fase {module.phase}</strong> del plan de desarrollo.
          La navegacion, la seguridad y el nucleo de AURA ya estan activos.
        </div>
        <AuraBadge tone="warning">En construccion</AuraBadge>
      </div>
    </AuraPanel>
  )
}
