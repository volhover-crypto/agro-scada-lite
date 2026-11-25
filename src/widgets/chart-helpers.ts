/*
 * Чистые хелперы графиков (T08) — без React/ECharts, покрыты юнит-тестами.
 * Правила: 02_ARCHITECTURE_FE §7 (>5000 точек → агрегат), 07_WIDGETS_SPEC §2
 * (до 8 тегов, 2 оси Y по единицам, прогноз пунктиром).
 */

import type { EChartsCoreOption } from 'echarts/core'
import type { components } from '@/api/types.gen'
import type { WidgetThreshold } from './types'

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

/*
 * Ниже — хелперы, перенесённые из Chart.tsx / Bar.tsx / ChartsPage.tsx (этап 8, §8.7):
 * файл компонента должен экспортировать только компоненты (react-refresh).
 */

const DAY_MS = 86_400_000

/** Дневные суммы/средние по точкам (для осадков — сумма за сутки) — из Bar.tsx */
export function dailyBars(
  points: Array<[string, number, string]>,
  mode: 'sum' | 'avg' = 'sum',
): Array<[number, number]> {
  const byDay = new Map<number, number[]>()
  for (const [ts, v] of points) {
    if (typeof v !== 'number') continue
    const day = Math.floor(Date.parse(ts) / DAY_MS) * DAY_MS
    const arr = byDay.get(day) ?? []
    arr.push(v)
    byDay.set(day, arr)
  }
  return [...byDay.entries()]
    .map(
      ([day, vals]) =>
        [
          day,
          mode === 'sum'
            ? vals.reduce((a, b) => a + b, 0)
            : vals.reduce((a, b) => a + b, 0) / vals.length,
        ] as [number, number],
    )
    .sort((a, b) => a[0] - b[0])
}

export interface TreeGroup {
  postKey: string
  postLabel: string
  params: Array<{ tagId: string; label: string }>
}

/** Дерево Объект → Пост → Параметр: канал даёт имя параметра, /tags/current — пост — из ChartsPage */
export function buildTree(
  channels: components['schemas']['Channel'][],
  current: TagValueT[],
  objects: components['schemas']['Object'][],
): TreeGroup[] {
  const byPost = new Map<string, { postLabel: string; params: Map<string, string> }>()
  const objName = (objects ?? []).find((o) => o.id === 1)?.name ?? ''

  for (const ch of channels) {
    const tagId = ch.tag_id ?? ''
    if (!tagId) continue
    const tv = current.find((v) => v.tag_id === tagId)
    const postId = tv?.post_id
    if (postId == null) continue
    const key = String(postId)
    const label = `Пост ${postId} · ${objName}`
    if (!byPost.has(key)) byPost.set(key, { postLabel: label, params: new Map() })
    byPost
      .get(key)!
      .params.set(tagId, tv?.name ?? `${ch.param_name} ${ch.level_cm} см №${ch.sensor_no}`)
  }
  return [...byPost.entries()]
    .sort((a, b) => a[1].postLabel.localeCompare(b[1].postLabel, 'ru'))
    .map(([postKey, g]) => ({
      postKey,
      postLabel: g.postLabel,
      params: [...g.params.entries()].map(([tagId, label]) => ({ tagId, label })),
    }))
}

export function filterTree(tree: TreeGroup[], search: string): TreeGroup[] {
  const q = search.trim().toLowerCase()
  if (!q) return tree
  return tree
    .map((g) => ({
      ...g,
      params: g.params.filter(
        (p) => p.label.toLowerCase().includes(q) || g.postLabel.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.params.length > 0)
}

const SERIES_COLORS = ['#2F7FD8', '#6B8E23', '#D97706', '#0D9488', '#7C3AED', '#DC2626']
const AXIS_COLORS = ['#2F7FD8', '#5E6D2C']

/** Опция ECharts по сериям и порогам — чистая, покрыта тестами (в т.ч. на init) — из Chart.tsx */
export function buildChartOption(
  series: ReturnType<typeof buildLineSeries>,
  thresholds: WidgetThreshold[],
): EChartsCoreOption {
  const units = [...new Set(series.map((sr) => sr.unit).filter(Boolean))].slice(0, 2)
  return {
    animationDuration: 250,
    color: SERIES_COLORS,
    grid: { left: 12, right: 12, top: 38, bottom: 8, containLabel: true },
    legend: {
      top: 0,
      type: 'scroll',
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: '#3A3A38', fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 253, 249, 0.96)',
      borderColor: '#DDD5C7',
      textStyle: { color: '#262624', fontSize: 12 },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#D6CEC0' } },
      axisTick: { show: false },
      axisLabel: { color: '#6E6A63', fontSize: 11, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: units.map((u, i) => ({
      type: 'value',
      name: u || undefined,
      nameTextStyle: { color: AXIS_COLORS[i], fontSize: 11, padding: [0, 0, 4, 0] },
      position: i === 0 ? ('left' as const) : ('right' as const),
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#6E6A63', fontSize: 11 },
      splitLine: {
        show: i === 0,
        lineStyle: { color: '#EAE2D3', type: 'dashed' as const },
      },
    })),
    dataZoom: [{ type: 'inside', filterMode: 'none' }],
    series: series.map((sr, idx) => {
      const color = sr.kind === 'forecast' ? '#2F7FD8' : SERIES_COLORS[idx % SERIES_COLORS.length]
      return {
        name: sr.name,
        type: 'line' as const,
        yAxisIndex: sr.axisIndex,
        smooth: 0.25,
        showSymbol: false,
        symbolSize: 6,
        connectNulls: true,
        lineStyle: {
          width: 2.5,
          type: sr.kind === 'forecast' ? ('dashed' as const) : ('solid' as const),
        },
        itemStyle: { color },
        areaStyle: sr.kind === 'forecast' ? undefined : { opacity: 0.1 },
        data: toXY(sr.points),
        markLine:
          thresholds.length > 0 && series[0] === sr
            ? {
                silent: true,
                symbol: 'none',
                data: thresholds.map((t) => ({
                  yAxis: t.value,
                  lineStyle: {
                    color: t.color === 'alarm' ? '#C62828' : '#C9A100',
                    type: 'dashed' as const,
                    width: 1.5,
                  },
                  label: { formatter: String(t.value), color: '#5A5650', fontSize: 11 },
                })),
              }
            : undefined,
      }
    }),
  }
}
