import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import { useTagHistory, useTagValues } from '@/api/endpoints/tags'
import { WidgetFrame } from './WidgetFrame'
import { EChartCanvas } from './EChartCanvas'
import {
  buildChartOption,
  buildLineSeries,
  pickStepAgg,
  periodRange,
  type Agg,
  type Period,
} from './chart-helpers'
import type { WidgetThreshold } from './types'

/*
 * Chart — временной ряд / наложение (07 §2): до 8 тегов, 2 оси Y по единицам,
 * прогноз пунктиром, пороги линиями, зум колесом/щипком, курсор со значениями.
 */

const NO_THRESHOLDS: WidgetThreshold[] = []

export interface ChartWidgetProps {
  title?: string
  tags: string[]
  period?: Period
  customRange?: { from: string; to: string }
  agg?: Agg
  thresholds?: WidgetThreshold[]
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
  const range = useMemo(() => customRange ?? periodRange(period), [customRange, period])
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
