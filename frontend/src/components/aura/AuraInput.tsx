import { Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { type ComponentProps, useId, useState } from 'react'
import { cn } from '@/utils/cn'

interface AuraInputProps extends ComponentProps<'input'> {
  label: string
  error?: string
  hint?: string
  icon?: LucideIcon
}

export function AuraInput({ label, error, hint, icon: Icon, type = 'text', className, ref, ...props }: AuraInputProps) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="hud-label text-graphite-300">
        {label}
      </label>
      <div
        className={cn(
          'neo-inset flex items-center gap-2.5 rounded-xl px-3.5 transition-shadow duration-200',
          'focus-within:shadow-[0_0_0_1px_rgb(255_122_26/0.6),0_0_22px_-6px_rgb(255_122_26/0.6)]',
          error && 'shadow-[0_0_0_1px_rgb(240_68_58/0.7)]',
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-graphite-400" aria-hidden="true" />}
        <input
          ref={ref}
          id={id}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-12 w-full bg-transparent text-base text-bone placeholder:text-graphite-400 focus:outline-none focus-visible:shadow-none focus-visible:outline-none sm:text-[0.95rem]"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="rounded-md p-1 text-graphite-400 hover:text-aura-400"
            aria-label={revealed ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            aria-pressed={revealed}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-graphite-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
