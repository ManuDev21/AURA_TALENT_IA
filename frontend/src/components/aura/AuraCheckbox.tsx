import { Check } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId } from 'react'

interface AuraCheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: ReactNode
  error?: string
}

export function AuraCheckbox({ label, error, ref, ...props }: AuraCheckboxProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="group flex cursor-pointer items-start gap-3 text-sm text-graphite-300">
        <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            className="peer neo-inset h-5 w-5 cursor-pointer appearance-none rounded-md checked:bg-aura-500 checked:shadow-[0_0_14px_-2px_rgb(255_122_26/0.8)]"
            {...props}
          />
          <Check className="pointer-events-none absolute h-3.5 w-3.5 text-ink opacity-0 peer-checked:opacity-100" aria-hidden="true" />
        </span>
        <span className="group-hover:text-bone">{label}</span>
      </label>
      {error && (
        <p role="alert" className="pl-8 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
