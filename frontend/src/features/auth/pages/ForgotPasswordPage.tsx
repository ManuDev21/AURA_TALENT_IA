import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Mail, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { authApi } from '@/api/auth'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { FormAlert } from '@/features/auth/FormAlert'
import { type ForgotValues, forgotSchema } from '@/features/auth/schemas'
import { applyServerErrors } from '@/features/auth/serverErrors'

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setMessage(null)
    try {
      const response = await authApi.forgotPassword(email)
      setMessage({ text: response.message, tone: 'success' })
    } catch (error) {
      setMessage({ text: applyServerErrors(error, setError, ['email']), tone: 'error' })
    }
  })

  return (
    <AuraPanel eyebrow="Recuperacion" title="Restablecer contrasena">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-graphite-300">Te enviaremos un enlace para crear una nueva contrasena.</p>
        {message && <FormAlert message={message.text} tone={message.tone} />}
        <AuraInput label="Correo" type="email" autoComplete="email" icon={Mail} error={errors.email?.message} {...register('email')} />
        <AuraButton type="submit" size="lg" icon={Send} loading={isSubmitting}>
          Enviar enlace
        </AuraButton>
        <Link to="/login" className="inline-flex items-center justify-center gap-1 text-sm text-graphite-300 hover:text-aura-400">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a iniciar sesion
        </Link>
      </form>
    </AuraPanel>
  )
}
