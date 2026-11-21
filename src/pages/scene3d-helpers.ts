/*
 * Чистые хелперы 3D-сцены (07 §3.1) — покрыты юнит-тестами.
 * Позиции постов: scene_x/scene_y (BR-2) или расчёт из lat/lon;
 * линии связи к двум БС — позиции БС условные ([ASSUMPTION], BR-FE-1:
 * данных о БС в контракте нет — размещаем по краям сцены).
 */

import type { components } from '@/api/types.gen'

type PostT = components['schemas']['Post']
type TagValueT = components['schemas']['TagValue']
type ActuatorT = components['schemas']['Actuator']
type AlarmT = components['schemas']['Alarm']

export interface ScenePosition {
  postId: number
  name: string
  plot: string
  status: 'ok' | 'warn' | 'alarm' | 'offline'
  x: number
  y: number
}

/** Метры между lat/lon (грубое плоское преобразование относительно первой точки) */
export function metersFromLatLon(posts: PostT[]): Array<{ id: number; x: number; y: number }> {
  const first = posts[0]
  if (!first || first.lat == null || first.lon == null) return []
  const lat0 = first.lat
  const lon0 = first.lon
  return posts.map((p) => ({
    id: p.id ?? -1,
    x: ((p.lon ?? lon0) - lon0) * 111_320 * Math.cos((lat0 * Math.PI) / 180),
    y: ((p.lat ?? lat0) - lat0) * 111_320,
  }))
}

/** Позиции постов в метрах: scene_x/scene_y, при NULL — из lat/lon (BR-2) */
/** Координаты одного поста: scene_x/y или расчёт из lat/lon */
function postCoords(
  p: PostT,
  fromLatLon: Map<number, { x: number; y: number }>,
): { x: number; y: number } {
  if (p.scene_x != null && p.scene_y != null) return { x: p.scene_x, y: p.scene_y }
  return fromLatLon.get(p.id ?? -1) ?? { x: 0, y: 0 }
}

export function scenePositions(posts: PostT[]): ScenePosition[] {
  const fromLatLon = new Map(metersFromLatLon(posts).map((m) => [m.id, m]))
  return posts
    .filter((p) => p.lat != null && p.lon != null)
    .map((p) => {
      const coords = postCoords(p, fromLatLon)
      return {
        postId: p.id ?? -1,
        name: p.name ?? '',
        plot: p.plot_name ?? '',
        status: p.worst_status ?? 'ok',
        x: coords.x,
        y: coords.y,
      }
    })
}

/** Условные позиции двух БС по краям сцены (BR-FE-1 не решён) */
export function baseStationPoints(positions: ScenePosition[]): Array<[number, number]> {
  const xs = positions.map((p) => p.x)
  const ys = positions.map((p) => p.y)
  const minX = Math.min(0, ...xs)
  const maxX = Math.max(0, ...xs)
  const minY = Math.min(0, ...ys)
  const maxY = Math.max(0, ...ys)
  return [
    [minX - 8, minY - 6],
    [maxX + 8, maxY + 6],
  ]
}

/** Цвет кольца поста по худшему статусу (06 §2) */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    ok: '#3E9A4A',
    warn: '#7A6000',
    alarm: '#C62828',
    offline: '#9A948A',
  }
  return map[status] ?? '#3E9A4A'
}

/** 1–3 ключевых значения для метки поста: грунт → воздух → давление (07 §3.1) */
export function labelTagsFor(
  postId: number,
  current: TagValueT[],
): Array<{ tag: TagValueT; label: string }> {
  const priority = [3, 1, 6]
  const mine = current.filter((t) => t.post_id === postId)
  const out: Array<{ tag: TagValueT; label: string }> = []
  for (const code of priority) {
    const tag = mine.find((t) => Number((t.tag_id ?? '').split('/')[1]) === code)
    if (tag && typeof tag.value === 'number') {
      out.push({ tag, label: tag.name ?? '' })
    }
    if (out.length >= 3) break
  }
  return out
}

/** Есть ли у поста активная тревога (красный значок на метке) */
export function hasActiveAlarm(postId: number, alarms: AlarmT[]): boolean {
  return alarms.some(
    (a) => a.post_id === postId && (a.state === 'active_unacked' || a.state === 'active_acked'),
  )
}

/** Исполнители поста с состоянием для значков сцены */
export function actuatorsOf(postId: number, actuators: ActuatorT[]): ActuatorT[] {
  return actuators.filter((a) => a.post_id === postId)
}

/** Масштаб сцены: посты занимают ±~12 единиц независимо от их разметки */
export function sceneScale(positions: ScenePosition[]): number {
  const extent = Math.max(1, ...positions.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))
  return 12 / extent
}
