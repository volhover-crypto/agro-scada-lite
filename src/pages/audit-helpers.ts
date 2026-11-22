import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'

/*
 * Хелперы журнала (05 §9): человекочитаемые события и сущности,
 * «было/стало», границы периода для date-инпутов. Чистые функции.
 */

type AuditEntryT = components['schemas']['AuditEntry']

/** Коды сущностей аудита → подписи фильтра */
export const AUDIT_ENTITIES: Array<[string, string]> = [
  ['command', ru.audit.entityCommand],
  ['actuator', ru.audit.entityActuator],
  ['alarm', ru.audit.entityAlarm],
  ['rule', ru.audit.entityRule],
  ['schedule', ru.audit.entitySchedule],
  ['modem', ru.audit.entityModem],
  ['tag', ru.audit.entityTag],
]

/** Событие человекочитаемо: известный код → текст, неизвестный — сам код */
export function eventText(event: string | null | undefined): string {
  const map: Record<string, string> = {
    'command.status_changed': ru.audit.evStatusChanged,
    'command.confirmed': ru.audit.evConfirmed,
    'command.cancelled': ru.audit.evCancelled,
    'alarm.acked': ru.audit.evAlarmAcked,
    'actuator.mode_changed': ru.audit.evModeChanged,
    'rule.created': ru.audit.evRuleCreated,
    'rule.updated': ru.audit.evRuleUpdated,
    'rule.approved': ru.audit.evRuleApproved,
    'schedule.created': ru.audit.evScheduleCreated,
    'schedule.approved': ru.audit.evScheduleApproved,
    'schedule.skipped': ru.audit.evScheduleSkipped,
    'rule.skipped': ru.audit.evRuleSkipped,
  }
  const key = event ?? ''
  return map[key] ?? key
}

/** «объект» записи: «Команда 40211» */
export function entityText(
  entity: string | null | undefined,
  entityId: string | null | undefined,
): string {
  if (!entity) return '—'
  const label = AUDIT_ENTITIES.find(([code]) => code === entity)?.[1] ?? entity
  return entityId ? `${label} ${entityId}` : label
}

/** Однострочное представление before/after для раскрытия «было/стало» */
export function diffText(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'object') {
    const parts = Object.entries(value as Record<string, unknown>).map(([k, v]) => {
      const val = typeof v === 'object' && v != null ? JSON.stringify(v) : String(v)
      return `${k}: ${val}`
    })
    return parts.length > 0 ? parts.join('; ') : '{}'
  }
  return String(value)
}

/** was/now-пара строки раскрытия; null → нечего показывать */
export function wasNowText(entry: AuditEntryT): { was: string; now: string } | null {
  if (entry.before == null && entry.after == null) return null
  return { was: diffText(entry.before), now: diffText(entry.after) }
}

/** Границы периода из date-инпутов: from — начало дня, to — конец дня */
export function periodBounds(
  fromDate: string | null,
  toDate: string | null,
): { from: string | null; to: string | null } {
  return {
    from: fromDate ? `${fromDate}T00:00:00` : null,
    to: toDate ? `${toDate}T23:59:59` : null,
  }
}

/** Есть ли следующая страница: сервер вернул ровно limit записей */
export function hasNextPage(received: number, limit: number): boolean {
  return received >= limit
}
