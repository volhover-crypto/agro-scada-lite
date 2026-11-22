import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'

type ObjectT = components['schemas']['Object']
type ChannelT = components['schemas']['Channel']
type BindingT = components['schemas']['Binding']

/** Раздел /settings (05 §10, enum контракта) */
export type SettingsSection =
  'command_defs' | 'alarm_defs' | 'chains' | 'channels' | 'client' | 'param_dict' | 'actuators'

export function useSettingsSection<T>(section: SettingsSection, enabled = true) {
  return useQuery({
    queryKey: ['settings', section],
    queryFn: () => api.get<T>(`/settings/${section}`),
    enabled,
  })
}

/** PUT /settings/client: флаги клиента; sim_mode сервер игнорирует (BR-FE-6) */
export function useUpdateClientSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.put<null>('/settings/client', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings', 'client'] }),
  })
}

export function useUpdateObject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<ObjectT> }) =>
      api.put<ObjectT>(`/objects/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['objects'] })
      void qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

/** Неназначенные каналы (onboarding, 05 §10) */
export function useUnassignedChannels() {
  return useQuery({
    queryKey: ['channels', 'unassigned'],
    queryFn: () => api.get<ChannelT[]>('/channels?status=unassigned'),
  })
}

/** Привязка канала к посту: прежняя активная закрывается (контракт) */
export function useCreateBinding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<BindingT>) => api.post<BindingT>('/bindings', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['channels'] })
      void qc.invalidateQueries({ queryKey: ['bindings'] })
    },
  })
}
