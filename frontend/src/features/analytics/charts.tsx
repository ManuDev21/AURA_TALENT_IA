import { cn } from '@/utils/cn'

/** Tarjeta de indicador. */
export function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="neo-inset min-w-0 rounded-xl p-3">
      <p className="font-display text-xl text-aura-400 sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[0.62rem] font-bold uppercase leading-snug tracking-[0.08em] text-graphite-400 [overflow-wrap:anywhere]">{label}</p>
      {hint && <p className="mt-0.5 text-[0.65rem] text-graphite-500">{hint}</p>}
    </div>
  )
}

/** Barras horizontales con etiqueta y valor (accesibles como lista). */
export function HBars({ items, unit = '', max }: { items: { label: string; value: number; extra?: string }[]; unit?: string; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <p className="text-sm text-graphite-400">Sin datos todavia.</p>
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs">
          <span className="truncate text-graphite-300" title={i.label}>
            {i.label}
          </span>
          <span className="neo-inset h-2 overflow-hidden rounded-full">
            <span className="block h-full rounded-full bg-gradient-to-r from-amber-glow to-aura-600 transition-[width] duration-700" style={{ width: `${(i.value / top) * 100}%` }} />
          </span>
          <span className="w-24 text-right font-mono text-graphite-400">
            {i.value}
            {unit}
            {i.extra && <span className="text-graphite-500"> {i.extra}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Embudo: cada etapa se estrecha segun cuantos la alcanzaron; muestra la conversion desde la etapa previa. */
export function Funnel({ steps }: { steps: { label: string; count: number; rate_from_start: number; rate_from_previous: number }[] }) {
  return (
    <ol className="flex flex-col items-center gap-1.5" aria-label="Embudo de seleccion">
      {steps.map((s, i) => (
        <li key={s.label} className="w-full" style={{ maxWidth: `${Math.max(28, s.rate_from_start)}%` }}>
          <div
            className={cn(
              'flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs',
              s.count ? 'bg-gradient-to-r from-aura-600/80 to-amber-glow/70 text-ink' : 'bg-white/5 text-graphite-400',
            )}
          >
            <span className="truncate font-medium">{s.label}</span>
            <span className="font-mono">{s.count}</span>
          </div>
          {i > 0 && <p className="text-center font-mono text-[0.6rem] text-graphite-500">{s.rate_from_previous}% desde la etapa previa</p>}
        </li>
      ))}
    </ol>
  )
}

/** Columnas verticales para series temporales cortas. */
export function Columns({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="flex h-32 items-end gap-1.5" role="list" aria-label="Postulaciones por semana">
      {items.map((i) => (
        <div key={i.label} role="listitem" aria-label={`${i.label}: ${i.value}`} className="flex flex-1 flex-col items-center gap-1">
          <span className="font-mono text-[0.6rem] text-graphite-400">{i.value || ''}</span>
          <span className="w-full rounded-t-md bg-gradient-to-t from-aura-600 to-amber-glow" style={{ height: `${(i.value / max) * 88 + 2}px`, opacity: i.value ? 1 : 0.2 }} />
          <span className="font-mono text-[0.55rem] text-graphite-500">{i.label}</span>
        </div>
      ))}
    </div>
  )
}
