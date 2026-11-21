import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'

type RuleT = components['schemas']['Rule']

/** Правила автоматики (05 §8) */
export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: () => api.get<RuleT[]>('/rules'),
  })
}

export function useCreateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<RuleT>) => api.post<RuleT>('/rules', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rules'] }),
  })
}

/** Изменение: сервер сбрасывает approval_status в pending (контракт) */
export function useUpdateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<RuleT> }) =>
      api.put<RuleT>(`/rules/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rules'] }),
  })
}

export function useApproveRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<RuleT>(`/rules/${id}/approve`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rules'] }),
  })
}
