import { Check, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AuraButton } from '@/components/aura/AuraButton'

interface AuraConfirmButtonProps {
  label: string
  onConfirm: () => void
  loading?: boolean
}

/** Eliminacion en dos pasos: evita borrados accidentales sin abrir un modal. */
export function AuraConfirmButton({ label, onConfirm, loading }: AuraConfirmButtonProps) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [armed])

  if (!armed) {
    return (
      <AuraButton variant="ghost" size="icon" aria-label={label} title={label} onClick={() => setArmed(true)}>
        <Trash2 className="h-4 w-4" />
      </AuraButton>
    )
  }
  return (
    <span className="flex items-center gap-1" role="group" aria-label={`Confirmar: ${label}`}>
      <AuraButton variant="danger" size="sm" icon={Check} loading={loading} onClick={onConfirm}>
        Eliminar
      </AuraButton>
      <AuraButton variant="ghost" size="icon" aria-label="Cancelar" onClick={() => setArmed(false)}>
        <X className="h-4 w-4" />
      </AuraButton>
    </span>
  )
}
