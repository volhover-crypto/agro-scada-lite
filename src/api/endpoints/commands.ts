import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'
import { isActiveStatus } from '@/pages/device-helpers'

type CommandT = components['schemas']['Command']
type CommandCreateT = components['schemas']['CommandCreate']

/**
 * История команд устройства (05 §5: 10 последних). Пока есть живая команда —
 * опрос 3 с (переходы мока 2–5 с), иначе 15 с; /updates мержит в другой ключ
 * (['commands']), поэтому живость обеспечивает собственный refetchInterval.
 */
export function useCommands(actuatorId: number | null, limit = 10) {
  return useQuery({
    queryKey: ['commands', actuatorId, limit],
    queryFn: () => api.get<CommandT[]>(`/commands?actuator_id=${actuatorId}&limit=${limit}`),
    enabled: actuatorId != null,
    refetchInterval: (query) => {
      const list = query.state.data as CommandT[] | undefined
      return list?.some((c) => isActiveStatus(c.status)) ? 3_000 : 15_000
    },
  })
}

/** Создание команды: идемпотентно по idempotency_key (повтор → 200 с той же командой) */
export function useCreateCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CommandCreateT) => api.post<CommandT>('/commands', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commands'] })
      void qc.invalidateQueries({ queryKey: ['actuators'] })
    },
  })
}

/** Подтверждение команды из диалога удержания (05 §5) */
export function useConfirmCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (uuid: string) => api.post<CommandT>(`/commands/${uuid}/confirm`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commands'] })
      void qc.invalidateQueries({ queryKey: ['actuators'] })
    },
  })
}

/** Отмена: закрытие диалога подтверждения тоже вызывает /cancel (05 §5) */
export function useCancelCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (uuid: string) => api.post<CommandT>(`/commands/${uuid}/cancel`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commands'] })
      void qc.invalidateQueries({ queryKey: ['actuators'] })
    },
  })
}
