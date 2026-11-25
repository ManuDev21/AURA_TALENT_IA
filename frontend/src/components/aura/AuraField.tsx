import { type ComponentProps, type ReactNode, useId } from 'react'
import { cn } from '@/utils/cn'
import type { Option } from '@/utils/labels'

interface FieldShellProps {
  id: string
  label: string
  error?: string
  hint?: string
  className?: string
  children: ReactNode
}

const FIELD_BOX =
  'neo-inset rounded-xl px-3.5 transition-shadow duration-200 focus-within:shadow-[0_0_0_1px_rgb(255_122_26/0.6),0_0_22px_-6px_rgb(255_122_26/0.6)]'
const FIELD_ERROR = 'shadow-[0_0_0_1px_rgb(240_68_58/0.7)]'
const CONTROL =
  'w-full bg-transparent text-base text-bone placeholder:text-graphite-400 focus:outline-none focus-visible:shadow-none focus-visible:outline-none sm:text-[0.95rem]'

export function describedBy(id: string, error?: string, hint?: string): string | undefined {
  return [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
}

export function FieldShell({ id, label, error, hint, className, children }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="hud-label text-graphite-300">
        {label}
      </label>
      <div className={cn(FIELD_BOX, error && FIELD_ERROR)}>{children}</div>
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

interface TextareaProps extends ComponentProps<'textarea'> {
  label: string
  error?: string
  hint?: string
}

export function AuraTextarea({ label, error, hint, className, rows = 4, ...props }: TextareaProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} className={className}>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(CONTROL, 'resize-y py-3 leading-relaxed')}
        {...props}
      />
    </FieldShell>
  )
}

interface SelectProps extends ComponentProps<'select'> {
  label: string
  options: Option[]
  placeholder?: string
  error?: string
  hint?: string
}

export function AuraSelect({ label, options, placeholder = 'Seleccionar', error, hint, className, ...props }: SelectProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} className={className}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(CONTROL, 'h-12 cursor-pointer [&>option]:bg-graphite-900')}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}
