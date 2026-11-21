import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'

/*
 * Хелперы страницы тревог (05 §6): фильтры, подписи состояния/приоритета,
 * шаг эскалации. Чистые функции — тестируются напрямую.
 */

type AlarmT = components['schemas']['Alarm']
type AlarmState = NonNullable<AlarmT['state']>

export type AlarmStateFilter = 'active' | 'unacked' | 'all'

export interface AlarmFilters {
  state: AlarmStateFilter
  objectId: number | null
  priority: number | null
}

export const DEFAULT_FILTERS: AlarmFilters = { state: 'active', objectId: null, priority: null }

/** Активная: не снята и не закрыта */
export function isActiveAlarm(a: AlarmT): boolean {
  return a.state === 'active_unacked' || a.state === 'active_acked'
}

/** Неподтверждённая оператором (ack ещё не ставился) */
export function isUnacked(a: AlarmT): boolean {
  return a.state === 'active_unacked' || a.state === 'cleared_unacked'
}

/** Фильтры 05 §6: состояние × объект × приоритет */
export function filterAlarms(alarms: AlarmT[], f: AlarmFilters): AlarmT[] {
  return alarms.filter((a) => {
    if (f.state === 'active' && !isActiveAlarm(a)) return false
    if (f.state === 'unacked' && !isUnacked(a)) return false
    if (f.objectId != null && a.object_id !== f.objectId) return false
    if (f.priority != null && a.priority !== f.priority) return false
    return true
  })
}

/** Состояние: «Активна», «Подтверждена», «Снята», «Закрыта» */
export function stateLabel(state: AlarmState | null | undefined): string {
  switch (state) {
    case 'active_unacked':
      return ru.alarms.stateActiveUnacked
    case 'active_acked':
      return ru.alarms.stateActiveAcked
    case 'cleared_unacked':
      return ru.alarms.stateClearedUnacked
    case 'closed':
      return ru.alarms.stateClosed
    default:
      return '—'
  }
}

/** Приоритет: «P1 Авария» … «P4 Информация» */
export function priorityLabel(priority: number | null | undefined): string {
  switch (priority) {
    case 1:
      return ru.alarms.p1
    case 2:
      return ru.alarms.p2
    case 3:
      return ru.alarms.p3
    case 4:
      return ru.alarms.p4
    default:
      return '—'
  }
}

/** Шаг эскалации: 0 — «—», N — «Шаг N» (pressure_drop: шаги на 40/60 с) */
export function escalationLabel(step: number | null | undefined): string {
  if (step == null || step <= 0) return '—'
  return ru.alarms.escalationStep.replace('{n}', String(step))
}

/** Куда ведёт «К устройству»: пост, если привязан, иначе объект (05 §6) */
export function alarmTarget(a: AlarmT): { to: string; label: string } | null {
  if (a.object_id == null) return null
  if (a.post_id != null) {
    return { to: `/o/${a.object_id}/p/${a.post_id}`, label: ru.alarms.toDevice }
  }
  return { to: `/o/${a.object_id}`, label: ru.alarms.toObject }
}
