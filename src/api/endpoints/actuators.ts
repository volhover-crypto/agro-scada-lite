import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'

type ActuatorT = components['schemas']['Actuator']

/** Исполнители (по всем объектам или одному) */
export function useActuators(objectId?: number) {
  return useQuery({
    queryKey: ['actuators', objectId ?? 'all'],
    queryFn: () => api.get<ActuatorT[]>(`/actuators${objectId ? `?object_id=${objectId}` : ''}`),
  })
}

/** Переключение режима Авто/Ручной (T12: полный экран устройства) */
export function useSetMode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, mode }: { id: number; mode: 'auto' | 'manual' }) =>
      api.put<ActuatorT>(`/actuators/${id}/mode`, { mode }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['actuators'] }),
  })
}
