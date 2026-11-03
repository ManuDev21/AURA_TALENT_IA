import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { useAuraStore } from '@/store/auraStore'
import { toast } from '@/store/toastStore'

interface Options<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData>
  invalidate?: QueryKey[]
  success?: string | ((data: TData) => string)
  onSuccess?: (data: TData, vars: TVars) => void
  /** Si es true, el error se deja al formulario (no se muestra aviso global). */
  silentError?: boolean
}

/** Mutacion con retroalimentacion de AURA: el nucleo reacciona y se muestra un aviso. */
export function useAuraMutation<TData = unknown, TVars = void>(options: Options<TData, TVars>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: () => useAuraStore.getState().setCoreState('THINKING'),
    onSuccess: async (data, vars) => {
      await Promise.all((options.invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      useAuraStore.getState().pulse('SUCCESS')
      if (options.success) toast.success(typeof options.success === 'function' ? options.success(data) : options.success)
      options.onSuccess?.(data, vars)
    },
    onError: (error) => {
      useAuraStore.getState().pulse('ERROR')
      if (!options.silentError) {
        toast.error(error instanceof ApiError ? error.message : 'No fue posible conectar con AURA.')
      }
    },
  })
}
