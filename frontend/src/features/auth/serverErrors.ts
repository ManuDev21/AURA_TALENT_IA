import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/api/client'

/** Traslada los errores del API a los campos del formulario. Devuelve el mensaje general. */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string {
  if (!(error instanceof ApiError)) return 'No fue posible conectar con AURA. Revisa tu conexion.'
  if (error.code === 'email_taken' && fields.includes('email' as Path<T>)) {
    setError('email' as Path<T>, { message: error.message })
    return ''
  }
  let mapped = false
  for (const fieldError of error.fieldErrors) {
    const field = fieldError.field as Path<T>
    if (fields.includes(field)) {
      setError(field, { message: fieldError.message })
      mapped = true
    }
  }
  return mapped ? '' : error.message
}
