import { LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'neo' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface AuraButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: LucideIcon
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-br from-aura-400 to-aura-600 text-white font-semibold shadow-[0_0_24px_-6px_var(--color-aura-500)] hover:shadow-[0_0_32px_-4px_var(--color-aura-400)] hover:brightness-110',
  neo: 'neo text-bone hover:text-aura-400 active:neo-inset',
  ghost: 'text-graphite-300 hover:text-bone hover:bg-white/5',
  danger: 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl justify-center',
}

export function AuraButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: AuraButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'btn-jelly inline-flex items-center justify-center transition-all duration-200 ease-aura select-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {children}
    </button>
  )
}
