interface AuraProgressRingProps {
  value: number
  size?: number
  label: string
  sublabel?: string
}

export function AuraProgressRing({ value, size = 88, label, sublabel }: AuraProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#aura-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-aura"
          style={{ filter: 'drop-shadow(0 0 6px var(--color-aura-500))' }}
        />
        <defs>
          <linearGradient id="aura-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-aura-300)" />
            <stop offset="100%" stopColor="var(--color-aura-600)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-semibold text-bone">{clamped}%</span>
        {sublabel && <span className="hud-label text-[0.55rem] text-graphite-400">{sublabel}</span>}
      </div>
    </div>
  )
}
