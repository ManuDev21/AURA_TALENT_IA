import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Briefcase, CircleCheck, CirclePause, CirclePlay, Download, Lock, Pencil, Plus, Upload, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { jobKeys, jobsApi } from '@/api/jobs'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraConfirmButton } from '@/components/aura/AuraConfirmButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { JobDetail } from '@/features/jobs/JobDetail'
import { JobForm } from '@/features/jobs/JobForm'
import { JOB_STATUS, MODALITY } from '@/features/jobs/labels'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { useSessionStore } from '@/store/sessionStore'
import { parseJobsCsv } from '@/features/jobs/jobsCsv'
import type { CompanyJob, JobStatus } from '@/types/jobs'

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; id: string } | { kind: 'view'; id: string }

export function CompanyJobsModule() {
  const { data: jobs, isPending } = useQuery({ queryKey: jobKeys.company, queryFn: jobsApi.companyJobs })
  const [view, setView] = useState<View>({ kind: 'list' })
  const canWrite = useSessionStore((s) => s.user?.permissions.includes('jobs:write') ?? false)
  const current = view.kind === 'edit' || view.kind === 'view' ? jobs?.find((j) => j.id === view.id) : undefined
  const back = () => setView({ kind: 'list' })

  return (
    <AuraPanel eyebrow="Recruit" title="Vacantes" className="flex flex-col gap-4">
      {view.kind !== 'list' && (
        <AuraButton variant="ghost" size="sm" icon={ArrowLeft} className="self-start" onClick={back}>
          Todas las vacantes
        </AuraButton>
      )}
      {view.kind === 'new' && <JobForm onDone={back} />}
      {view.kind === 'edit' && current && <JobForm job={current} onDone={back} />}
      {view.kind === 'view' && current && (
        <JobDetail job={current} footer={<JobActions job={current} onEdit={() => setView({ kind: 'edit', id: current.id })} onDeleted={back} />} />
      )}
      {view.kind === 'list' &&
        (isPending ? (
          <div className="flex justify-center py-12">
            <AuraLoader label="Cargando vacantes" />
          </div>
        ) : (
          <>
            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <AuraButton icon={Plus} onClick={() => setView({ kind: 'new' })}>Nueva vacante</AuraButton>
                <JobImportExport />
              </div>
            )}
            {!jobs?.length ? (
              <AuraEmptyState icon={Briefcase} title="Aun no hay vacantes">
                Crea un borrador, revisalo y publicalo cuando este listo.
              </AuraEmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {jobs.map((job) => (
                  <JobRow key={job.id} job={job} onOpen={() => setView({ kind: 'view', id: job.id })} />
                ))}
              </ul>
            )}
          </>
        ))}
    </AuraPanel>
  )
}

function JobImportExport() {
  const importJobs = useAuraMutation({
    mutationFn: jobsApi.importDrafts,
    invalidate: [jobKeys.company],
    success: (result) => `${result.created} borrador(es) importado(s). Revisa cada uno antes de publicarlo.`,
  })
  const [error, setError] = useState('')
  const parse = async (file: File) => {
    setError('')
    if (file.size > 5_000_000) return setError('El CSV supera el límite de 5 MB.')
    try {
      const rows = await parseJobsCsv(await file.text())
      await importJobs.mutateAsync(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el CSV.')
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AuraButton variant="neo" icon={Download} onClick={() => void jobsApi.exportCompanyCsv()}>Exportar CSV</AuraButton>
      <label className="neo inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm text-bone hover:text-aura-400">
        <Upload className="h-4 w-4" aria-hidden="true" /> Importar CSV
        <input className="sr-only" type="file" accept=".csv,text/csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) void parse(file); e.currentTarget.value = '' }} />
      </label>
      {importJobs.isPending && <span className="text-xs text-graphite-400">Importando borradores…</span>}
      {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
      <p className="w-full text-[0.68rem] text-graphite-500">La importación solo crea borradores. Revisa habilidades, requisitos y datos importados antes de publicar.</p>
    </div>
  )
}


function JobRow({ job, onOpen }: { job: CompanyJob; onOpen: () => void }) {
  const status = JOB_STATUS[job.status]
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition hover:border-aura-500/40"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-bone">{job.title}</p>
          <p className="text-xs text-graphite-400">
            {MODALITY[job.modality]}
            {job.location && ` / ${job.location}`} / actualizada {new Date(job.updated_at).toLocaleDateString('es')} / vigencia {job.last_confirmed_at ? new Date(job.last_confirmed_at).toLocaleDateString('es') : 'no confirmada'}
          </p>
        </div>
        <span className="flex items-center gap-1 text-sm text-graphite-300" title="Postulaciones activas">
          <Users className="h-4 w-4" aria-hidden="true" /> {job.applications_count}
        </span>
        <AuraBadge tone={status.tone}>{status.label}</AuraBadge>
      </button>
    </li>
  )
}

const ACTIONS: Record<JobStatus, { to: JobStatus; label: string; icon: typeof Lock }[]> = {
  DRAFT: [{ to: 'PUBLISHED', label: 'Publicar', icon: CirclePlay }],
  PUBLISHED: [{ to: 'PAUSED', label: 'Pausar', icon: CirclePause }],
  PAUSED: [{ to: 'PUBLISHED', label: 'Reanudar', icon: CirclePlay }],
  CLOSED: [],
}

function JobActions({ job, onEdit, onDeleted }: { job: CompanyJob; onEdit: () => void; onDeleted: () => void }) {
  const perms = useSessionStore((s) => s.user?.permissions ?? [])
  const canPublish = perms.includes('jobs:publish')
  const canWrite = perms.includes('jobs:write')
  const setStatus = useAuraMutation({
    mutationFn: (status: JobStatus) => jobsApi.setStatus(job.id, status),
    invalidate: [jobKeys.company],
    success: (j) => `Vacante: ${JOB_STATUS[j.status].label.toLowerCase()}.`,
  })
  const confirmActive = useAuraMutation({
    mutationFn: () => jobsApi.confirmActive(job.id),
    invalidate: [jobKeys.company],
    success: 'Vigencia de la vacante confirmada.',
  })
  const remove = useAuraMutation({ mutationFn: () => jobsApi.remove(job.id), invalidate: [jobKeys.company], success: 'Borrador eliminado.', onSuccess: onDeleted })

  return (
    <div className="neo-inset flex flex-wrap items-center gap-2 rounded-xl p-3">
      <AuraBadge tone={JOB_STATUS[job.status].tone}>{JOB_STATUS[job.status].label}</AuraBadge>
      <span className="text-xs text-graphite-400">{job.applications_count} postulaciones</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {job.applications_count > 0 && (
          <Link to={`/company/pipeline?job=${job.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-aura-400 hover:bg-white/5">
            <Users className="h-4 w-4" aria-hidden="true" /> Ver pipeline
          </Link>
        )}
        {canWrite && job.status !== 'CLOSED' && (
          <AuraButton size="sm" variant="ghost" icon={Pencil} onClick={onEdit}>
            Editar
          </AuraButton>
        )}
        {canPublish && job.status === 'PUBLISHED' && (
          <AuraButton size="sm" variant="ghost" icon={CircleCheck} loading={confirmActive.isPending} onClick={() => confirmActive.mutate()}>
            Confirmar vigencia
          </AuraButton>
        )}
        {canPublish &&
          ACTIONS[job.status].map((a) => (
            <AuraButton key={a.to} size="sm" variant="neo" icon={a.icon} loading={setStatus.isPending} onClick={() => setStatus.mutate(a.to)}>
              {a.label}
            </AuraButton>
          ))}
        {canPublish && job.status !== 'CLOSED' && (
          <CloseJobButton loading={setStatus.isPending} onConfirm={() => setStatus.mutate('CLOSED')} />
        )}
        {canWrite && job.status === 'DRAFT' && job.applications_count === 0 && (
          <AuraConfirmButton label="Eliminar borrador" loading={remove.isPending} onConfirm={() => remove.mutate()} />
        )}
      </div>
    </div>
  )
}

function CloseJobButton({ loading, onConfirm }: { loading: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  return armed ? (
    <span className="flex items-center gap-1" role="group" aria-label="Confirmar cierre">
      <AuraButton size="sm" variant="danger" icon={Lock} loading={loading} onClick={onConfirm}>
        Confirmar cierre
      </AuraButton>
      <AuraButton size="sm" variant="ghost" onClick={() => setArmed(false)}>
        Cancelar
      </AuraButton>
    </span>
  ) : (
    <AuraButton size="sm" variant="ghost" icon={Lock} onClick={() => setArmed(true)}>
      Cerrar
    </AuraButton>
  )
}
