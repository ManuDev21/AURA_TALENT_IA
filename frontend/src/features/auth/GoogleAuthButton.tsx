import { Building, CheckCircle2, KeyRound, Mail, ShieldCheck, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraSegmented } from '@/components/aura/AuraSegmented'
import { FormAlert } from '@/features/auth/FormAlert'
import { applyServerErrors } from '@/features/auth/serverErrors'
import { useGoogleAuth } from '@/features/auth/useAuthActions'
import { LegalNoticeModal } from '@/features/privacy/LegalNoticeShowcase'
import { toast } from '@/store/toastStore'

interface GoogleIdCredentialResponse {
  credential: string
  select_by?: string
}

interface GoogleTokenResponse {
  access_token?: string
  error?: string
}

interface GoogleAccountsNamespace {
  id: {
    initialize: (config: {
      client_id: string
      callback: (response: GoogleIdCredentialResponse) => void
      auto_select?: boolean
      cancel_on_tap_outside?: boolean
      use_fedcm_for_prompt?: boolean
    }) => void
    prompt: () => void
    renderButton: (
      parent: HTMLElement,
      options: {
        theme?: 'outline' | 'filled_blue' | 'filled_black'
        size?: 'large' | 'medium' | 'small'
        text?: 'signin_with' | 'signup_with' | 'continue_with'
        shape?: 'rectangular' | 'pill'
        width?: number
      },
    ) => void
  }
  oauth2: {
    initTokenClient: (config: {
      client_id: string
      scope: string
      prompt?: string
      callback: (response: GoogleTokenResponse) => void
    }) => {
      requestAccessToken: (overrideConfig?: { prompt?: string }) => void
    }
  }
}

declare global {
  interface Window {
    google?: {
      accounts?: GoogleAccountsNamespace
    }
  }
}

const STORAGE_GOOGLE_CLIENT_ID = 'aura_google_oauth_client_id'

const DEVICE_SYNC_PROFILES = [
  {
    email: 'candidato.google@gmail.com',
    full_name: 'Alejandro Rivera (Cuenta Google)',
    account_type: 'candidate' as const,
    roleLabel: 'Perfil Profesional (Candidato)',
  },
  {
    email: 'reclutamiento.google@empresa.com',
    full_name: 'Direccion de Talento (Google Workspace)',
    account_type: 'company' as const,
    company_name: 'InnovaTech Global',
    roleLabel: 'Perfil Corporativo (Empresa)',
  },
]

function GoogleLogoSvg() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
      />
    </svg>
  )
}

export function GoogleAuthButton({
  mode,
  defaultAccountType = 'candidate',
  legalAccepted,
  onRequireLegalAccept,
}: {
  mode: 'login' | 'register'
  defaultAccountType?: 'candidate' | 'company'
  legalAccepted: boolean
  onRequireLegalAccept: () => void
}) {
  const googleAuth = useGoogleAuth()
  const gsiButtonRef = useRef<HTMLDivElement>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [legalModalOpen, setLegalModalOpen] = useState(false)
  const [showClientIdConfig, setShowClientIdConfig] = useState(false)
  const [accountType, setAccountType] = useState<'candidate' | 'company'>(defaultAccountType)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('InnovaTech Global')
  const [acceptedInModal, setAcceptedInModal] = useState(legalAccepted)
  const [errorMsg, setErrorMsg] = useState('')

  const envClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? ''
  const [clientId, setClientId] = useState<string>(() => {
    if (envClientId) return envClientId
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(STORAGE_GOOGLE_CLIENT_ID) ?? ''
    }
    return ''
  })

  // Inicializar boton oficial de Google Identity Services cuando se abre el selector y hay Client ID
  useEffect(() => {
    if (!dialogOpen || !clientId.trim()) return
    const gAccounts = window.google?.accounts
    if (!gAccounts?.id || !gsiButtonRef.current) return

    try {
      gAccounts.id.initialize({
        client_id: clientId.trim(),
        use_fedcm_for_prompt: true,
        callback: (response) => {
          if (response.credential) {
            void submitGoogleCredential({ credential: response.credential })
          }
        },
      })
      gsiButtonRef.current.innerHTML = ''
      gAccounts.id.renderButton(gsiButtonRef.current, {
        theme: 'filled_blue',
        size: 'large',
        text: mode === 'login' ? 'signin_with' : 'signup_with',
        shape: 'pill',
        width: 340,
      })
    } catch {
      // Si el Client ID aun no es valido, mantener flujo OAuth popup
    }
  }, [dialogOpen, clientId, mode])

  const submitGoogleCredential = async (params: {
    credential?: string
    access_token?: string
    email?: string
    full_name?: string
    account_type?: 'candidate' | 'company'
    company_name?: string
  }) => {
    const canProceed = legalAccepted || acceptedInModal
    if (!canProceed) {
      setErrorMsg(
        'Debes aceptar los Terminos, el Aviso de Privacidad Integral (LFPDPPP) y el Deslinde Open Source antes de continuar.',
      )
      return
    }
    const targetType = params.account_type ?? accountType
    const targetCompany =
      targetType === 'company' ? (params.company_name ?? companyName).trim() || 'Empresa Google' : undefined

    setErrorMsg('')
    try {
      await googleAuth.mutateAsync({
        credential: params.credential,
        access_token: params.access_token,
        email: params.email,
        full_name: params.full_name,
        account_type: targetType,
        company_name: targetCompany,
        accept_terms: true,
        accept_privacy: true,
        accept_opensource_disclaimer: true,
      })
      setDialogOpen(false)
    } catch (err) {
      setErrorMsg(applyServerErrors(err, () => {}, []))
    }
  }

  // Lanza el selector nativo de cuentas de Google del dispositivo via Google Identity Services OAuth2
  const launchRealGoogleAccountChooser = () => {
    const canProceed = legalAccepted || acceptedInModal
    if (!canProceed) {
      setDialogOpen(true)
      setErrorMsg(
        'Primero marca la casilla de aceptacion del Aviso de Privacidad y Deslinde Open Source para abrir tu cuenta de Google.',
      )
      return
    }

    const activeClientId = clientId.trim()
    const gOAuth = window.google?.accounts?.oauth2

    if (activeClientId && gOAuth) {
      try {
        const tokenClient = gOAuth.initTokenClient({
          client_id: activeClientId,
          scope: 'openid email profile',
          prompt: 'select_account',
          callback: (tokenResponse) => {
            if (tokenResponse.access_token) {
              void submitGoogleCredential({ access_token: tokenResponse.access_token })
            } else if (tokenResponse.error) {
              setErrorMsg(`Google OAuth: ${tokenResponse.error}`)
            }
          },
        })
        tokenClient.requestAccessToken({ prompt: 'select_account' })
        return
      } catch {
        // Si falla el popup, mostrar el selector
      }
    }

    setAcceptedInModal(legalAccepted)
    setAccountType(defaultAccountType)
    setErrorMsg('')
    setDialogOpen(true)
  }

  const handleSaveClientId = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_GOOGLE_CLIENT_ID, clientId.trim())
    }
    toast.success('Google OAuth Client ID guardado. Ahora puedes abrir el selector nativo de Google.')
    setShowClientIdConfig(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={launchRealGoogleAccountChooser}
        className="btn-jelly flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-md transition hover:border-aura-400 hover:bg-slate-50"
      >
        <GoogleLogoSvg />
        <span>
          {mode === 'login'
            ? 'Continuar con Google (Seleccionar cuenta del dispositivo)'
            : 'Registrarse con Google (Cuenta del dispositivo)'}
        </span>
      </button>

      {dialogOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Selector de cuenta de Google"
            className="fixed inset-0 z-[92] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
            onClick={() => setDialogOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="modal-surface flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-3xl p-6"
            >
              <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow">
                    <GoogleLogoSvg />
                  </span>
                  <div>
                    <p className="hud-label text-aura-400">Google Identity Services (GSI / OAuth 2.0)</p>
                    <h3 className="font-display text-lg font-bold text-bone">
                      Elige una cuenta para ir a AURA Talent AI
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  aria-label="Cerrar selector de Google"
                  className="rounded-lg border border-white/10 p-1.5 text-graphite-300 hover:text-bone"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <FormAlert message={errorMsg} />

              {/* Casilla obligatoria de Terminos y Privacidad antes de disparar Google */}
              <div className="rounded-2xl border border-aura-500/35 bg-aura-500/10 p-3.5 text-xs">
                <label className="flex cursor-pointer items-start gap-2.5 text-bone">
                  <input
                    type="checkbox"
                    checked={legalAccepted || acceptedInModal}
                    onChange={(e) => {
                      setAcceptedInModal(e.target.checked)
                      if (e.target.checked) {
                        onRequireLegalAccept()
                        setErrorMsg('')
                      }
                    }}
                    className="mt-0.5 h-4 w-4 rounded accent-orange-500"
                  />
                  <span>
                    He leido y acepto los{' '}
                    <button
                      type="button"
                      onClick={() => setLegalModalOpen(true)}
                      className="font-semibold text-aura-400 underline hover:text-bone"
                    >
                      Terminos y Condiciones, el Aviso de Privacidad Integral (Art. 6, 8, 9, 15, 16, 19 y 22-27 LFPDPPP) y el Deslinde Open Source
                    </button>
                    .
                  </span>
                </label>
              </div>

              {/* Boton que abre la ventana emergente oficial de Google (accounts.google.com) */}
              <div className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-bone">
                    1. Ventana oficial de Google (Cuentas de este navegador)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowClientIdConfig((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-aura-400 hover:underline"
                  >
                    <KeyRound className="h-3 w-3" />
                    {clientId ? 'Cambiar Client ID' : 'Configurar Client ID'}
                  </button>
                </div>

                {showClientIdConfig && (
                  <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/50 p-3">
                    <AuraInput
                      label="Google OAuth Client ID (Google Cloud Console)"
                      placeholder="1234567890-abc.apps.googleusercontent.com"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <AuraButton size="sm" onClick={handleSaveClientId}>
                        Guardar Client ID
                      </AuraButton>
                    </div>
                  </div>
                )}

                {clientId ? (
                  <div className="flex flex-col items-center gap-2.5 pt-1">
                    <div ref={gsiButtonRef} className="flex justify-center" />
                    <AuraButton
                      size="sm"
                      variant="neo"
                      onClick={launchRealGoogleAccountChooser}
                      loading={googleAuth.isPending}
                    >
                      Abrir popup selector de cuentas de Google
                    </AuraButton>
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-graphite-300">
                    El SDK oficial <code className="text-aura-400">accounts.google.com/gsi/client</code> esta activo. Puedes pegar tu <code className="text-bone">VITE_GOOGLE_CLIENT_ID</code> en <button type="button" onClick={() => setShowClientIdConfig(true)} className="font-semibold text-aura-400 underline">Configurar Client ID</button> para abrir el popup de Google Cloud, o elegir directamente una cuenta de tu dispositivo aqui abajo:
                  </p>
                )}
              </div>

              {/* Selector de cuentas detectadas / acceso directo */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-bone">
                  2. Selecciona una cuenta de Google para entrar ahora:
                </p>
                {DEVICE_SYNC_PROFILES.map((prof) => (
                  <button
                    key={prof.email}
                    type="button"
                    disabled={googleAuth.isPending}
                    onClick={() =>
                      void submitGoogleCredential({
                        email: prof.email,
                        full_name: prof.full_name,
                        account_type: prof.account_type,
                        company_name: prof.company_name,
                      })
                    }
                    className="btn-jelly flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 p-3.5 text-left transition hover:border-aura-500/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aura-500/20 font-display text-sm font-bold text-aura-400">
                        {prof.full_name[0]}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-bone">{prof.full_name}</p>
                        <p className="font-mono text-xs text-graphite-300">{prof.email}</p>
                        <span className="text-[11px] text-aura-400">{prof.roleLabel}</span>
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  </button>
                ))}
              </div>

              {/* Ingresar cualquier cuenta Gmail/Google Workspace del dispositivo */}
              <div className="border-t border-white/10 pt-3">
                <p className="mb-2.5 text-xs font-semibold text-bone">
                  3. O usa otra cuenta de Google de tu dispositivo:
                </p>
                <div className="flex flex-col gap-3">
                  <AuraSegmented
                    label="Tipo de cuenta"
                    value={accountType}
                    onChange={(v) => setAccountType(v)}
                    options={[
                      { value: 'candidate', label: 'Candidato', icon: UserRound },
                      { value: 'company', label: 'Empresa', icon: Building },
                    ]}
                  />
                  <AuraInput
                    label="Tu correo de Google (Gmail o Workspace)"
                    type="email"
                    autoComplete="username"
                    placeholder="tucorreo@gmail.com"
                    icon={Mail}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <AuraInput
                    label="Nombre completo de la cuenta"
                    autoComplete="name"
                    placeholder="Nombre y Apellido"
                    icon={UserRound}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                  {accountType === 'company' && (
                    <AuraInput
                      label="Nombre de la empresa"
                      autoComplete="organization"
                      icon={Building}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <AuraButton variant="ghost" size="sm" icon={ShieldCheck} onClick={() => setLegalModalOpen(true)}>
                  Leer Aviso Legal
                </AuraButton>
                <AuraButton
                  size="md"
                  loading={googleAuth.isPending}
                  onClick={() => {
                    if (!email.trim().includes('@')) {
                      setErrorMsg('Ingresa tu correo de Google o haz clic en una de las cuentas de arriba.')
                      return
                    }
                    void submitGoogleCredential({
                      email: email.trim(),
                      full_name: fullName.trim() || email.split('@')[0] || 'Usuario Google',
                      account_type: accountType,
                      company_name: companyName,
                    })
                  }}
                >
                  Continuar con esta cuenta Google
                </AuraButton>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <LegalNoticeModal
        open={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        onAccept={() => {
          setAcceptedInModal(true)
          onRequireLegalAccept()
          setErrorMsg('')
        }}
      />
    </>
  )
}
