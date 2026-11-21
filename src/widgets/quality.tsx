/* eslint-disable react-refresh/only-export-components -- компонент + чистые хелперы одного виджета: хелперы тестируются напрямую и переиспользуются другими виджетами */
import type { ReactNode } from 'react'
import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'
import { formatTimeRu } from '@/lib/time'
import s from './widgets.module.css'

/*
 * Качество и время значения — единый вид во всех виджетах
 * (07 §1 п.1–2, 06_DESIGN_TOKENS §2, 01 §4.5).
 */

type TagValueT = components['schemas']['TagValue']
type Quality = components['schemas']['Quality']

export function isBadQuality(q: Quality | undefined): boolean {
  return q === 'out_of_range' || q === 'sensor_error'
}

export function isDimQuality(q: Quality | undefined): boolean {
  return q === 'stale' || q === 'offline'
}

/** Минут с момента iso (для «обновлено N мин назад») */
export function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.round((Date.now() - ms) / 60_000))
}

/** Форматирование числа по русской локали (27.4 → «27,4») */
export function formatNumber(value: number, precision = 1): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: precision }).format(value)
}

/** Качество + время: бейджи/подписи по статусу, время — ts_measured,
 *  иначе ts_received с пометкой «время приёма» */
export function QualityMark({ value }: { value: TagValueT }) {
  const q = value.quality ?? 'good'
  const measured = value.ts_measured != null
  const ts = value.ts_measured ?? value.ts_received ?? ''
  const time = ts ? formatTimeRu(ts) : ''
  const parts: ReactNode[] = []

  if (q === 'sim')
    parts.push(
      <span key="sim" className={s.simBadge}>
        {ru.widgets.sim}
      </span>,
    )
  if (q === 'stale') {
    const n = minutesSince(ts) ?? 0
    parts.push(
      <span key="stale" className={s.qStale}>
        {ru.widgets.updatedAgo.replace('{n}', String(n))}
      </span>,
    )
  }
  if (q === 'offline')
    parts.push(
      <span key="off" className={s.qOffline}>
        ✕ {ru.widgets.offline}
      </span>,
    )
  if (q === 'out_of_range')
    parts.push(
      <span key="oor" className={s.qError}>
        {ru.widgets.outOfRange}
      </span>,
    )
  if (q === 'sensor_error')
    parts.push(
      <span key="se" className={s.qError}>
        {ru.widgets.sensorError}
      </span>,
    )
  if (value.kind === 'forecast') {
    parts.push(
      <span key="fc" className={s.qForecast}>
        {ru.widgets.forecastOn.replace('{time}', time)}
      </span>,
    )
  }

  return (
    <span className={s.qualityMark} data-testid="quality-mark">
      {parts}
      {time && q !== 'stale' && (
        <span className={`${s.qTime} tabular`}>
          · {time}
          {!measured && value.kind !== 'forecast' ? ` · ${ru.widgets.receivedNote}` : ''}
        </span>
      )}
    </span>
  )
}

/** Значение с единицами: перечёркнуто при ошибке, серое при stale/offline */
export function ValueText({
  value,
  precision = 1,
  className,
}: {
  value: TagValueT
  precision?: number
  className?: string
}) {
  const q = value.quality
  const num = typeof value.value === 'number' ? value.value : null
  const text = num == null ? '—' : formatNumber(num, precision)
  const cls = [
    s.valueText,
    isBadQuality(q) ? s.valueBad : '',
    isDimQuality(q) ? s.valueDim : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <span className={cls}>
      {text}
      {value.unit ? ` ${value.unit}` : ''}
    </span>
  )
}
