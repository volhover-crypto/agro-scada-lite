import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import { useTagHistory, useTagValues } from '@/api/endpoints/tags'
import { WidgetFrame } from './WidgetFrame'
import { EChartCanvas } from './EChartCanvas'
import { periodRange, toXY2, type Agg } from './chart-helpers'

/*
 * Bar — столбцы/диаграмма (07 §2): агрегат по периоду (сутки/неделя),
 * группировка по постам. Данные — /tags/history с шагом 1д.
 */

export interface BarWidgetProps {
  title?: string
  tags: string[]
  /** период агрегации */
  period?: '24h' | '7d' | '30d'
  /** столбцы: сумма за сутки (по умолчанию) или агрегат из API */
  agg?: Agg | 'sum'
}

const DAY_MS = 86_400_000

/** Дневные суммы/средние по точкам (для осадков — сумма за сутки) */
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

export function BarWidget({ title, tags, period = '7d', agg = 'sum' }: BarWidgetProps) {
  const current = useTagValues(tags, 60_000)
  const range = useMemo(() => periodRange(period), [period])
  const hist = useTagHistory(tags, {
    ...range,
    step: '1d',
    agg: agg === 'sum' ? 'avg' : (agg as Agg),
  })

  return (
    <WidgetFrame title={title} tagIds={tags}>
      {() => <BarBody hist={hist.data ?? []} current={current.data ?? []} />}
    </WidgetFrame>
  )
}

function BarBody({
  hist,
  current,
}: {
  hist: Array<Record<string, unknown>>
  current: Array<Record<string, unknown>>
}) {
  const names = new Map<string, string>()
  for (const t of current as never[]) {
    const tv = t as unknown as { tag_id?: string; name?: string }
    if (tv.tag_id && tv.name) names.set(tv.tag_id, tv.name)
  }

  const option = useMemo<EChartsCoreOption>(
    () => ({
      animationDuration: 250,
      grid: { left: 48, right: 16, top: 36, bottom: 28 },
      legend: { top: 0, type: 'scroll', textStyle: { color: '#3A3A38' } },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'time', axisLabel: { hideOverlap: true } },
      yAxis: { type: 'value' },
      series: (
        hist as never as Array<{ tag_id?: string; points?: Array<[string, number, string]> }>
      ).map((sr) => ({
        name: names.get(sr.tag_id ?? '') ?? sr.tag_id ?? '',
        type: 'bar' as const,
        barMaxWidth: 28,
        data: toXY2(dailyBars(sr.points ?? [])),
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересчёт по данным
    [hist, current],
  )

  return <EChartCanvas option={option} height={240} />
}
