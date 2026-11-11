import { zodResolver } from '@hookform/resolvers/zod'
import { Building, Lock, Mail, UserRound, UserRoundPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraSegmented } from '@/components/aura/AuraSegmented'
import { FormAlert } from '@/features/auth/FormAlert'
import { type RegisterValues, registerSchema } from '@/features/auth/schemas'
import { applyServerErrors } from '@/features/auth/serverErrors'
import { useRegister } from '@/features/auth/useAuthActions'
import { LegalNoticeModal } from '@/features/privacy/LegalNoticeShowcase'

const FIELDS = ['email', 'password', 'full_name', 'company_name', 'accept_terms', 'accept_privacy'] as const

export function RegisterPage() {
  const registerAccount = useRegister()
  const [formError, setFormError] = useState('')
  const [legalModalOpen, setLegalModalOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { account_type: 'candidate', accept_terms: false, accept_privacy: false },
  })
  const accountType = watch('account_type')
  const acceptTerms = watch('accept_terms')
  const acceptPrivacy = watch('accept_privacy')

  const acceptAllLegal = () => {
    setValue('accept_terms', true, { shouldValidate: true })
    setValue('accept_privacy', true, { shouldValidate: true })
  }

  const handleToggleCombinedLegal = (checked: boolean) => {
    setValue('accept_terms', checked, { shouldValidate: true })
    setValue('accept_privacy', checked, { shouldValidate: true })
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError('')
    try {
      await registerAccount.mutateAsync({
        ...values,
        company_name: values.account_type === 'company' ? values.company_name : undefined,
      })
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS))
    }
  })

  const legalError = errors.accept_terms?.message ?? errors.accept_privacy?.message

  return (
    <AuraPanel eyebrow="Nueva cuenta" title="Crear cuenta">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={formError} />

        <AuraSegmented
          label="Tipo de cuenta"
          value={accountType}
          onChange={(value) => setValue('account_type', value, { shouldValidate: true })}
          options={[
            { value: 'candidate', label: 'Profesional', icon: UserRound },
            { value: 'company', label: 'Empresa', icon: Building },
          ]}
        />
        <AuraInput
          label="Nombre completo"
          autoComplete="name"
          icon={UserRound}
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        {accountType === 'company' && (
          <AuraInput
            label="Nombre de la empresa"
            autoComplete="organization"
            icon={Building}
            error={errors.company_name?.message}
            {...register('company_name')}
          />
        )}
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
          autoComplete="new-password"
          icon={Lock}
          hint="Minimo 10 caracteres, con letras y numeros."
          error={errors.password?.message}
          {...register('password')}
        />

        {/* Casilla limpia con enlaces directos al modal legal detallado */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3 text-xs sm:text-sm">
          <div className="flex items-start gap-3 text-bone">
            <input
              id="register-legal-check"
              type="checkbox"
              checked={Boolean(acceptTerms && acceptPrivacy)}
              onChange={(e) => handleToggleCombinedLegal(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-aura-500"
            />
            <label htmlFor="register-legal-check" className="leading-relaxed text-graphite-300">
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
          {legalError && <p className="mt-2 text-xs text-danger">{legalError}</p>}
        </div>

        <AuraButton type="submit" size="lg" icon={UserRoundPlus} loading={registerAccount.isPending} className="w-full">
          Crear cuenta
        </AuraButton>
        <p className="text-center text-sm text-graphite-300">
          Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-aura-400 hover:underline">
            Iniciar sesion
          </Link>
        </p>
      </form>

      <LegalNoticeModal
        open={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        onAccept={acceptAllLegal}
      />
    </AuraPanel>
  )
}
