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
  customRange?: { from: string; to: string }
  agg?: Agg
  thresholds?: WidgetThreshold[]
}

const SERIES_COLORS = ['#2F7FD8', '#6B8E23', '#D97706', '#0D9488', '#7C3AED', '#DC2626']
const AXIS_COLORS = ['#2F7FD8', '#5E6D2C']
const NO_THRESHOLDS: WidgetThreshold[] = []

/** Опция ECharts по сериям и порогам — чистая, покрыта тестами (в т.ч. на init) */
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

export function ChartWidget({
  title,
  tags,
  period = '24h',
  customRange,
  agg = 'avg',
  thresholds = NO_THRESHOLDS,
}: ChartWidgetProps) {
  // текущие значения: имена тегов + признак прогноза
  const current = useTagValues(tags, 60_000)
  const range = useMemo(
    () => customRange ?? periodRange(period),
    [customRange, period],
  )
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
