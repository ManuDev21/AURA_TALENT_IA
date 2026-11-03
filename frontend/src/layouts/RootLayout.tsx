import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { refreshSession } from '@/api/client'
import { BootSequence } from '@/aura/BootSequence'
import { BOOT_STORAGE_KEY } from '@/aura/bootState'
import { AuraToaster } from '@/components/aura/AuraToaster'
import { GlobalLiveTranslator } from '@/i18n/liveTranslator'
import { PwaStatus } from '@/pwa/PwaStatus'
import { useSessionStore } from '@/store/sessionStore'

// Three.js se carga aparte para que la interfaz aparezca de inmediato
const AuraCanvas = lazy(() => import('@/three/AuraCanvas').then((m) => ({ default: m.AuraCanvas })))

export function RootLayout() {
  const [booting, setBooting] = useState(() => sessionStorage.getItem(BOOT_STORAGE_KEY) !== '1')
  const finishBoot = useCallback(() => setBooting(false), [])

  useEffect(() => {
    if (useSessionStore.getState().status === 'unknown') void refreshSession()
  }, [])

  return (
    <>
      {!booting && (
        <Suspense fallback={null}>
          <AuraCanvas />
        </Suspense>
      )}
      <div className="relative z-10 h-full">
        <Outlet />
      </div>
      <GlobalLiveTranslator />
      <AuraToaster />
      <PwaStatus />
      <BootSequence onFinish={finishBoot} />
    </>
  )
}
