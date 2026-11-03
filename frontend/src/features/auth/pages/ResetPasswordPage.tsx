import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, Lock } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/client'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { FormAlert } from '@/features/auth/FormAlert'
import { type ResetValues, resetSchema } from '@/features/auth/schemas'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) })

  const onSubmit = handleSubmit(async ({ password }) => {
    setMessage(null)
    try {
      const response = await authApi.resetPassword(token, password)
      setMessage({ text: response.message, tone: 'success' })
    } catch (error) {
      setMessage({
        text: error instanceof ApiError ? error.message : 'No fue posible conectar con AURA.',
        tone: 'error',
      })
    }
  })

  if (!token) {
    return (
      <AuraPanel eyebrow="Recuperacion" title="Enlace incompleto">
        <FormAlert message="El enlace no contiene un token valido. Solicita uno nuevo." />
        <Link to="/forgot-password" className="mt-4 inline-block text-sm text-aura-400 hover:underline">
          Solicitar nuevo enlace
        </Link>
      </AuraPanel>
    )
  }

  const done = message?.tone === 'success'
  return (
    <AuraPanel eyebrow="Recuperacion" title="Nueva contrasena">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {message && <FormAlert message={message.text} tone={message.tone} />}
        {done ? (
          <Link to="/login" className="text-center text-sm text-aura-400 hover:underline">
            Ir a iniciar sesion
          </Link>
        ) : (
          <>
            <AuraInput
              label="Nueva contrasena"
              type="password"
              autoComplete="new-password"
              icon={Lock}
              hint="Minimo 10 caracteres, con letras y numeros."
              error={errors.password?.message}
              {...register('password')}
            />
            <AuraInput
              label="Confirmar contrasena"
              type="password"
              autoComplete="new-password"
              icon={Lock}
              error={errors.confirm?.message}
              {...register('confirm')}
            />
            <AuraButton type="submit" size="lg" icon={KeyRound} loading={isSubmitting}>
              Guardar contrasena
            </AuraButton>
          </>
        )}
      </form>
    </AuraPanel>
  )
}
