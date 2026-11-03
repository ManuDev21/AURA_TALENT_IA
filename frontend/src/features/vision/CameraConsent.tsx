import { Camera, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraCheckbox } from '@/components/aura/AuraCheckbox'

interface Props {
  purpose: string
  saving: boolean
  onAccept: () => void
}

/** Pantalla de consentimiento explicito antes de encender la camara. */
export function CameraConsent({ purpose, saving, onAccept }: Props) {
  const [checked, setChecked] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="neo flex h-11 w-11 items-center justify-center rounded-xl text-aura-400">
          <Camera className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm text-graphite-300">{purpose}</p>
      </div>
      <ul className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-graphite-300">
        {[
          'El video se procesa unicamente en tu navegador. Ninguna imagen se graba ni se envia al servidor.',
          'No se identifica a la persona, no se reconocen emociones y nada de esto se comparte con empresas.',
          'Puedes apagar la camara o revocar este permiso en cualquier momento.',
          'Todo lo que hace la camara tambien se puede hacer con teclado y raton.',
        ].map((t) => (
          <li key={t} className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>
      <AuraCheckbox label="Entiendo y autorizo el uso de la camara para esta funcion." checked={checked} onChange={(e) => setChecked(e.target.checked)} />
      <AuraButton icon={Camera} className="self-end" disabled={!checked} loading={saving} onClick={onAccept}>
        Autorizar camara
      </AuraButton>
    </div>
  )
}
