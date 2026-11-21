import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import { useTagHistory, useTagValues } from '@/api/endpoints/tags'
import { WidgetFrame } from './WidgetFrame'
import { EChartCanvas } from './EChartCanvas'
import {
  buildLineSeries,
  pickStepAgg,
  periodRange,
  toXY,
  type Agg,
  type Period,
} from './chart-helpers'
import type { WidgetThreshold } from './types'

/*
 * Chart — временной ряд / наложение (07 §2): до 8 тегов, 2 оси Y по единицам,
 * прогноз пунктиром, пороги линиями, зум колесом/щипком, курсор со значениями.
 */

export interface ChartWidgetProps {
  title?: string
  tags: string[]
  period?: Period
  agg?: Agg
  thresholds?: WidgetThreshold[]
}

const AXIS_COLORS = ['var(--brand-blue)', 'var(--brand-olive-dark)']
const NO_THRESHOLDS: WidgetThreshold[] = []

/** Опция ECharts по сериям и порогам — чистая, покрыта тестами (в т.ч. на init) */
export function buildChartOption(
  series: ReturnType<typeof buildLineSeries>,
  thresholds: WidgetThreshold[],
): EChartsCoreOption {
  const units = [...new Set(series.map((sr) => sr.unit).filter(Boolean))].slice(0, 2)
  return {
    animationDuration: 250,
    grid: { left: 48, right: units.length > 1 ? 48 : 16, top: 36, bottom: 48 },
    legend: { top: 0, type: 'scroll', textStyle: { color: '#3A3A38' } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'time', axisLabel: { hideOverlap: true } },
    yAxis: units.map((u, i) => ({
      type: 'value',
      name: u || undefined,
      position: i === 0 ? ('left' as const) : ('right' as const),
      axisLine: { show: true, lineStyle: { color: AXIS_COLORS[i] } },
    })),
    dataZoom: [
      { type: 'inside', filterMode: 'none' },
      { type: 'slider', height: 16, bottom: 8 },
    ],
    series: series.map((sr) => ({
      name: sr.name,
      type: 'line' as const,
      yAxisIndex: sr.axisIndex,
      showSymbol: false,
      connectNulls: true,
      lineStyle: sr.kind === 'forecast' ? { type: 'dashed' as const } : undefined,
      itemStyle: sr.kind === 'forecast' ? { color: '#2F7FD8' } : undefined,
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
                },
                label: { formatter: String(t.value) },
              })),
            }
          : undefined,
    })),
  }
}

export function ChartWidget({
  title,
  tags,
  period = '24h',
  agg = 'avg',
  thresholds = NO_THRESHOLDS,
}: ChartWidgetProps) {
  // текущие значения: имена тегов + признак прогноза
  const current = useTagValues(tags, 60_000)
  const range = useMemo(() => periodRange(period), [period])
  const { step, agg: effAgg } = pickStepAgg(period, agg)
  const hist = useTagHistory(tags, { ...range, step, agg: effAgg })

  return (
    <WidgetFrame title={title} tagIds={tags}>
      {() => (
        <ChartBody
          tags={tags}
          current={current.data ?? []}
          hist={hist.data ?? []}
          thresholds={thresholds}
        />
      )}
    </WidgetFrame>
  )
}

function ChartBody({
  tags,
  current,
  hist,
  thresholds,
}: {
  tags: string[]
  current: Array<Record<string, unknown>>
  hist: Array<Record<string, unknown>>
  thresholds: WidgetThreshold[]
}) {
  const names = new Map<string, string>()
  const currentTags = new Map<string, never>()
  for (const t of current as never[]) {
    const tv = t as unknown as { tag_id?: string; name?: string }
    if (tv.tag_id && tv.name) names.set(tv.tag_id, tv.name)
    if (tv.tag_id) currentTags.set(tv.tag_id, t as never)
  }

  const option = useMemo<EChartsCoreOption>(
    () => buildChartOption(buildLineSeries(hist as never, names, currentTags as never), thresholds),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересчёт только по данным истории/имен
    [hist, current, thresholds],
  )

  if (tags.length === 0) return null
  return <EChartCanvas option={option} />
}
