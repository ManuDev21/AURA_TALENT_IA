export function AuraLoader({ label = 'Cargando' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4">
      <div className="relative h-14 w-14" aria-hidden="true">
        <span className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-aura-500 [animation-duration:1.1s]" />
        <span className="absolute inset-2 animate-spin rounded-full border border-transparent border-b-amber-glow [animation-direction:reverse] [animation-duration:1.6s]" />
        <span className="absolute inset-[22px] rounded-full bg-aura-500 shadow-[0_0_18px_rgb(255_122_26/0.9)]" />
      </div>
      <span className="hud-label text-graphite-300">{label}</span>
    </div>
  )
}
