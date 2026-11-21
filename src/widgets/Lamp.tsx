/* eslint-disable react-refresh/only-export-components -- компонент + чистые хелперы одного виджета: хелперы тестируются напрямую и переиспользуются другими виджетами */
import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'
import { WidgetFrame } from './WidgetFrame'
import s from './widgets.module.css'

/*
 * Lamp — сигнальная лампа (07 §2): дискрет 0/1 или порог; цвет + текст,
 * «неизвестно» — жёлтый контур. Статус никогда не передаётся только цветом (06 §7).
 */

type TagValueT = components['schemas']['TagValue']

export interface LampOptions {
  mode?: 'discrete' | 'threshold'
  /** Для threshold: включено, если value >= threshold */
  threshold?: number
  /** Для discrete: значение «включено» (по умолчанию 1) */
  onValue?: number
  labels?: { on?: string; off?: string }
}

export type LampState = 'on' | 'off' | 'unknown'

/** Чистая функция состояния — покрывается юнит-тестами */
export function lampState(value: TagValueT, o: LampOptions): LampState {
  const q = value.quality
  if (value.value == null || q === 'sensor_error' || q === 'offline') return 'unknown'
  if (o.mode === 'threshold' && typeof o.threshold === 'number') {
    return value.value >= o.threshold ? 'on' : 'off'
  }
  return value.value === (o.onValue ?? 1) ? 'on' : 'off'
}

export interface LampWidgetProps {
  title?: string
  tags: string[]
  options?: LampOptions
}

export function LampWidget({ title, tags, options = {} }: LampWidgetProps) {
  return (
    <WidgetFrame title={title} tagIds={tags}>
      {(values) => {
        const state = lampState(values[0]!, options)
        const label =
          state === 'on'
            ? (options.labels?.on ?? ru.widgets.lampOn)
            : state === 'off'
              ? (options.labels?.off ?? ru.widgets.lampOff)
              : ru.widgets.lampUnknown
        return (
          <div className={s.lampRow}>
            <span
              className={`${s.lampDot} ${state === 'on' ? s.lampOn : state === 'off' ? s.lampOff : s.lampUnknown}`}
              aria-hidden
            />
            <span className={s.lampLabel}>{label}</span>
          </div>
        )
      }}
    </WidgetFrame>
  )
}
