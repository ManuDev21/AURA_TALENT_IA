import { z } from 'zod'

const email = z.email('Ingresa un correo valido')

const password = z
  .string()
  .min(10, 'Minimo 10 caracteres')
  .max(128, 'Maximo 128 caracteres')
  .regex(/[A-Za-z]/, 'Incluye al menos una letra')
  .regex(/\d/, 'Incluye al menos un numero')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Ingresa tu contrasena'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    account_type: z.enum(['candidate', 'company']),
    full_name: z.string().trim().min(2, 'Ingresa tu nombre').max(150),
    email,
    password,
    company_name: z.string().trim().max(150).optional(),
    accept_terms: z.boolean().refine((v) => v, 'Debes aceptar los terminos'),
    accept_privacy: z.boolean().refine((v) => v, 'Debes aceptar la politica de privacidad'),
  })
  .superRefine((values, ctx) => {
    if (values.account_type === 'company' && (values.company_name ?? '').length < 2) {
      ctx.addIssue({ code: 'custom', path: ['company_name'], message: 'Ingresa el nombre de la empresa' })
    }
  })
export type RegisterValues = z.infer<typeof registerSchema>

export const forgotSchema = z.object({ email })
export type ForgotValues = z.infer<typeof forgotSchema>

export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contrasenas no coinciden' })
export type ResetValues = z.infer<typeof resetSchema>
