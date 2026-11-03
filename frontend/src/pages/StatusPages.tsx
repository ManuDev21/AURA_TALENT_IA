import { ArrowLeft, ShieldAlert, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { useSessionStore } from '@/store/sessionStore'
import { homePathFor } from '@/utils/roles'

function CenteredPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const user = useSessionStore((s) => s.user)
  return (
    <main className="flex h-full items-center justify-center p-6">
      <AuraPanel eyebrow={eyebrow} title={title} className="w-full max-w-md">
        <div className="text-sm text-graphite-300">{children}</div>
        <Link to={homePathFor(user)} className="mt-6 inline-flex items-center gap-1 text-sm text-aura-400 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver
        </Link>
      </AuraPanel>
    </main>
  )
}

export function NotFoundPage() {
  return (
    <CenteredPanel eyebrow="404" title="Coordenadas desconocidas">
      AURA no encontro esta ruta.
    </CenteredPanel>
  )
}

export function NotFoundPanel() {
  return (
    <AuraPanel eyebrow="404" title="Modulo no encontrado">
      <p className="text-sm text-graphite-300">Este modulo no existe en tu espacio.</p>
    </AuraPanel>
  )
}

export function ForbiddenPage() {
  return (
    <CenteredPanel eyebrow="403" title="Acceso restringido">
      <p className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        Tu cuenta no tiene permisos para este espacio.
      </p>
    </CenteredPanel>
  )
}

export function RouteErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : 'Ocurrio un error inesperado.'
  return (
    <CenteredPanel eyebrow="Error" title="AURA encontro un problema">
      <p className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        {message}
      </p>
    </CenteredPanel>
  )
}

export function FullscreenLoader({ label = 'Sincronizando con AURA' }: { label?: string }) {
  return (
    <div className="flex h-full items-end justify-center pb-24">
      <AuraLoader label={label} />
    </div>
  )
}
