import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // No reintentar errores del cliente (4xx): no se resuelven solos
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
})
