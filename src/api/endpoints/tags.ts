import { useQuery } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'

type TagValueT = components['schemas']['TagValue']
type SeriesT = components['schemas']['Series']

/** Текущие значения тегов (07 §1: опрос 30–60 с) */
export function useTagValues(ids: string[], refetchMs = 30_000) {
  const key = ids.join(',')
  return useQuery({
    queryKey: ['tags-current', key],
    queryFn: () => api.get<TagValueT[]>(`/tags/current?ids=${encodeURIComponent(key)}`),
    enabled: ids.length > 0,
    refetchInterval: refetchMs,
    staleTime: Math.max(5_000, refetchMs - 5_000),
  })
}

export interface HistoryParams {
  from: string
  to: string
  agg?: 'raw' | 'avg' | 'min' | 'max'
  step?: '15m' | '1h' | '1d'
}

/** История тегов (до 8 — лимит контракта) */
export function useTagHistory(ids: string[], p: HistoryParams) {
  const key = ids.join(',')
  const q = new URLSearchParams({ ids: key, from: p.from, to: p.to })
  if (p.agg) q.set('agg', p.agg)
  if (p.step) q.set('step', p.step)
  return useQuery({
    queryKey: ['tags-history', key, p.from, p.to, p.agg ?? 'raw', p.step ?? '1h'],
    queryFn: () => api.get<SeriesT[]>(`/tags/history?${q.toString()}`),
    enabled: ids.length > 0 && ids.length <= 8,
  })
}
