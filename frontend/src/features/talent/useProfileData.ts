import { useQuery } from '@tanstack/react-query'
import { candidateApi, queryKeys } from '@/api/talent'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import type { CandidateSkillPayload, ItemKind, ItemPayload, ProfileUpdate } from '@/types/talent'

const PROFILE_KEYS = [queryKeys.candidate, queryKeys.indicators]

export function useCandidateOverview() {
  return useQuery({ queryKey: queryKeys.candidate, queryFn: candidateApi.overview })
}

export function useUpdateProfile() {
  return useAuraMutation({
    mutationFn: (data: ProfileUpdate) => candidateApi.updateProfile(data),
    invalidate: PROFILE_KEYS,
    success: 'Perfil actualizado.',
    silentError: true,
  })
}

/** Crear/editar/eliminar entidades del perfil de un tipo concreto. */
export function useProfileItems<K extends ItemKind>(kind: K) {
  const save = useAuraMutation({
    mutationFn: ({ id, data }: { id?: string; data: ItemPayload<K> }) =>
      id ? candidateApi.updateItem(kind, id, data) : candidateApi.createItem(kind, data),
    invalidate: PROFILE_KEYS,
    success: 'Guardado.',
    silentError: true,
  })
  const remove = useAuraMutation({
    mutationFn: (id: string) => candidateApi.deleteItem(kind, id),
    invalidate: PROFILE_KEYS,
    success: 'Eliminado.',
  })
  return { save, remove }
}

export function useSkillMutations() {
  const upsert = useAuraMutation({
    mutationFn: ({ skillId, data }: { skillId: string; data: CandidateSkillPayload }) =>
      candidateApi.upsertSkill(skillId, data),
    invalidate: PROFILE_KEYS,
    success: (entry) => `${entry.skill.name} actualizada en tu constelacion.`,
  })
  const remove = useAuraMutation({
    mutationFn: (skillId: string) => candidateApi.deleteSkill(skillId),
    invalidate: PROFILE_KEYS,
    success: 'Habilidad retirada.',
  })
  return { upsert, remove }
}
