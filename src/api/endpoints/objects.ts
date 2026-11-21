import { useQuery } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'
import { getSessionToken } from '@/state/session'

type ObjectT = components['schemas']['Object']

/** Список объектов; запрос уходит только при наличии токена —
 *  иначе на /login серия 401 перезаписывает state.from редиректа */
export function useObjects(enabled = true) {
  return useQuery({
    queryKey: ['objects'],
    queryFn: () => api.get<ObjectT[]>('/objects'),
    enabled: enabled && getSessionToken() != null,
  })
}
