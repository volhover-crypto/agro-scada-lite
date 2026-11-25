import { describe, expect, it } from 'vitest'
import type { components } from '@/api/types.gen'
import {
  baseStationPoints,
  hasActiveAlarm,
  labelTagsFor,
  metersFromLatLon,
  scenePositions,
  sceneScale,
  statusColor,
} from './scene3d-helpers'

type PostT = components['schemas']['Post']
type TagValueT = components['schemas']['TagValue']

function post(over: Partial<PostT>): PostT {
  return {
    id: 1,
    object_id: 1,
    name: 'Пост 1',
    plot_name: 'Участок А',
    lat: 44.53,
    lon: 33.7,
    scene_x: 0,
    scene_y: 0,
    worst_status: 'ok',
    ...over,
  } as PostT
}

describe('scenePositions — scene_x/y или lat/lon (BR-2)', () => {
  it('использует scene_x/y, когда заданы', () => {
    const pos = scenePositions([
      post({ id: 1, scene_x: 8, scene_y: 16 }),
      post({ id: 2, scene_x: 16, scene_y: 0 }),
    ])
    expect(pos).toHaveLength(2)
    expect(pos[0]).toMatchObject({ x: 8, y: 16, status: 'ok' })
    expect(pos[1]).toMatchObject({ x: 16, y: 0 })
  })

  it('NULL scene_x/y → расчёт из lat/lon относительно центра', () => {
    // 1 градус широты ≈ 111 км
    const pos = scenePositions([
      post({ id: 1, scene_x: null, scene_y: null, lat: 44.53, lon: 33.7 }),
      post({ id: 2, scene_x: null, scene_y: null, lat: 44.531, lon: 33.7 }),
    ])
    expect(pos[1]!.x).toBeCloseTo(0, 0)
    expect(pos[1]!.y).toBeGreaterThan(100) // 0.001° ≈ 111 м
    expect(pos[0]!.x).toBeCloseTo(0, 0)
    expect(pos[0]!.y).toBeCloseTo(0, 0)
  })
})

describe('baseStationPoints — две БС по краям сцены', () => {
  it('по одной за min и max границами', () => {
    const bs = baseStationPoints([
      { postId: 1, name: '', plot: '', status: 'ok', x: 4, y: 8 },
      { postId: 2, name: '', plot: '', status: 'ok', x: 16, y: 0 },
    ])
    expect(bs[0]![0]).toBeLessThan(4)
    expect(bs[1]![0]).toBeGreaterThan(16)
  })
})

describe('labelTagsFor — 1–3 значения по приоритету (грунт→воздух→давление) + добор (T20)', () => {
  const tag = (tagId: string, value: number | null): TagValueT =>
    ({
      tag_id: tagId,
      name: 'Параметр',
      unit: '%',
      value,
      quality: 'good',
      kind: 'fact',
      origin: 'live',
      ts_measured: '2026-11-21T10:00:00+03:00',
      ts_received: '2026-11-21T10:00:01+03:00',
    }) as TagValueT

  it('грунт и воздух, максимум 3', () => {
    const t5 = (tagId: string, v: number) => ({ ...tag(tagId, v), post_id: 5 })
    const out = labelTagsFor(5, [
      t5('A/1/150/1', 9.5),
      t5('A/3/-10/1', 27.4),
      t5('A/3/-30/1', 28.1),
      t5('A/6/0/1', 2.8),
    ])
    const codes = out.map((o) => Number(o.tag.tag_id?.split('/')[1]))
    // по одному параметру каждого вида: грунт → воздух → давление
    expect(codes).toEqual([3, 1, 6])
  })

  it('метеопост без кодов 3 и 6 — добирает доступные числовые теги (максимум 3, без дублей)', () => {
    const t7 = (tagId: string, v: number | null) => ({ ...tag(tagId, v), post_id: 7 })
    const out = labelTagsFor(7, [
      t7('M/1/200/1', 18.2),
      t7('M/2/200/1', 64),
      t7('M/2/200/1', 64),
      t7('M/8/200/1', 4.5),
      t7('M/9/200/1', 12.0),
      t7('M/10/200/1', null),
    ])
    expect(out).toHaveLength(3)
    const ids = out.map((o) => o.tag.tag_id)
    expect(ids).toEqual(['M/1/200/1', 'M/2/200/1', 'M/8/200/1'])
  })

  it('пост без числовых значений → пусто', () => {
    expect(labelTagsFor(99, [tag('A/1/150/1', 9.5)])).toEqual([])
    expect(labelTagsFor(8, [{ ...tag('M/1/200/1', null), post_id: 8 }])).toEqual([])
  })
})

describe('hasActiveAlarm / statusColor / sceneScale', () => {
  const alarm = { post_id: 5, state: 'active_unacked' } as never

  it('активная тревога по посту', () => {
    expect(hasActiveAlarm(5, [alarm])).toBe(true)
    expect(hasActiveAlarm(6, [alarm])).toBe(false)
  })

  it('цвета статусов из токенов', () => {
    expect(statusColor('ok')).toBe('#3E9A4A')
    expect(statusColor('alarm')).toBe('#C62828')
    expect(statusColor('offline')).toBe('#9A948A')
  })

  it('масштаб: посты вписываются в ±12 единиц', () => {
    const scale = sceneScale([{ postId: 1, name: '', plot: '', status: 'ok', x: 24, y: 16 }])
    expect(24 * scale).toBeCloseTo(12)
  })
})

describe('metersFromLatLon', () => {
  it('первая точка — начало координат, смещение по широте в метрах', () => {
    const out = metersFromLatLon([
      post({ lat: 44.53, lon: 33.7 }),
      post({ lat: 44.5305, lon: 33.7 }),
    ])
    expect(out[0]).toMatchObject({ x: 0, y: 0 })
    expect(Math.round(out[1]!.y)).toBe(56)
  })
})
