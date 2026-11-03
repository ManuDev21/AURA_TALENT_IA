import { describe, expect, it } from 'vitest'
import type { RoleCode, UserMe } from '@/types/auth'
import { areasFor, homePathFor } from '@/utils/roles'

function userWith(...codes: RoleCode[]): UserMe {
  return {
    id: '1',
    email: 'a@b.dev',
    full_name: 'A',
    phone: null,
    locale: 'es',
    status: 'active',
    roles: codes.map((code) => ({ code, company_id: null })),
    permissions: [],
    created_at: '',
    last_login_at: null,
  }
}

describe('roles', () => {
  it('resuelve el area principal por prioridad', () => {
    expect(homePathFor(userWith('ROLE_CANDIDATE'))).toBe('/candidate')
    expect(homePathFor(userWith('ROLE_RECRUITER'))).toBe('/company')
    expect(homePathFor(userWith('ROLE_CANDIDATE', 'ROLE_SYSTEM_ADMIN'))).toBe('/admin')
    expect(homePathFor(null)).toBe('/login')
  })

  it('lista todas las areas accesibles', () => {
    expect(areasFor(userWith('ROLE_COMPANY_ADMIN', 'ROLE_CANDIDATE'))).toEqual(['candidate', 'company'])
  })
})
