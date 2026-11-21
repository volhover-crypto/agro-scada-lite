import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'

/*
 * Хелперы страницы устройства (05 §5): подписи действий и статусов,
 * пресеты длительности, «до HH:MM (осталось N мин)». Чистые функции.
 */

type CommandT = components['schemas']['Command']
type CommandStatus = NonNullable<CommandT['status']>
type CommandDefT = components['schemas']['CommandDef']
type ActionT = NonNullable<CommandDefT['action']>

/** Пресеты длительности в минутах (05 §5: 10/15/30/60 мин, 2/4 ч + ввод) */
export const DURATION_PRESETS_MIN = [10, 15, 30, 60, 120, 240]

/** Работает ли выход (факт on/open) — ВКЛЮЧИТЬ превращается в ПРОДЛИТЬ */
export function isRunning(factState: string | null | undefined): boolean {
  return factState === 'on' || factState === 'open'
}

/** Подпись кнопки действия: ВКЛЮЧИТЬ/ПРОДЛИТЬ/ВЫКЛЮЧИТЬ/ОТКРЫТЬ/ЗАКРЫТЬ */
export function actionLabel(action: ActionT, factState: string | null | undefined): string {
  if (action === 'on') return isRunning(factState) ? ru.device.extend : ru.device.turnOn
  if (action === 'off') return ru.device.turnOff
  if (action === 'open') return ru.device.open
  return ru.device.close
}

/** Требуется ли диалог подтверждения: on/open с политикой не 'none' (off/close — всегда нет) */
export function needsConfirm(def: CommandDefT): boolean {
  return (def.action === 'on' || def.action === 'open') && (def.confirm_policy ?? 'none') !== 'none'
}

/** Длительность обязательна: канон §3.1 п.3 — только action='on' */
export function needsDuration(action: ActionT): boolean {
  return action === 'on'
}

/** «до 10:45 (осталось 23 мин)»; меньше минуты — «осталось меньше минуты»; null — '' */
export function remainingText(factUntilIso: string | null | undefined, nowMs: number): string {
  if (!factUntilIso) return ''
  const until = Date.parse(factUntilIso)
  if (Number.isNaN(until)) return ''
  const left = until - nowMs
  const hhmm = new Date(until).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
  if (left <= 0) return ru.device.untilPassed.replace('{time}', hhmm)
  if (left < 60_000) return ru.device.untilLessAMinute.replace('{time}', hhmm)
  const mins = Math.round(left / 60_000)
  return ru.device.until.replace('{time}', hhmm).replace('{mins}', String(mins))
}

/** Факт состояния: ● Выключено / Включено / Открыто / Закрыто / Ожидание / Авария */
export function factStateLabel(factState: string | null | undefined): string {
  switch (factState) {
    case 'on':
      return ru.device.factOn
    case 'open':
      return ru.device.factOpen
    case 'off':
      return ru.device.factOff
    case 'closed':
      return ru.device.factClosed
    case 'pending':
      return ru.device.factPending
    case 'fault':
      return ru.device.factFault
    default:
      return ru.widgets.lampUnknown
  }
}

/** Шаг цепочки для статуса (StatusTrail); null — статус не рисуется как шаг */
export function statusStepLabel(status: CommandStatus): string | null {
  switch (status) {
    case 'created':
      return ru.device.stepCreated
    case 'awaiting_confirm':
      return ru.device.stepAwaiting
    case 'queued':
      return ru.device.stepQueued
    case 'sent_gw':
      return ru.device.stepSent
    case 'acked':
      return ru.device.stepAcked
    case 'completed':
      return ru.device.stepCompleted
    default:
      return null
  }
}

/** Терминальный исход: текст для timeout/rejected/cancelled/superseded */
export function finalOutcome(
  status: CommandStatus,
  resultCode: number | null | undefined,
): { text: string; kind: 'fail' | 'neutral' } | null {
  if (status === 'timeout') return { text: ru.device.outcomeTimeout, kind: 'fail' }
  if (status === 'rejected')
    return {
      text: ru.device.outcomeRejected.replace('{code}', String(resultCode ?? '—')),
      kind: 'fail',
    }
  if (status === 'cancelled') return { text: ru.device.outcomeCancelled, kind: 'neutral' }
  if (status === 'superseded') return { text: ru.device.outcomeSuperseded, kind: 'neutral' }
  return null
}

/** «Выполнено» — только acked/completed (критическое правило 05 §5) */
export function isDone(status: CommandStatus | null | undefined): boolean {
  return status === 'acked' || status === 'completed'
}

/** Команда ещё жива (для блокировки кнопок и частого опроса) */
export function isActiveStatus(status: CommandStatus | null | undefined): boolean {
  return (
    status === 'created' ||
    status === 'awaiting_confirm' ||
    status === 'queued' ||
    status === 'sent_gw'
  )
}

/** Действие команды по её def id (для истории) */
export function actionOfDef(
  defs: CommandDefT[],
  commandDefId: number | null | undefined,
): ActionT | null {
  return defs.find((d) => d.id === commandDefId)?.action ?? null
}

/** Метка длительности: «30 мин», «2 ч», «—» */
export function durationLabel(durationS: number | null | undefined): string {
  if (durationS == null) return '—'
  if (durationS % 3600 === 0) return ru.device.hours.replace('{n}', String(durationS / 3600))
  if (durationS % 60 === 0) return ru.device.minutes.replace('{n}', String(durationS / 60))
  return ru.device.seconds.replace('{n}', String(durationS))
}

/** Подсказка о максимуме: «максимум 4 ч» */
export function maxDurationHint(maxDurationS: number | null | undefined): string | null {
  if (maxDurationS == null) return null
  return ru.device.maxHint.replace('{n}', String(Math.round(maxDurationS / 3600)))
}

/** Длительность превышает максимум устройства (кнопка неактивна) */
export function durationOverMax(
  seconds: number | null,
  maxDurationS: number | null | undefined,
): boolean {
  return seconds != null && maxDurationS != null && seconds > maxDurationS
}

/** Вид цепочки статусов: шаги + исход (для StatusTrail) */
export function trailView(command: CommandT): {
  steps: Array<{ label: string; done: boolean }>
  outcome: { text: string; kind: 'fail' | 'neutral' } | null
  isTimeout: boolean
  offlineWarning: boolean
} {
  const status = command.status ?? 'created'
  const steps: Array<{ label: string; done: boolean }> = []
  const hist = command.status_history ?? []
  for (const h of hist) {
    const label = statusStepLabel(h.status ?? 'created')
    if (label) steps.push({ label, done: isDone(h.status) })
  }
  return {
    steps,
    outcome: finalOutcome(status, command.result_code),
    isTimeout: status === 'timeout',
    offlineWarning:
      (command.warnings ?? []).includes('MODEM_OFFLINE') && command.expires_at != null,
  }
}

/** Строка истории: действие, длительность, статус с видом (для раскраски) */
export function historyRow(
  command: CommandT,
  defs: CommandDefT[],
): {
  action: string
  duration: string
  label: string
  kind: 'done' | 'fail' | 'active' | 'neutral'
} {
  const action = actionOfDef(defs, command.command_def_id)
  const status = command.status ?? 'created'
  const outcome = finalOutcome(status, command.result_code)
  const label = statusStepLabel(status) ?? outcome?.text ?? status
  const kind: 'done' | 'fail' | 'active' | 'neutral' = isDone(status)
    ? 'done'
    : outcome?.kind === 'fail'
      ? 'fail'
      : isActiveStatus(status)
        ? 'active'
        : 'neutral'
  return {
    action: action ? actionLabel(action, null) : '—',
    duration: durationLabel(command.duration_s),
    label,
    kind,
  }
}
