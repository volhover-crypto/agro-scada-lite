import { describe, expect, it } from 'vitest'
import type { components } from '@/api/types.gen'
import { sortRows, type SortKey } from './Table'
import { dailyBars } from './Bar'
import { toXY2 } from './chart-helpers'

type TagValueT = components['schemas']['TagValue']

function tv(over: Partial<TagValueT>): TagValueT {
  return {
    tag_id: 'x',
    name: 'Парам',
    post_id: 1,
    unit: '%',
    value: 10,
    quality: 'good',
    kind: 'fact',
    origin: 'live',
    ts_measured: '2026-11-21T10:00:00+03:00',
    ts_received: '2026-11-21T10:00:01+03:00',
    ...over,
  } as TagValueT
}

const posts = new Map([
  [1, 'Пост 1'],
  [2, 'Пост 2'],
])

describe('sortRows (Table)', () => {
  const rows = [
    tv({
      tag_id: 'a',
      name: 'Влажность',
      value: 30,
      post_id: 2,
      ts_measured: '2026-11-21T10:00:00+03:00',
    }),
    tv({
      tag_id: 'b',
      name: 'Температура',
      value: 5,
      post_id: 1,
      ts_measured: '2026-11-21T12:00:00+03:00',
    }),
    tv({
      tag_id: 'c',
      name: 'Осадки',
      value: null,
      quality: 'sensor_error',
      post_id: 1,
      ts_measured: '2026-11-21T11:00:00+03:00',
    }),
  ]

  it.each<[SortKey, string[]]>([
    ['name', ['a', 'c', 'b']], // ru-алфавит: Влажность, Осадки, Температура
    ['value', ['b', 'a', 'c']], // null — всегда в конец
    ['post', ['b', 'c', 'a']],
    ['time', ['a', 'c', 'b']],
  ])('сортировка %s asc', (key, expectedOrder) => {
    const sorted = sortRows(rows, key, 'asc', posts)
    expect(sorted.map((r) => r.tag_id)).toEqual(expectedOrder)
  })

  it('desc: по убыванию, null всё равно в конце', () => {
    const sorted = sortRows(rows, 'value', 'desc', posts)
    expect(sorted.map((r) => r.tag_id)).toEqual(['a', 'b', 'c'])
  })

  it('ошибки качества ниже нормальных при сортировке по качеству', () => {
    const sorted = sortRows(rows, 'quality', 'desc', posts)
    expect(sorted[0]!.tag_id).toBe('c') // sensor_error ранг выше
  })
})

describe('dailyBars (Bar)', () => {
  it('суммирует значения по суткам', () => {
    const day = (n: number, h: number) => new Date(Date.UTC(2026, 10, n, h)).toISOString()
    const bars = dailyBars([
      [day(1, 1), 1, 'good'],
      [day(1, 5), 2, 'good'],
      [day(2, 3), 4, 'good'],
    ])
    expect(bars).toHaveLength(2)
    expect(bars[0]![1]).toBe(3)
    expect(bars[1]![1]).toBe(4)
  })

  it('null-точки пропускаются', () => {
    const day = (n: number) => new Date(Date.UTC(2026, 10, n)).toISOString()
    expect(
      dailyBars([
        [day(1), null as unknown as number, 'good'],
        [day(1), 5, 'good'],
      ])[0]![1],
    ).toBe(5)
  })

  it('toXY2 сортирует пары', () => {
    expect(
      toXY2([
        [5, 1],
        [1, 2],
      ])[0]![0],
    ).toBe(1)
  })
})
