import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'

type ScheduleT = components['schemas']['Schedule']

/** Расписания (05 §8) */
export function useSchedules() {
  return useQuery({
    queryKey: ['schedules'],
    queryFn: () => api.get<ScheduleT[]>('/schedules'),
  })
}

export interface CreateScheduleResult extends ScheduleT {
  /** Контракт: warnings: [OVERLAP] при пересечении на одном выходе */
  warnings?: string[]
}

export function useCreateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<ScheduleT>) => api.post<CreateScheduleResult>('/schedules', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules'] }),
  })
}

export function useApproveSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<CreateScheduleResult>(`/schedules/${id}/approve`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules'] }),
  })
}
