import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '../client'

type DashboardT = components['schemas']['Dashboard']

/** layout в API — произвольные конфиги виджетов (07_WIDGETS_SPEC WidgetConfig);
 *  сгенерированная схема типирует его как object без свойств */
type DashboardBody = Partial<Omit<DashboardT, 'layout'>> & { layout?: unknown }

/** Дашборды объекта (layout виджетов) */
export function useDashboards(objectId: number | null) {
  return useQuery({
    queryKey: ['dashboards', objectId],
    queryFn: () => api.get<DashboardT[]>(`/dashboards?object_id=${objectId}`),
    enabled: objectId != null,
  })
}

/** Создание дашборда (если у объекта ещё нет) */
export function useCreateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DashboardBody) => api.post<DashboardT>('/dashboards', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dashboards'] }),
  })
}

/** Сохранение layout существующего дашборда */
export function useUpdateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: DashboardBody }) =>
      api.put<DashboardT>(`/dashboards/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dashboards'] }),
  })
}
