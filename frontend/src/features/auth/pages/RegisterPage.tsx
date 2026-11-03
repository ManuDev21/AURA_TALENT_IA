import { zodResolver } from '@hookform/resolvers/zod'
import { Building, Code2, Lock, Mail, RotateCcw, Scale, ShieldAlert, UserRound, UserRoundPlus, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraSegmented } from '@/components/aura/AuraSegmented'
import { FormAlert } from '@/features/auth/FormAlert'
import { GoogleAuthButton } from '@/features/auth/GoogleAuthButton'
import { type RegisterValues, registerSchema } from '@/features/auth/schemas'
import { applyServerErrors } from '@/features/auth/serverErrors'
import { useRegister } from '@/features/auth/useAuthActions'
import { LegalNoticeModal, OPEN_SOURCE_LANGUAGES } from '@/features/privacy/LegalNoticeShowcase'
import { SystemSimulationTourModal } from '@/features/simulation/SystemSimulationTour'

const FIELDS = ['email', 'password', 'full_name', 'company_name', 'accept_terms', 'accept_privacy'] as const

export function RegisterPage() {
  const registerAccount = useRegister()
  const [formError, setFormError] = useState('')
  const [legalModalOpen, setLegalModalOpen] = useState(false)
  const [simModalOpen, setSimModalOpen] = useState(false)
  const [isSimulatedFill, setIsSimulatedFill] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
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

  const handleStartSimulation = () => {
    setValue('account_type', 'candidate', { shouldValidate: true })
    setValue('full_name', 'Alejandro Rivera Mendoza', { shouldValidate: true })
    setValue('email', 'alejandro.rivera@aura.demo', { shouldValidate: true })
    setValue('password', 'AuraDemo2026', { shouldValidate: true })
    acceptAllLegal()
    setFormError('')
    setIsSimulatedFill(true)
    setSimModalOpen(true)
  }

  const handleCancelSimulation = () => {
    setSimModalOpen(false)
    setIsSimulatedFill(false)
    reset({
      account_type: 'candidate',
      full_name: '',
      email: '',
      password: '',
      company_name: '',
      accept_terms: false,
      accept_privacy: false,
    })
    setFormError('')
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

  return (
    <AuraPanel eyebrow="Nueva cuenta" title="Crear cuenta">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={formError} />

        <GoogleAuthButton
          mode="register"
          defaultAccountType={accountType}
          legalAccepted={Boolean(acceptTerms && acceptPrivacy)}
          onRequireLegalAccept={acceptAllLegal}
        />

        <div className="flex flex-wrap items-center gap-2">
          <AuraButton
            type="button"
            variant="neo"
            size="sm"
            icon={WandSparkles}
            className="flex-1"
            onClick={handleStartSimulation}
          >
            Completar con simulacion (Ver flujo 100%)
          </AuraButton>
          {isSimulatedFill && (
            <AuraButton
              type="button"
              variant="danger"
              size="sm"
              icon={RotateCcw}
              onClick={handleCancelSimulation}
            >
              Cancelar simulacion
            </AuraButton>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-graphite-400">
          <span className="h-px flex-1 bg-white/10" />
          <span>o registrate con correo</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <AuraSegmented
          label="Tipo de cuenta"
          value={accountType}
          onChange={(value) => setValue('account_type', value, { shouldValidate: true })}
          options={[
            { value: 'candidate', label: 'Profesional', icon: UserRound },
            { value: 'company', label: 'Empresa', icon: Building },
          ]}
        />
        <AuraInput label="Nombre completo" autoComplete="name" icon={UserRound} error={errors.full_name?.message} {...register('full_name')} />
        {accountType === 'company' && (
          <AuraInput
            label="Nombre de la empresa"
            autoComplete="organization"
            icon={Building}
            error={errors.company_name?.message}
            {...register('company_name')}
          />
        )}
        <AuraInput label="Correo" type="email" autoComplete="email" icon={Mail} error={errors.email?.message} {...register('email')} />
        <AuraInput
          label="Contrasena"
          type="password"
          autoComplete="new-password"
          icon={Lock}
          hint="Minimo 10 caracteres, con letras y numeros."
          error={errors.password?.message}
          {...register('password')}
        />

        {/* Recuadro muy notorio de Deslinde Open Source y Aviso de Privacidad */}
        <div className="rounded-2xl border border-aura-500/45 bg-black/45 p-3.5 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-display font-bold text-bone">
                Aviso de Privacidad (Art. 6, 8, 9, 15, 16, 19 y 22-27 LFPDPPP) y Deslinde Open Source
              </p>
              <p className="mt-1 leading-relaxed text-graphite-300">
                Tus datos sensibles se resguardan con cifrado Argon2id, RBAC y biometria local. AURA se deslinda de fallas derivadas de vulnerabilidades o caidas globales en lenguajes de programacion Open Source.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {OPEN_SOURCE_LANGUAGES.slice(0, 6).map((lang) => (
                  <span
                    key={lang.id}
                    className="bubble-float inline-flex items-center gap-1 rounded-lg border border-white/15 bg-black/65 px-2 py-0.5 font-mono text-[10px] font-bold"
                    style={{ color: lang.color, '--b-delay': lang.delay } as React.CSSProperties}
                  >
                    <Code2 className="h-2.5 w-2.5" />
                    {lang.name}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setLegalModalOpen(true)}
                className="mt-2.5 inline-flex items-center gap-1.5 font-semibold text-aura-400 underline hover:text-bone"
              >
                <Scale className="h-3.5 w-3.5" />
                Abrir Aviso de Privacidad Completo y Escenario de Lenguajes Open Source
              </button>
            </div>
          </div>
        </div>

        <AuraCheckbox
          label="Acepto los Terminos y Condiciones de Uso y la Clausula de Deslinde Tecnologico Open Source"
          error={errors.accept_terms?.message}
          {...register('accept_terms')}
        />
        <AuraCheckbox
          label="Acepto el Aviso de Privacidad Integral (Art. 6, 8, 9, 15, 16, 19 y 22-27 LFPDPPP / RGPD) y el resguardo de mis datos"
          error={errors.accept_privacy?.message}
          {...register('accept_privacy')}
        />
        <AuraButton type="submit" size="lg" icon={UserRoundPlus} loading={registerAccount.isPending}>
          Crear cuenta
        </AuraButton>
        <p className="text-center text-sm text-graphite-300">
          Ya tienes cuenta?{' '}
          <Link to="/login" className="text-aura-400 hover:underline">
            Iniciar sesion
          </Link>
        </p>
      </form>

      <LegalNoticeModal
        open={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        onAccept={acceptAllLegal}
      />

      <SystemSimulationTourModal
        open={simModalOpen}
        onCloseAndRestore={handleCancelSimulation}
      />
    </AuraPanel>
  )
}
