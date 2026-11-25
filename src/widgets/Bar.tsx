import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import { useTagHistory, useTagValues } from '@/api/endpoints/tags'
import { WidgetFrame } from './WidgetFrame'
import { EChartCanvas } from './EChartCanvas'
import { dailyBars, periodRange, toXY2, type Agg } from './chart-helpers'

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

const BAR_COLORS = ['#2F7FD8', '#6B8E23', '#D97706', '#0D9488']

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
      color: BAR_COLORS,
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
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255, 253, 249, 0.96)',
        borderColor: '#DDD5C7',
        textStyle: { color: '#262624', fontSize: 12 },
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: '#D6CEC0' } },
        axisTick: { show: false },
        axisLabel: { color: '#6E6A63', fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        splitNumber: 4,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#6E6A63', fontSize: 11 },
        splitLine: { lineStyle: { color: '#EAE2D3', type: 'dashed' as const } },
      },
      series: (
        hist as never as Array<{ tag_id?: string; points?: Array<[string, number, string]> }>
      ).map((sr) => ({
        name: names.get(sr.tag_id ?? '') ?? sr.tag_id ?? '',
        type: 'bar' as const,
        barMaxWidth: 28,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        data: toXY2(dailyBars(sr.points ?? [])),
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересчёт по данным
    [hist, current],
  )

  return <EChartCanvas option={option} />
}
