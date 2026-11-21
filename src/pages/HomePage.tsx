import { useActuators } from '@/api/endpoints/actuators'
import { useAlarms } from '@/api/endpoints/alarms'
import { useModems } from '@/api/endpoints/modems'
import { useQuery } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '@/api/client'
import { OverviewPage } from './OverviewPage'

type PostT = components['schemas']['Post']

// Обзор (T09): данные для карточек
export function HomePage() {
  const { data: posts } = useQuery({
    queryKey: ['posts'],
    queryFn: () => api.get<PostT[]>('/posts'),
  })
  const { data: modems } = useModems()
  const { data: alarms } = useAlarms()
  const { data: actuators } = useActuators()

  return (
    <OverviewPage
      posts={posts ?? []}
      modems={modems ?? []}
      alarms={alarms ?? []}
      actuators={actuators ?? []}
    />
  )
}
