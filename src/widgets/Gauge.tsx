/* eslint-disable react-refresh/only-export-components -- компонент + чистые хелперы одного виджета: хелперы тестируются напрямую и переиспользуются другими виджетами */
import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'
import { ValueText } from './quality'
import { WidgetFrame } from './WidgetFrame'
import type { WidgetThreshold } from './types'
import s from './widgets.module.css'

/*
 * Gauge — стрелочный индикатор (07 §2): min/max, зоны цвета по thresholds,
 * плавный ход стрелки 300 мс; вне диапазона — стрелка у упора (статус ошибки
 * показывает QualityMark в рамке).
 */

type TagValueT = components['schemas']['TagValue']

const CX = 60
const CY = 60
const R_ZONE = 48
const NEEDLE_LEN = 38

/** Угол стрелки −90…+90; null или вне диапазона — у упора */
export function gaugeAngle(value: number | null, min: number, max: number): number {
  if (value == null) return -90
  const span = max - min
  const pct = span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 0
  return -90 + pct * 180
}

function polar(deg: number, r: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) }
}

function arcPath(fromDeg: number, toDeg: number, r: number): string {
  const a = polar(fromDeg, r)
  const b = polar(toDeg, r)
  const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

/** Цвет зоны для значения: thresholds = «ниже value → color», иначе ok */
export function colorAt(v: number, thresholds: WidgetThreshold[]): 'ok' | 'warn' | 'alarm' {
  const sorted = [...thresholds].sort((a, b) => b.value - a.value)
  for (const t of sorted) {
    if (v < t.value) return t.color
  }
  return 'ok'
}

const ZONE_VAR: Record<'ok' | 'warn' | 'alarm', string> = {
  ok: 'var(--actuator-on)',
  warn: 'var(--alarm-p3)',
  alarm: 'var(--alarm-p1)',
}

/** Дуги зон: [от, до, цвет-переменная] */
export function zoneArcs(
  min: number,
  max: number,
  thresholds: WidgetThreshold[],
): Array<[number, number, string]> {
  const bounds = [
    min,
    ...[...thresholds].sort((a, b) => a.value - b.value).map((t) => t.value),
    max,
  ]
  const arcs: Array<[number, number, string]> = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const a0 = bounds[i]!
    const a1 = bounds[i + 1]!
    const mid = (a0 + a1) / 2
    arcs.push([a0, a1, ZONE_VAR[colorAt(mid, thresholds)]])
  }
  return arcs
}

export interface GaugeWidgetProps {
  title?: string
  tags: string[]
  thresholds?: WidgetThreshold[]
  options?: { min?: number; max?: number }
}

export function GaugeWidget({ title, tags, thresholds = [], options = {} }: GaugeWidgetProps) {
  return (
    <WidgetFrame title={title} tagIds={tags}>
      {(values) => (
        <GaugeBody
          value={values[0]!}
          title={title}
          min={options.min ?? 0}
          max={options.max ?? 100}
          thresholds={thresholds}
        />
      )}
    </WidgetFrame>
  )
}

function GaugeBody({
  value,
  title,
  min,
  max,
  thresholds,
}: {
  value: TagValueT
  title?: string
  min: number
  max: number
  thresholds: WidgetThreshold[]
}) {
  const v = typeof value.value === 'number' ? value.value : null
  const angle = gaugeAngle(v, min, max)
  const label = `${title ?? ''}: ${v ?? '—'} ${value.unit ?? ''}`.trim()

  return (
    <div className={s.gaugeWrap}>
      <svg
        viewBox="0 0 120 70"
        className={s.gaugeSvg}
        role="img"
        aria-label={ru.widgets.gaugeAria
          .replace('{title}', title ?? '')
          .replace('{value}', String(v ?? '—'))
          .replace('{unit}', value.unit ?? '')}
      >
        {/* фон шкалы */}
        <path
          d={arcPath(-90, 90, R_ZONE)}
          fill="none"
          stroke="var(--bg-sunken)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* зоны (перевод значений min..max в градусы −90..+90) */}
        {zoneArcs(min, max, thresholds).map(([a0, a1, color], i) => (
          <path
            key={i}
            d={arcPath(gaugeAngle(a0, min, max), gaugeAngle(a1, min, max), R_ZONE)}
            fill="none"
            stroke={color}
            strokeWidth="10"
          />
        ))}
        {/* стрелка */}
        <g
          className={s.gaugeNeedle}
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px` }}
        >
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - NEEDLE_LEN}
            stroke="var(--text-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
        <circle cx={CX} cy={CY} r="4.5" fill="var(--text-primary)" />
      </svg>
      <ValueText value={value} precision={1} className={s.gaugeValue} />
      <span className="visually-hidden">{label}</span>
    </div>
  )
}
