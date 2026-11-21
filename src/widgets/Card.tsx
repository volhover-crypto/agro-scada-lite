/* eslint-disable react-refresh/only-export-components -- компонент + чистые хелперы одного виджета: хелперы тестируются напрямую и переиспользуются другими виджетами */
import { useRef } from 'react'
import type { components } from '@/api/types.gen'
import { useTagHistory } from '@/api/endpoints/tags'
import { toMskIso } from '@/lib/time'
import { ru } from '@/i18n/ru'
import { ValueText } from './quality'
import { WidgetFrame } from './WidgetFrame'
import s from './widgets.module.css'

/*
 * Card — последнее значение (07 §2): крупное число, единицы, стрелка тренда ↑↓
 * и мини-тренд 24 ч (лёгкий SVG-спарклайн; ECharts подключается в T08).
 */

type TagValueT = components['schemas']['TagValue']
type SeriesT = components['schemas']['Series']

/** Направление тренда по точкам истории (с порогом 2 %) */
export function trendDir(points: Array<[string, number, string]>): 'up' | 'down' | 'flat' {
  if (points.length < 2) return 'flat'
  const first = points[0]![1]
  const last = points[points.length - 1]![1]
  if (first == null || last == null) return 'flat'
  const eps = Math.abs(first) * 0.02 + 1e-9
  if (last - first > eps) return 'up'
  if (first - last > eps) return 'down'
  return 'flat'
}

/** Направление + подпись для aria (i18n) */
export function trendLabel(points: Array<[string, number, string]>): {
  dir: 'up' | 'down' | 'flat'
  aria: string
} {
  const dir = trendDir(points)
  const aria =
    dir === 'up' ? ru.widgets.trendUp : dir === 'down' ? ru.widgets.trendDown : ru.widgets.trendFlat
  return { dir, aria }
}

/** Мини-спарклайн без библиотек: нормализация в viewBox 100×28 */
export function Sparkline({ points }: { points: Array<[string, number, string]> }) {
  const values = points.map((p) => p[1]).filter((v): v is number => typeof v === 'number')
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = 100 / (values.length - 1)
  const d = values
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(28 - ((v - min) / span) * 26 - 1).toFixed(1)}`,
    )
    .join(' ')
  return (
    <svg className={s.sparkline} viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="var(--brand-blue)" strokeWidth="1.5" />
    </svg>
  )
}

export interface CardWidgetProps {
  title?: string
  tags: string[]
  /** Знаков после запятой (options.precision из 07 §2) */
  precision?: number
}

export function CardWidget({ title, tags, precision = 1 }: CardWidgetProps) {
  return (
    <WidgetFrame title={title} tagIds={tags}>
      {(values) => <CardBody value={values[0]!} precision={precision} />}
    </WidgetFrame>
  )
}

function CardBody({ value, precision }: { value: TagValueT; precision: number }) {
  // окно тренда фиксируем на монтировании: from/to при каждом рендере дали бы
  // нестабильный queryKey и бесконечный цикл опросов
  const rangeRef = useRef<{ from: string; to: string } | null>(null)
  if (!rangeRef.current) {
    rangeRef.current = { from: toMskIso(Date.now() - 24 * 3_600_000), to: toMskIso() }
  }
  const hist = useTagHistory([value.tag_id ?? ''], { ...rangeRef.current, agg: 'avg', step: '1h' })
  const series = (hist.data ?? []) as SeriesT[]
  const points = (series[0]?.points ?? []) as Array<[string, number, string]>
  const { dir, aria } = trendLabel(points)

  return (
    <div className={s.cardBody}>
      <div className={s.cardValueRow}>
        <ValueText value={value} precision={precision} className={s.cardValue} />
        <span className={s.trend} role="img" aria-label={aria}>
          {dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'}
        </span>
      </div>
      <Sparkline points={points} />
    </div>
  )
}
