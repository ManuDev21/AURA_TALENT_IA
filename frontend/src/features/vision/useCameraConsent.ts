import { useQuery, useQueryClient } from '@tanstack/react-query'
import { privacyApi, privacyKeys } from '@/api/privacy'
import { useAuraMutation } from '@/hooks/useAuraMutation'

/** Consentimiento de camara compartido por Vision y Gestos (revocable en cualquier momento). */
export function useCameraConsent() {
  const qc = useQueryClient()
  const { data, isPending } = useQuery({ queryKey: privacyKeys.consents, queryFn: privacyApi.consents })
  const mutation = useAuraMutation({
    mutationFn: (granted: boolean) => privacyApi.set('camera', granted),
    onSuccess: (map) => qc.setQueryData(privacyKeys.consents, map),
    success: (map) => (map.camera.granted ? 'Permiso de camara concedido.' : 'Permiso de camara revocado.'),
  })
  return {
    granted: !!data?.camera.granted,
    loading: isPending,
    setGranted: (value: boolean) => mutation.mutateAsync(value),
    saving: mutation.isPending,
  }
}
