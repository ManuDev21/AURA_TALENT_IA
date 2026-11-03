import { useQuery } from '@tanstack/react-query'
import { Orbit, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { candidateApi, queryKeys } from '@/api/talent'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraConfirmButton } from '@/components/aura/AuraConfirmButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraExplain } from '@/components/aura/AuraExplain'
import { AuraInput } from '@/components/aura/AuraInput'
import { SkillConstellation } from '@/features/talent/SkillConstellation'
import { SkillPicker } from '@/features/talent/SkillPicker'
import { useSkillMutations } from '@/features/talent/useProfileData'
import type { CandidateSkill } from '@/types/talent'
import { cn } from '@/utils/cn'
import { PROFICIENCY } from '@/utils/labels'

export function SkillsWorkspace({ skills }: { skills: CandidateSkill[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { upsert, remove } = useSkillMutations()
  const selected = skills.find((s) => s.skill.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-5">
      <SkillPicker
        excludeIds={skills.map((s) => s.skill.id)}
        onSelect={(skill) =>
          upsert.mutate(
            { skillId: skill.id, data: { proficiency: 3 } },
            { onSuccess: () => setSelectedId(skill.id) },
          )
        }
      />

      {skills.length === 0 ? (
        <AuraEmptyState icon={Orbit} title="Tu constelacion esta vacia">
          Agrega habilidades del catalogo para verlas orbitar alrededor de tu perfil.
        </AuraEmptyState>
      ) : (
        <div className="neo-inset rounded-2xl p-2">
          <SkillConstellation skills={skills} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      )}

      {selected && (
        <SkillEditor
          key={selected.skill.id}
          entry={selected}
          saving={upsert.isPending}
          removing={remove.isPending}
          onSave={(data) => upsert.mutate({ skillId: selected.skill.id, data })}
          onRemove={() => remove.mutate(selected.skill.id, { onSuccess: () => setSelectedId(null) })}
        />
      )}

      <IndicatorsPanel skillsCount={skills.length} />
    </div>
  )
}

interface SkillEditorProps {
  entry: CandidateSkill
  saving: boolean
  removing: boolean
  onSave: (data: { proficiency: number; years_experience: number | null }) => void
  onRemove: () => void
}

function SkillEditor({ entry, saving, removing, onSave, onRemove }: SkillEditorProps) {
  const [level, setLevel] = useState(entry.proficiency)
  const [years, setYears] = useState(entry.years_experience ?? '')
  useEffect(() => setLevel(entry.proficiency), [entry.proficiency])

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-aura-500/20 bg-aura-500/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold">{entry.skill.name}</p>
          <p className="hud-label text-graphite-400">{entry.skill.category?.name}</p>
        </div>
        <AuraConfirmButton label={`Retirar ${entry.skill.name}`} loading={removing} onConfirm={onRemove} />
      </div>
      <div role="radiogroup" aria-label="Nivel de dominio" className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={level === n}
            onClick={() => setLevel(n)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl py-2 text-xs transition',
              level === n ? 'neo text-aura-400' : 'text-graphite-400 hover:text-bone',
            )}
          >
            <span className="font-display text-base">{n}</span>
            <span className="text-[0.6rem]">{PROFICIENCY[n]}</span>
          </button>
        ))}
      </div>
      <div className="flex items-end gap-3">
        <AuraInput
          className="w-40"
          label="Anos de experiencia"
          type="number"
          min={0}
          max={60}
          step={0.5}
          value={years}
          onChange={(e) => setYears(e.target.value)}
        />
        <AuraButton
          icon={Save}
          loading={saving}
          onClick={() => onSave({ proficiency: level, years_experience: years === '' ? null : Number(years) })}
        >
          Guardar nivel
        </AuraButton>
      </div>
    </div>
  )
}

function IndicatorsPanel({ skillsCount }: { skillsCount: number }) {
  const { data } = useQuery({ queryKey: queryKeys.indicators, queryFn: candidateApi.indicators, enabled: skillsCount > 0 })
  if (!data || data.indicators.length === 0) return null

  return (
    <section aria-label="Indicadores de talento" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="hud-label text-graphite-300">Indicadores por area</h3>
        <AuraBadge tone="warning">Generados por el sistema</AuraBadge>
      </div>
      <ul className="flex flex-col gap-3">
        {data.indicators.map((indicator) => (
          <li key={indicator.category_code}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{indicator.category_name}</span>
              <span className="font-mono text-aura-400">{indicator.score}%</span>
            </div>
            <div
              className="neo-inset h-2 overflow-hidden rounded-full"
              role="meter"
              aria-valuenow={indicator.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${indicator.category_name}: ${indicator.score}%`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-glow to-aura-600 shadow-[0_0_10px_rgb(255_122_26/0.6)] transition-[width] duration-700"
                style={{ width: `${indicator.score}%` }}
              />
            </div>
            <p className="mt-1 text-[0.7rem] text-graphite-400">
              Basado en {indicator.skills_count} habilidad{indicator.skills_count === 1 ? '' : 'es'}:{' '}
              {indicator.factors.map((f) => f.skill).join(', ')}
            </p>
          </li>
        ))}
      </ul>
      <AuraExplain method={data.method} dataUsed={data.data_used} limitations={data.limitations} disclaimer={data.disclaimer} />
    </section>
  )
}
