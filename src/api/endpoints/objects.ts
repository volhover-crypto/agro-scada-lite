import { useQuery } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'
import { getSessionToken } from '@/state/session'

type ObjectT = components['schemas']['Object']
type PostT = components['schemas']['Post']

/** Список объектов; запрос уходит только при наличии токена —
 *  иначе на /login серия 401 перезаписывает state.from редиректа */
export function useObjects(enabled = true) {
  return useQuery({
    queryKey: ['objects'],
    queryFn: () => api.get<ObjectT[]>('/objects'),
    enabled: enabled && getSessionToken() != null,
  })
}

/** Все посты (для страниц без object_id в параметрах, T14/T16) */
export function usePosts(enabled = true) {
  return useQuery({
    queryKey: ['posts', 'all'],
    queryFn: () => api.get<PostT[]>('/posts'),
    enabled: enabled && getSessionToken() != null,
  })
}
