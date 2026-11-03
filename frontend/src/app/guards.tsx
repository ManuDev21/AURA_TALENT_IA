import { Navigate, Outlet, useLocation } from 'react-router'
import { AuraShell } from '@/layouts/AuraShell'
import { FullscreenLoader } from '@/pages/StatusPages'
import { useSessionStore } from '@/store/sessionStore'
import { AREA_ROLES, type AuraArea, hasAnyRole, homePathFor } from '@/utils/roles'

/** Protege un espacio por rol y monta su AuraShell. */
export function RequireArea({ area }: { area: AuraArea }) {
  const { status, user } = useSessionStore()
  const location = useLocation()
  if (status === 'unknown') return <FullscreenLoader />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!hasAnyRole(user, AREA_ROLES[area])) return <Navigate to="/forbidden" replace />
  return <AuraShell area={area} />
}

/** Rutas solo para visitantes (login, registro). */
export function PublicOnly() {
  const { status, user } = useSessionStore()
  if (status === 'unknown') return <FullscreenLoader />
  if (status === 'authenticated') return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}

export function HomeRedirect() {
  const { status, user } = useSessionStore()
  if (status === 'unknown') return <FullscreenLoader />
  return <Navigate to={status === 'authenticated' ? homePathFor(user) : '/login'} replace />
}
