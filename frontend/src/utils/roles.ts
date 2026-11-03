import type { RoleCode, UserMe } from '@/types/auth'

export type AuraArea = 'candidate' | 'company' | 'admin'

export const AREA_ROLES: Record<AuraArea, RoleCode[]> = {
  candidate: ['ROLE_CANDIDATE'],
  company: ['ROLE_RECRUITER', 'ROLE_COMPANY_ADMIN'],
  admin: ['ROLE_SYSTEM_ADMIN'],
}

export const ROLE_LABELS: Record<RoleCode, string> = {
  ROLE_CANDIDATE: 'Candidato',
  ROLE_RECRUITER: 'Reclutador',
  ROLE_COMPANY_ADMIN: 'Admin empresa',
  ROLE_SYSTEM_ADMIN: 'Admin sistema',
}

export function hasAnyRole(user: UserMe | null, roles: RoleCode[]): boolean {
  return !!user?.roles.some((r) => roles.includes(r.code))
}

export function areasFor(user: UserMe | null): AuraArea[] {
  return (Object.keys(AREA_ROLES) as AuraArea[]).filter((area) => hasAnyRole(user, AREA_ROLES[area]))
}

/** Area principal del usuario, por prioridad: admin > empresa > candidato. */
export function homePathFor(user: UserMe | null): string {
  const areas = areasFor(user)
  if (areas.includes('admin')) return '/admin'
  if (areas.includes('company')) return '/company'
  if (areas.includes('candidate')) return '/candidate'
  return '/login'
}

export function primaryRoleLabel(user: UserMe | null): string {
  const priority: RoleCode[] = ['ROLE_SYSTEM_ADMIN', 'ROLE_COMPANY_ADMIN', 'ROLE_RECRUITER', 'ROLE_CANDIDATE']
  const code = priority.find((c) => user?.roles.some((r) => r.code === c))
  return code ? ROLE_LABELS[code] : ''
}
