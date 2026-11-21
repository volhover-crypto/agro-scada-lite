import { useQuery } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'

type ObjectT = components['schemas']['Object']

export function useObjects() {
  return useQuery({
    queryKey: ['objects'],
    queryFn: () => api.get<ObjectT[]>('/objects'),
  })
}
