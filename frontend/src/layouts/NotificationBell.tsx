import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { jobKeys, notificationsApi } from '@/api/jobs'
import { AuraButton } from '@/components/aura/AuraButton'
import { useAuraStore } from '@/store/auraStore'
import { cn } from '@/utils/cn'

/** Centro de notificaciones internas (consulta periodica, sin datos en cache offline). */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: jobKeys.notifications, queryFn: notificationsApi.list, refetchInterval: 30_000 })
  const unread = data?.unread ?? 0
  const previous = useRef(unread)

  useEffect(() => {
    useAuraStore.getState().setUnread(unread)
    if (unread > previous.current) useAuraStore.getState().pulse('SPEAKING', 1400)
    previous.current = unread
  }, [unread])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const refresh = () => queryClient.invalidateQueries({ queryKey: jobKeys.notifications })

  return (
    <div ref={box} className="relative">
      <AuraButton
        variant="neo"
        size="icon"
        aria-label={unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-aura-500 px-1 font-mono text-[0.6rem] text-ink shadow-[0_0_10px_rgb(255_122_26/0.8)]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </AuraButton>
      {open && (
        <div className="glass absolute right-0 top-12 z-40 w-80 rounded-2xl p-2" role="dialog" aria-label="Notificaciones">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="hud-label text-graphite-300">Notificaciones</span>
            {unread > 0 && (
              <AuraButton variant="ghost" size="sm" icon={CheckCheck} onClick={() => void notificationsApi.readAll().then(refresh)}>
                Marcar leidas
              </AuraButton>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {!data?.items.length && <li className="px-3 py-6 text-center text-xs text-graphite-400">Sin notificaciones</li>}
            {data?.items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read_at) void notificationsApi.read(n.id).then(refresh)
                    setOpen(false)
                    if (n.link) navigate(n.link)
                  }}
                  className={cn('flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left hover:bg-white/5', !n.read_at && 'bg-aura-500/[0.06]')}
                >
                  <span className="flex items-center gap-2 text-sm text-bone">
                    {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-aura-500" aria-label="Sin leer" />}
                    {n.title}
                  </span>
                  {n.body && <span className="text-xs text-graphite-400">{n.body}</span>}
                  <span className="text-[0.6rem] text-graphite-400">{new Date(n.created_at).toLocaleString('es')}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
