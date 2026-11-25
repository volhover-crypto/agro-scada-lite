/*
 * Чистые хелперы таблицы телеметрии (07 §2) — сортировка строк.
 * Перенесено из Table.tsx (этап 8, §8.7): файл компонента экспортирует только компоненты.
 */

import type { components } from '@/api/types.gen'
import { isBadQuality, isDimQuality } from './quality'

type TagValueT = components['schemas']['TagValue']

export type SortKey = 'post' | 'name' | 'value' | 'quality' | 'time'

function qualityRank(q?: string): number {
  return isBadQuality(q as never) ? 2 : isDimQuality(q as never) ? 1 : 0
}

// Компараторы по ключу (asc); null-значение — всегда в конец
const COMPARATORS: Record<
  SortKey,
  (a: TagValueT, b: TagValueT, postNames: Map<number, string>) => number
> = {
  post: (a, b, postNames) =>
    String(postNames.get(a.post_id ?? -1) ?? '').localeCompare(
      String(postNames.get(b.post_id ?? -1) ?? ''),
    ),
  name: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
  value: (a, b) => {
    if (a.value == null && b.value == null) return 0
    if (a.value == null) return 1
    if (b.value == null) return -1
    return a.value < b.value ? -1 : a.value > b.value ? 1 : 0
  },
  quality: (a, b) => qualityRank(a.quality) - qualityRank(b.quality),
  time: (a, b) =>
    (a.ts_measured ?? a.ts_received ?? '').localeCompare(b.ts_measured ?? b.ts_received ?? ''),
}

/** Чистая сортировка строк — покрывается юнит-тестом */
export function sortRows(
  rows: TagValueT[],
  key: SortKey,
  dir: 'asc' | 'desc',
  postNames: Map<number, string>,
): TagValueT[] {
  const mul = dir === 'asc' ? 1 : -1
  const cmp = COMPARATORS[key]
  return [...rows].sort((a, b) => {
    // null-значение (нет данных) — всегда в конец, независимо от направления,
    // поэтому до умножения на mul
    if (key === 'value') {
      if (a.value == null && b.value == null) return 0
      if (a.value == null) return 1
      if (b.value == null) return -1
    }
    return mul * cmp(a, b, postNames)
  })
}
