import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, LogIn, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { FormAlert } from '@/features/auth/FormAlert'
import { type LoginValues, loginSchema } from '@/features/auth/schemas'
import { applyServerErrors } from '@/features/auth/serverErrors'
import { useLogin } from '@/features/auth/useAuthActions'
import { LegalNoticeModal } from '@/features/privacy/LegalNoticeShowcase'

export function LoginPage() {
  const login = useLogin()
  const [formError, setFormError] = useState('')
  const [legalAccepted, setLegalAccepted] = useState(false)
  const [legalModalOpen, setLegalModalOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit(async (values) => {
    if (!legalAccepted) {
      setFormError(
        'Debes aceptar los Terminos y Condiciones, el Aviso de Privacidad Integral y la Clausula de Deslinde Open Source para continuar.',
      )
      return
    }
    setFormError('')
    try {
      await login.mutateAsync(values)
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email', 'password']))
    }
  })

  return (
    <AuraPanel eyebrow="Acceso Seguro" title="Iniciar sesion">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={formError} />

        <AuraInput
          label="Correo"
          type="email"
          autoComplete="email"
          icon={Mail}
          error={errors.email?.message}
          {...register('email')}
        />
        <AuraInput
          label="Contrasena"
          type="password"
          autoComplete="current-password"
          icon={Lock}
          error={errors.password?.message}
          {...register('password')}
        />

        {/* Casilla limpia con enlaces directos que abren el modal legal amplio */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3 text-xs sm:text-sm">
          <div className="flex items-start gap-3 text-bone">
            <input
              id="login-legal-check"
              type="checkbox"
              checked={legalAccepted}
              onChange={(e) => {
                setLegalAccepted(e.target.checked)
                if (e.target.checked) setFormError('')
              }}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-aura-500"
            />
            <label htmlFor="login-legal-check" className="leading-relaxed text-graphite-300">
              Acepto los{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setLegalModalOpen(true)
                }}
                className="font-semibold text-aura-400 underline decoration-aura-400/60 underline-offset-4 transition hover:text-bone"
              >
                Terminos y Condiciones
              </button>
              , el{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setLegalModalOpen(true)
                }}
                className="font-semibold text-aura-400 underline decoration-aura-400/60 underline-offset-4 transition hover:text-bone"
              >
                Aviso de Privacidad Integral
              </button>{' '}
              y la{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setLegalModalOpen(true)
                }}
                className="font-semibold text-amber-300 underline decoration-amber-300/60 underline-offset-4 transition hover:text-bone"
              >
                Clausula de Deslinde por Lenguajes Open Source
              </button>
              .
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-graphite-300 hover:text-aura-400">
            Olvide mi contrasena
          </Link>
        </div>

        <AuraButton type="submit" size="lg" icon={LogIn} loading={login.isPending} className="w-full">
          Entrar
        </AuraButton>

        <p className="text-center text-sm text-graphite-300">
          No tienes cuenta?{' '}
          <Link to="/register" className="font-medium text-aura-400 hover:underline">
            Crear cuenta
          </Link>
        </p>
      </form>

      <LegalNoticeModal
        open={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        onAccept={() => {
          setLegalAccepted(true)
          setFormError('')
        }}
      />
    </AuraPanel>
  )
}
