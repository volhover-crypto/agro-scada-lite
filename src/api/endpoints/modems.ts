import { useQuery } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'

type ModemT = components['schemas']['Modem']

export function useModems() {
  return useQuery({
    queryKey: ['modems'],
    queryFn: () => api.get<ModemT[]>('/modems'),
  })
}
