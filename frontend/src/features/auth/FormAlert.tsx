import { CircleCheck, TriangleAlert } from 'lucide-react'
import { cn } from '@/utils/cn'

export function FormAlert({ message, tone = 'error' }: { message: string; tone?: 'error' | 'success' }) {
  if (!message) return null
  const Icon = tone === 'error' ? TriangleAlert : CircleCheck
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm',
        tone === 'error' ? 'border-danger/40 bg-danger/10 text-danger' : 'border-success/40 bg-success/10 text-success',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
