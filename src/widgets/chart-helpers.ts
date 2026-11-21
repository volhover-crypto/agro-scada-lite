/*
 * Чистые хелперы графиков (T08) — без React/ECharts, покрыты юнит-тестами.
 * Правила: 02_ARCHITECTURE_FE §7 (>5000 точек → агрегат), 07_WIDGETS_SPEC §2
 * (до 8 тегов, 2 оси Y по единицам, прогноз пунктиром).
 */

import type { components } from '@/api/types.gen'

type SeriesT = components['schemas']['Series']
type TagValueT = components['schemas']['TagValue']

export const MAX_SERIES = 8

export type Period = '24h' | '7d' | '30d' | 'custom'
export type Agg = 'raw' | 'avg' | 'min' | 'max'
export type Step = '15m' | '1h' | '1d'

export interface PeriodRange {
  from: string
  to: string
}

export const PERIOD_MS: Record<Exclude<Period, 'custom'>, number> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
  '30d': 30 * 24 * 3_600_000,
}

export function periodRange(p: Period, nowMs: number = Date.now()): PeriodRange {
  const to = new Date(nowMs + 3 * 3_600_000).toISOString().replace('Z', '+03:00')
  const fromMs = nowMs - (PERIOD_MS[p as Exclude<Period, 'custom'>] ?? 0)
  const from = new Date(fromMs + 3 * 3_600_000).toISOString().replace('Z', '+03:00')
  return { from, to }
}

/**
 * Шаг и агрегат по периоду (02 §7: при больших периодах — агрегат).
 * Оценка точек: период / 15 мин (минимальный шаг сырых данных мока).
 * >5000 точек на raw невозможны у нас, но 30д raw ≈ 2880×— всё равно
 * тяжелы для графика: 30д → 1d, 7д → 1h, 24ч → 1h.
 */
export function pickStepAgg(p: Period, agg: Agg): { step: Step; agg: Agg } {
  if (p === '30d') return { step: '1d', agg: agg === 'raw' ? 'avg' : agg }
  if (p === '7d') return { step: '1h', agg: agg === 'raw' ? 'avg' : agg }
  return { step: '1h', agg }
}

/** Можно ли добавить ряд: не больше MAX_SERIES и без дублей */
export function canAddTag(selected: string[], tagId: string): boolean {
  return !selected.includes(tagId) && selected.length < MAX_SERIES
}

/** Группировка единиц в оси Y: максимум 2 (07 §2); первая единица — левая ось.
 *  Если единиц больше двух, лишние приписываются к ближайшей (по порядку) оси —
 *  на практике у нас °C/%/бар, двух осей достаточно. */
export function unitAxes(units: string[]): { unit: string; axisIndex: number }[] {
  const unique: string[] = []
  for (const u of units) {
    if (u && !unique.includes(u)) unique.push(u)
  }
  const axes = unique.slice(0, 2)
  return units.map((u) => {
    const idx = axes.indexOf(u)
    return { unit: u, axisIndex: idx === -1 ? 0 : idx }
  })
}

export interface LineSeriesData {
  tagId: string
  name: string
  unit: string
  points: Array<[string, number, string]>
  kind?: 'fact' | 'forecast'
  axisIndex: number
}

/** Данные серии → точки для ECharts: [ms, value] */
export function toXY(points: Array<[string, number, string]>): Array<[number, number]> {
  return points
    .filter((p) => typeof p[1] === 'number')
    .map((p) => [Date.parse(p[0]), p[1] as number] as [number, number])
    .sort((a, b) => a[0] - b[0])
}

/** Прогноз рисуется пунктиром (07 §2): kind=forecast → dashed */
export function isForecastSeries(tag: TagValueT | undefined, tagId: string): boolean {
  return tag?.kind === 'forecast' || tagId.startsWith('EXT')
}

/** Серии из ответа /tags/history: имя по последнему известному значению тега */
export function buildLineSeries(
  series: SeriesT[],
  names: Map<string, string>,
  currentTags: Map<string, TagValueT>,
): LineSeriesData[] {
  const units = series.map((sr) => sr.unit ?? '')
  const axes = unitAxes(units)
  return series.map((sr, i) => ({
    tagId: sr.tag_id ?? '',
    name: names.get(sr.tag_id ?? '') ?? sr.tag_id ?? '',
    unit: sr.unit ?? '',
    points: (sr.points ?? []) as Array<[string, number, string]>,
    kind: isForecastSeries(currentTags.get(sr.tag_id ?? ''), sr.tag_id ?? '') ? 'forecast' : 'fact',
    axisIndex: axes[i]?.axisIndex ?? 0,
  }))
}

/** Пары [ms, value] → отсортированные точки (для Bar) */
export function toXY2(pairs: Array<[number, number]>): Array<[number, number]> {
  return [...pairs].sort((a, b) => a[0] - b[0])
}
