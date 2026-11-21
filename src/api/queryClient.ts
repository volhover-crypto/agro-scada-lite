import { QueryClient } from '@tanstack/react-query'

// Единый клиент кэша. Поллер /updates раскладывает сюда изменения (02 §3),
// экраны читают через useQuery/useXxx-хуки из api/endpoints.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})
