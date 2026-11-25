import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'

/*
 * Хелперы настроек (T16, 05 §10): типы объектов, подписи каналов привязки
 * (в т.ч. unknown_code), политики подтверждения. Чистые функции.
 */

type ChannelT = components['schemas']['Channel']

/** Типы объектов (05 §10, канонический список из 7 кодов — T20) */
export const OBJECT_TYPES: Array<[string, string]> = [
  ['vineyard', ru.settings.typeVineyard],
  ['orchard', ru.settings.typeOrchard],
  ['greenhouse', ru.settings.typeGreenhouse],
  ['pump_station', ru.settings.typePumpStation],
  ['field', ru.settings.typeField],
  ['meteo', ru.settings.typeMeteo],
  ['other', ru.settings.typeOther],
]

export function objectTypeLabel(type: string | null | undefined): string {
  return OBJECT_TYPES.find(([code]) => code === type)?.[1] ?? type ?? '—'
}

/** Политики подтверждения: код → подпись + пояснение (05 §10) */
export const CONFIRM_POLICIES: Array<[string, string, string]> = [
  ['none', ru.settings.policyNone, ru.settings.policyNoneHint],
  ['manual_only', ru.settings.policyManualOnly, ru.settings.policyManualOnlyHint],
  [
    'manual_and_rule_approval',
    ru.settings.policyManualAndRule,
    ru.settings.policyManualAndRuleHint,
  ],
  ['always', ru.settings.policyAlways, ru.settings.policyAlwaysHint],
]

export function policyLabel(policy: string | null | undefined): string {
  return CONFIRM_POLICIES.find(([code]) => code === policy)?.[1] ?? policy ?? '—'
}

export function policyHint(policy: string | null | undefined): string {
  return CONFIRM_POLICIES.find(([code]) => code === policy)?.[2] ?? ''
}

/** Канал привязки: подпись и доступность (unknown_code — «Нет в справочнике») */
export function channelBindingInfo(ch: ChannelT): {
  label: string
  bindable: boolean
  unknown: boolean
} {
  if (ch.status === 'unknown_code') {
    return { label: ru.settings.unknownCode, bindable: false, unknown: true }
  }
  const level =
    ch.level_cm != null && ch.level_cm !== 0
      ? ` ${ch.level_cm < 0 ? '−' : '+'}${Math.abs(ch.level_cm)} см`
      : ''
  const no = ch.sensor_no ? ` №${ch.sensor_no}` : ''
  return {
    label: `${ch.param_name || ru.settings.paramUnknown}${level}${no}`,
    bindable: ch.status === 'unassigned',
    unknown: false,
  }
}

/** Живое значение канала из /channels (last_value/last_ts) */
export function channelLiveValue(ch: ChannelT): string {
  if (ch.last_value == null) return ru.widgets.noData.toLowerCase()
  const ts = ch.last_ts
    ? ` · ${new Date(ch.last_ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    : ''
  return `${ch.last_value} ${ch.unit ?? ''}${ts}`
}
