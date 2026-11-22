import { useQuery } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'

type AuditEntryT = components['schemas']['AuditEntry']

export interface AuditQuery {
  from?: string | null
  to?: string | null
  entity?: string | null
  actor?: string | null
  limit: number
  offset: number
}

/** Журнал аудита (05 §9): серверные фильтры + пагинация limit/offset */
export function useAudit(q: AuditQuery) {
  const params = new URLSearchParams()
  if (q.from) params.set('from', q.from)
  if (q.to) params.set('to', q.to)
  if (q.entity) params.set('entity', q.entity)
  if (q.actor) params.set('actor', q.actor)
  params.set('limit', String(q.limit))
  params.set('offset', String(q.offset))
  return useQuery({
    queryKey: ['audit', q.from ?? '', q.to ?? '', q.entity ?? '', q.actor ?? '', q.limit, q.offset],
    queryFn: () => api.get<AuditEntryT[]>(`/audit?${params.toString()}`),
  })
}
