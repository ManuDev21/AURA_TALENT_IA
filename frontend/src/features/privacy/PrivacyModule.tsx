import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Download, Eye, Mic, Scale, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { apiDownload } from '@/api/client'
import { type ConsentType, privacyApi, privacyKeys } from '@/api/privacy'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraTabs } from '@/components/aura/AuraTabs'
import { LegalNoticeShowcase } from '@/features/privacy/LegalNoticeShowcase'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const ITEMS: { type: ConsentType; icon: typeof Camera; title: string; text: string }[] = [
  { type: 'camera', icon: Camera, title: 'Camara', text: 'Practica con camara y control por gestos. El video se procesa solo en tu navegador.' },
  { type: 'voice', icon: Mic, title: 'Voz', text: 'Hablar con AURA. Solo el texto reconocido llega al servidor, nunca el audio.' },
  {
    type: 'external_ai_processing',
    icon: Sparkles,
    title: 'IA externa',
    text: 'Permite enviar texto minimizado y sin datos de contacto a un proveedor de IA (Gemini) para respuestas mas flexibles.',
  },
  { type: 'discoverable', icon: Eye, title: 'Perfil visible para empresas', text: 'Permite que reclutadores encuentren tu perfil aunque no te hayas postulado.' },
]

export function PrivacyModule() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: privacyKeys.consents, queryFn: privacyApi.consents })
  const [exporting, setExporting] = useState(false)
  const [tab, setTab] = useState<'legal' | 'permisos'>('legal')
  const toggle = useAuraMutation({
    mutationFn: ({ type, granted }: { type: ConsentType; granted: boolean }) => privacyApi.set(type, granted),
    onSuccess: (map) => qc.setQueryData(privacyKeys.consents, map),
    success: 'Preferencia guardada.',
  })

  const exportData = async () => {
    setExporting(true)
    try {
      await apiDownload('/privacy/export', 'mis-datos-aura.json')
      toast.success('Tus datos se descargaron.')
    } catch {
      toast.error('No se pudo exportar.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <AuraPanel
      eyebrow="Privacidad, Marco Legal y Seguridad"
      title="Aviso de Privacidad Integral, Articulos Legales y Permisos"
      className="flex flex-col gap-5"
    >
      <AuraTabs
        label="Secciones de Privacidad y Aviso Legal"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'legal', label: 'Aviso de Privacidad, Articulos y Deslinde Open Source', icon: Scale },
          { id: 'permisos', label: 'Mis Consentimientos y Exportacion ARCO', icon: ShieldCheck },
        ]}
      />

      {tab === 'legal' ? (
        <LegalNoticeShowcase />
      ) : (
        <>
          {!data ? (
            <div className="flex justify-center py-10">
              <AuraLoader label="Cargando preferencias" />
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {ITEMS.map(({ type, icon: Icon, title, text }) => {
                const on = data[type].granted
                return (
                  <li key={type} className="card-3d flex items-start gap-3 rounded-2xl p-4">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-aura-400" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-bone">{title}</p>
                      <p className="text-xs text-graphite-300">{text}</p>
                      {data[type].updated_at && (
                        <p className="mt-1 text-[0.65rem] text-graphite-400">
                          Ultimo cambio: {new Date(data[type].updated_at!).toLocaleString('es')}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${title}: ${on ? 'permitido' : 'no permitido'}`}
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ type, granted: !on })}
                      className={cn(
                        'relative h-6 w-11 shrink-0 rounded-full transition',
                        on ? 'bg-aura-500' : 'bg-white/15',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-5 w-5 rounded-full bg-bone transition-all',
                          on ? 'left-[1.375rem]' : 'left-0.5',
                        )}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <section className="card-3d flex flex-wrap items-center gap-3 rounded-2xl p-4">
            <ShieldCheck className="h-5 w-5 text-aura-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-bone">Descargar mis datos (Derecho ARCO de Acceso y Portabilidad)</p>
              <p className="text-xs text-graphite-300">
                Archivo JSON estructurado con tu cuenta, perfil, postulaciones, evaluaciones, consentimientos e interacciones con AURA.
              </p>
            </div>
            <AuraButton variant="neo" icon={Download} loading={exporting} onClick={() => void exportData()}>
              Exportar JSON
            </AuraButton>
          </section>
          <p className="text-xs text-graphite-400">
            Cada cambio queda registrado en bitacora con fecha y hora conforme a los Articulos 22 al 27 de la LFPDPPP.
          </p>
        </>
      )}
    </AuraPanel>
  )
}
