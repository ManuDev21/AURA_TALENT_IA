import { CircleCheck, RefreshCw, WifiOff, X } from 'lucide-react'
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { AuraButton } from '@/components/aura/AuraButton'
import { useOnlineStatus } from '@/pwa/useOnlineStatus'

/** Avisos de la PWA: nueva version disponible, listo sin conexion y estado offline. */
export function PwaStatus() {
  const online = useOnlineStatus()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!offlineReady) return
    const timer = setTimeout(() => setOfflineReady(false), 5000)
    return () => clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  return (
    <>
      {!online && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-warning/15 py-1.5 text-xs text-warning backdrop-blur"
        >
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          Sin conexion. AURA mostrara lo disponible y se sincronizara al reconectar.
        </div>
      )}
      <div aria-live="polite" className="fixed bottom-24 right-4 z-[65] flex max-w-sm flex-col gap-2 md:bottom-6">
        {needRefresh && (
          <div className="glass flex items-center gap-3 rounded-xl p-3 text-sm">
            <RefreshCw className="h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
            <span className="flex-1">Hay una nueva version de AURA disponible.</span>
            <AuraButton size="sm" onClick={() => void updateServiceWorker(true)}>
              Actualizar
            </AuraButton>
            <AuraButton size="icon" variant="ghost" aria-label="Recordar mas tarde" onClick={() => setNeedRefresh(false)}>
              <X className="h-4 w-4" />
            </AuraButton>
          </div>
        )}
        {offlineReady && (
          <div className="glass flex items-center gap-3 rounded-xl p-3 text-sm">
            <CircleCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            AURA esta lista para abrirse sin conexion.
          </div>
        )}
      </div>
    </>
  )
}
