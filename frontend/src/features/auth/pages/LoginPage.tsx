import { zodResolver } from '@hookform/resolvers/zod'
import { Code2, Lock, LogIn, Mail, RotateCcw, Scale, ShieldAlert, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { FormAlert } from '@/features/auth/FormAlert'
import { GoogleAuthButton } from '@/features/auth/GoogleAuthButton'
import { type LoginValues, loginSchema } from '@/features/auth/schemas'
import { applyServerErrors } from '@/features/auth/serverErrors'
import { useLogin } from '@/features/auth/useAuthActions'
import { LegalNoticeModal, OPEN_SOURCE_LANGUAGES } from '@/features/privacy/LegalNoticeShowcase'
import { SystemSimulationTourModal } from '@/features/simulation/SystemSimulationTour'

export function LoginPage() {
  const login = useLogin()
  const [formError, setFormError] = useState('')
  const [legalAccepted, setLegalAccepted] = useState(false)
  const [legalModalOpen, setLegalModalOpen] = useState(false)
  const [simModalOpen, setSimModalOpen] = useState(false)
  const [isSimulatedFill, setIsSimulatedFill] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const handleStartSimulation = () => {
    setValue('email', 'candidato@aura.demo', { shouldValidate: true })
    setValue('password', 'AuraDemo2026', { shouldValidate: true })
    setLegalAccepted(true)
    setFormError('')
    setIsSimulatedFill(true)
    setSimModalOpen(true)
  }

  const handleCancelSimulation = () => {
    setSimModalOpen(false)
    setIsSimulatedFill(false)
    reset({ email: '', password: '' })
    setLegalAccepted(false)
    setFormError('')
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!legalAccepted) {
      setFormError(
        'Debes aceptar los Terminos y Condiciones, el Aviso de Privacidad Integral y el Deslinde Tecnologico Open Source para continuar.',
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

        <GoogleAuthButton
          mode="login"
          legalAccepted={legalAccepted}
          onRequireLegalAccept={() => setLegalAccepted(true)}
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
          <span>o con tu correo corporativo / personal</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

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

        {/* Recuadro Notorio de Aviso de Privacidad y Deslinde por Lenguajes Open Source */}
        <div className="rounded-2xl border border-aura-500/40 bg-black/40 p-3.5 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-display font-bold text-bone">
                Proteccion de Datos Sensibles y Deslinde Open Source
              </p>
              <p className="mt-1 leading-relaxed text-graphite-300">
                Cumplimos con los <strong className="text-bone">Art. 6, 8, 9, 15, 16, 19 y 22-27 de la LFPDPPP y RGPD</strong>. AURA se deslinda de vulnerabilidades o caidas globales originadas en lenguajes Open Source de terceros.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {OPEN_SOURCE_LANGUAGES.slice(0, 6).map((lang) => (
                  <span
                    key={lang.id}
                    className="bubble-float inline-flex items-center gap-1 rounded-lg border border-white/15 bg-black/60 px-2 py-0.5 font-mono text-[10px] font-bold"
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
                Leer Aviso de Privacidad Completo y Deslinde Interactivo
              </button>
            </div>
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-t border-white/10 pt-2.5 text-bone">
            <input
              type="checkbox"
              checked={legalAccepted}
              onChange={(e) => {
                setLegalAccepted(e.target.checked)
                if (e.target.checked) setFormError('')
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded accent-orange-500"
            />
            <span className="leading-snug">
              Acepto los <strong className="text-aura-400">Terminos y Condiciones</strong>, el{' '}
              <strong className="text-aura-400">Aviso de Privacidad Integral</strong> y la{' '}
              <strong className="text-amber-300">Clausula de Deslinde por Lenguajes Open Source</strong>.
            </span>
          </label>
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-graphite-300 hover:text-aura-400">
            Olvide mi contrasena
          </Link>
        </div>

        <AuraButton type="submit" size="lg" icon={LogIn} loading={login.isPending}>
          Entrar
        </AuraButton>

        <p className="text-center text-sm text-graphite-300">
          No tienes cuenta?{' '}
          <Link to="/register" className="text-aura-400 hover:underline">
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

      <SystemSimulationTourModal
        open={simModalOpen}
        onCloseAndRestore={handleCancelSimulation}
      />
    </AuraPanel>
  )
}
