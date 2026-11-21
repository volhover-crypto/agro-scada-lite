import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'

type AlarmT = components['schemas']['Alarm']

export function useAlarms() {
  return useQuery({
    queryKey: ['alarms'],
    queryFn: () => api.get<AlarmT[]>('/alarms'),
  })
}

/** Подтверждение тревоги: после — инвалидация (поллер донесёт то же самое) */
export function useAckAlarm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<AlarmT>(`/alarms/${id}/ack`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['alarms'] }),
  })
}
