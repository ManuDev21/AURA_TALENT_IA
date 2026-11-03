import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ToastTone, useToastStore } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const TONE: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: 'text-success' },
  error: { icon: TriangleAlert, className: 'text-danger' },
  info: { icon: Info, className: 'text-aura-400' },
}

/** AuraNotification: avisos breves de resultado de acciones. */
export function AuraToaster() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-16 z-[66] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const { icon: Icon, className } = TONE[t.tone]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="glass pointer-events-auto flex items-start gap-3 rounded-xl p-3 text-sm"
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} aria-hidden="true" />
              <span className="flex-1 text-bone">{t.message}</span>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso" className="text-graphite-400 hover:text-bone">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
