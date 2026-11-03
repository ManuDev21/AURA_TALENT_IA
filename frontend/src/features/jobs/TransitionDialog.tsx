import { ShieldAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { applicationsApi, jobKeys } from '@/api/jobs'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraTextarea } from '@/components/aura/AuraField'
import { STAGE_LABELS } from '@/features/jobs/labels'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import type { Stage } from '@/types/jobs'

interface TransitionDialogProps {
  applicationId: string
  jobId: string
  candidateName: string
  from: Stage
  to: Stage
  onClose: () => void
}

const FINAL: Stage[] = ['HIRED', 'CLOSED']

/** Confirmacion humana de un cambio de etapa. Las decisiones finales exigen motivo y confirmacion explicita. */
export function TransitionDialog({ applicationId, jobId, candidateName, from, to, onClose }: TransitionDialogProps) {
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const [comment, setComment] = useState('')
  const [confirm, setConfirm] = useState(false)
  const final = FINAL.includes(to)
  const move = useAuraMutation({
    mutationFn: () => applicationsApi.transition(applicationId, { to_stage: to, comment: comment.trim() || null, confirm }),
    invalidate: [jobKeys.applicants(jobId), jobKeys.application(applicationId), jobKeys.company],
    success: `${candidateName}: ${STAGE_LABELS[to]}.`,
    onSuccess: onClose,
  })

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const ready = !final || (confirm && comment.trim().length > 0)

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="glass m-auto w-[min(480px,92vw)] rounded-2xl p-6 text-bone backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <h2 id={titleId} className="font-display text-lg font-semibold">
        Mover a {STAGE_LABELS[to]}
      </h2>
      <p className="mt-1 text-sm text-graphite-300">
        {candidateName}: {STAGE_LABELS[from]} &rarr; {STAGE_LABELS[to]}
      </p>
      {final && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Esta es una decision final sobre una persona. AURA no la toma por ti: registra el motivo y confirma que la decision es
          tuya.
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3">
        <AuraTextarea
          label={final ? 'Motivo de la decision (obligatorio)' : 'Comentario interno (opcional)'}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          hint="Solo lo ve el equipo de la empresa."
        />
        {final && <AuraCheckbox label="Confirmo que esta decision la tomo yo, de forma informada." checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <AuraButton variant="ghost" onClick={() => dialog.current?.close()}>
          Cancelar
        </AuraButton>
        <AuraButton variant={to === 'CLOSED' ? 'danger' : 'primary'} loading={move.isPending} disabled={!ready} onClick={() => move.mutate()}>
          Confirmar
        </AuraButton>
      </div>
    </dialog>
  )
}
