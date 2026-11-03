import { ChevronRight, Info } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '@/utils/cn'

interface AuraExplainProps {
  title?: string
  method: string
  dataUsed: string[]
  limitations: string[]
  disclaimer?: string
}

/** Bloque de IA explicable: por que, datos utilizados y limitaciones. */
export function AuraExplain({ title = 'Como se calcula', method, dataUsed, limitations, disclaimer }: AuraExplainProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02]">
      {disclaimer && (
        <p className="flex items-start gap-2 border-b border-white/5 px-4 py-3 text-xs text-amber-glow">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {disclaimer}
        </p>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs text-graphite-300 hover:text-bone"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} aria-hidden="true" />
        {title}
      </button>
      {open && (
        <div id={id} className="grid gap-4 px-4 pb-4 text-xs text-graphite-300 md:grid-cols-3">
          <section>
            <h4 className="hud-label mb-1.5 text-aura-400">Por que</h4>
            <p className="leading-relaxed">{method}</p>
          </section>
          <section>
            <h4 className="hud-label mb-1.5 text-aura-400">Datos utilizados</h4>
            <ul className="list-disc space-y-1 pl-4">
              {dataUsed.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="hud-label mb-1.5 text-aura-400">Limitaciones</h4>
            <ul className="list-disc space-y-1 pl-4">
              {limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
