import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function AuraEmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 px-6 py-8 text-center">
      <Icon className="h-6 w-6 text-graphite-400" aria-hidden="true" />
      <p className="text-sm text-bone">{title}</p>
      {children && <div className="text-xs text-graphite-400">{children}</div>}
    </div>
  )
}
