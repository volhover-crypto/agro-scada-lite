/*
 * Чистые агрегаты Обзора (05 §2) — покрыты юнит-тестами.
 * Карточка объекта: постов онлайн N/M, тревоги по приоритетам, работающие устройства.
 */

import type { components } from '@/api/types.gen'

type ObjectT = components['schemas']['Object']
type PostT = components['schemas']['Post']
type ModemT = components['schemas']['Modem']
type AlarmT = components['schemas']['Alarm']
type ActuatorT = components['schemas']['Actuator']

export interface ObjectStats {
  postsOnline: number
  postsTotal: number
  alarms: { p1: number; p2: number; p3: number; p4: number }
  runningActuators: number
}

/** Модем «покрывает» пост, если тег этого поста belongs к его dev_eui —
 *  проще: считаем пост онлайн, когда его модем (по порядку seed) online.
 *  Здесь пост онлайн = его worst_status не offline (заполняется из тегов). */
export function objectStats(
  object: ObjectT,
  posts: PostT[],
  modems: ModemT[],
  alarms: AlarmT[],
  actuators: ActuatorT[],
): ObjectStats {
  const objectPosts = posts.filter((p) => p.object_id === object.id)
  const postsTotal = objectPosts.length
  const postsOnline = objectPosts.filter((p) => p.worst_status !== 'offline').length

  const counters = { p1: 0, p2: 0, p3: 0, p4: 0 }
  for (const a of alarms) {
    if (a.object_id !== object.id) continue
    if (a.state === 'active_unacked' || a.state === 'active_acked') {
      const key = `p${a.priority ?? 4}` as keyof typeof counters
      if (key in counters) counters[key] += 1
    }
  }

  const postsOfObject = new Set(objectPosts.map((p) => p.id))
  const runningActuators = actuators.filter(
    (a) => postsOfObject.has(a.post_id) && (a.fact_state === 'on' || a.fact_state === 'open'),
  ).length

  void modems
  return { postsOnline, postsTotal, alarms: counters, runningActuators }
}

/** Название типа объекта по 05 §10 (рус.) */
export function objectTypeLabel(type: string | undefined): string {
  const map: Record<string, string> = {
    vineyard: 'Виноградник',
    orchard: 'Сад',
    greenhouse: 'Теплица',
    pump_station: 'Насосная',
    field: 'Поле',
    other: 'Объект',
  }
  return map[type ?? ''] ?? 'Объект'
}
