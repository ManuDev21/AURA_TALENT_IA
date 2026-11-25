import { useMutation } from '@tanstack/react-query'
import { CircleCheck, Mail, Phone, Save, TriangleAlert, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '@/api/client'
import { usersApi } from '@/api/users'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { useSessionStore } from '@/store/sessionStore'

/** Mi cuenta: datos personales y eliminacion de la cuenta autenticada. */
export function AccountModule() {
  const navigate = useNavigate()
  const user = useSessionStore((s) => s.user)
  const setUser = useSessionStore((s) => s.setUser)
  const [nombre, setNombre] = useState(user?.full_name ?? '')
  const [telefono, setTelefono] = useState(user?.phone ?? '')
  const [idioma, setIdioma] = useState(user?.locale ?? 'es')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const guardar = useMutation({
    mutationFn: () =>
      usersApi.updateMe({
        full_name: nombre.trim(),
        phone: telefono.trim() || null,
        locale: idioma as 'es' | 'en',
      }),
    onSuccess: (actualizado) => {
      setUser(actualizado)
      setMensaje('Datos actualizados correctamente.')
      setError('')
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar.')
      setMensaje('')
    },
  })

  const borrar = useMutation({
    mutationFn: () => usersApi.deleteMe(),
    onSuccess: () => {
      useSessionStore.getState().clearSession()
      navigate('/login', { replace: true })
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : 'No se pudo eliminar la cuenta.')
      setConfirmando(false)
    },
  })

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <AuraPanel
        eyebrow="Tu cuenta"
        title="Mi cuenta"
        actions={
          <AuraBadge tone="neutral">
            <Mail className="mr-1 h-3 w-3" aria-hidden="true" />
            {user?.email}
          </AuraBadge>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!guardar.isPending && nombre.trim().length >= 2) guardar.mutate()
          }}
        >
          <h3 className="hud-label flex items-center gap-1.5 text-graphite-300">
            <UserRound className="h-3.5 w-3.5 text-aura-400" aria-hidden="true" />
            Datos personales
          </h3>
          <AuraInput
            label="Nombre completo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            minLength={2}
            maxLength={150}
          />
          <AuraInput
            label="Telefono"
            icon={Phone}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            maxLength={30}
            placeholder="+52 ..."
          />
          <AuraSelect
            label="Idioma de la interfaz"
            options={[
              { value: 'es', label: 'Espanol' },
              { value: 'en', label: 'English' },
            ]}
            value={idioma}
            onChange={(e) => setIdioma(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
          {mensaje && (
            <p className="flex items-start gap-1.5 text-xs text-success">
              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {mensaje}
            </p>
          )}
          <div className="flex justify-end">
            <AuraButton
              type="submit"
              size="sm"
              disabled={guardar.isPending || nombre.trim().length < 2}
            >
              <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Guardar cambios
            </AuraButton>
          </div>
        </form>
      </AuraPanel>

      {/* Zona de peligro */}
      <section className="rounded-2xl border border-danger/30 bg-danger/[0.04] p-5">
        <h3 className="hud-label flex items-center gap-1.5 text-danger">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Eliminar cuenta
        </h3>
        <p className="mt-2 text-sm text-graphite-300">
          Al eliminar tu cuenta perderas el acceso a la plataforma y tus datos quedaran marcados
          como eliminados. Esta accion no se puede deshacer.
        </p>
        {!confirmando ? (
          <div className="mt-4">
            <AuraButton variant="danger" size="sm" onClick={() => setConfirmando(true)}>
              Eliminar mi cuenta
            </AuraButton>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-danger/40 bg-black/30 p-4">
            <p className="text-sm text-bone">
              ¿Seguro que quieres eliminar tu cuenta{' '}
              <span className="font-mono text-aura-300">{user?.email}</span>? Perderas el acceso de
              inmediato.
            </p>
            <div className="flex justify-end gap-2">
              <AuraButton variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
                <X className="mr-1 h-4 w-4" aria-hidden="true" />
                Cancelar
              </AuraButton>
              <AuraButton
                variant="danger"
                size="sm"
                loading={borrar.isPending}
                onClick={() => borrar.mutate()}
              >
                Si, eliminar definitivamente
              </AuraButton>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
