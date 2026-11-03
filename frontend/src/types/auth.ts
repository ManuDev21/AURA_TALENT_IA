export type RoleCode = 'ROLE_CANDIDATE' | 'ROLE_RECRUITER' | 'ROLE_COMPANY_ADMIN' | 'ROLE_SYSTEM_ADMIN'

export interface RoleAssignment {
  code: RoleCode
  company_id: string | null
}

export interface UserMe {
  id: string
  email: string
  full_name: string
  phone: string | null
  locale: string
  status: string
  roles: RoleAssignment[]
  permissions: string[]
  created_at: string
  last_login_at: string | null
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: UserMe
}

export interface RegisterPayload {
  email: string
  password: string
  full_name: string
  account_type: 'candidate' | 'company'
  company_name?: string
  accept_terms: boolean
  accept_privacy: boolean
}

export interface LoginPayload {
  email: string
  password: string
}

export interface GoogleAuthPayload {
  email?: string
  full_name?: string
  account_type: 'candidate' | 'company'
  company_name?: string
  google_sub?: string
  credential?: string
  access_token?: string
  accept_terms: boolean
  accept_privacy: boolean
  accept_opensource_disclaimer: boolean
}

export interface PermissionRead {
  code: string
  module: string
  description: string | null
}

export interface RoleRead {
  code: RoleCode
  name: string
  description: string | null
  permissions: PermissionRead[]
}
