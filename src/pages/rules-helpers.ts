import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'

/*
 * Хелперы правил и расписаний (05 §8): статусы, дни недели, человеческие
 * формулировки условия/действия/сводки. Чистые функции — тестируются напрямую.
 */

type RuleT = components['schemas']['Rule']
type ScheduleT = components['schemas']['Schedule']
type CommandDefT = components['schemas']['CommandDef']

/** Условие правила: { tag_id, op, value } */
export interface RuleCondition {
  tag_id: string
  op: string
  value: number
}

/** Операторы условия (05 §8 шаг 1) */
export const RULE_OPS: Array<[string, string]> = [
  ['<', ru.rules.opLt],
  ['>', ru.rules.opGt],
  ['<=', ru.rules.opLte],
  ['>=', ru.rules.opGte],
  ['==', ru.rules.opEq],
]

/** Действие правила: { command_def_id, duration_s } */
export interface RuleAction {
  command_def_id: number
  duration_s?: number | null
}

/** Статус в списке: «Утверждено» / «Ждёт утверждения» / «Выключено» */
export function ruleStatusLabel(
  approvalStatus: string | null | undefined,
  enabled: boolean | null | undefined,
): string {
  if (approvalStatus !== 'approved') return ru.rules.statusPending
  return enabled ? ru.rules.statusApproved : ru.rules.statusDisabled
}

/** «Утверждено» = approved И enabled (для действий в списке) */
export function isApprovedRule(rule: RuleT): boolean {
  return rule.approval_status === 'approved'
}

/** Человекочитаемое условие: «Влажность грунта −10 см ниже 25» */
export function conditionText(
  condition: RuleCondition | null | undefined,
  tagName: string,
): string {
  if (!condition) return '—'
  const op = RULE_OPS.find(([code]) => code === condition.op)?.[1] ?? condition.op
  return ru.rules.conditionText
    .replace('{tag}', tagName || condition.tag_id)
    .replace('{op}', op)
    .replace('{value}', String(condition.value))
}

/** Человекочитаемое действие: «ВКЛЮЧИТЬ · 30 мин» */
export function actionText(action: RuleAction | null | undefined, defs: CommandDefT[]): string {
  if (!action) return '—'
  const def = defs.find((d) => d.id === action.command_def_id)
  const label =
    def?.action === 'on'
      ? ru.device.turnOn
      : def?.action === 'off'
        ? ru.device.turnOff
        : def?.action === 'open'
          ? ru.device.open
          : def?.action === 'close'
            ? ru.device.close
            : `def ${action.command_def_id}`
  const duration =
    action.duration_s != null && action.duration_s > 0
      ? ` · ${durationShort(action.duration_s)}`
      : ''
  return `${label}${duration}`
}

/** «30 мин» / «2 ч» (без дробных часов — расписание задаётся минутами) */
export function durationShort(durationS: number | null | undefined): string {
  if (durationS == null) return '—'
  if (durationS % 3600 === 0) return ru.device.hours.replace('{n}', String(durationS / 3600))
  return ru.device.minutes.replace('{n}', String(Math.round(durationS / 60)))
}

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** Дни расписания: [1..7] → «Пн, Вт, Сб, Вс»; все 7 — «ежедневно» */
export function daysLabel(days: Array<number> | null | undefined): string {
  if (!days || days.length === 0) return '—'
  if (days.length === 7) return ru.rules.everyDay
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d - 1] ?? String(d))
    .join(', ')
}

/** Сводка правила человеческим языком (шаг 4 мастера) */
export function ruleSummary(
  condition: RuleCondition,
  action: RuleAction,
  opts: {
    hysteresis: number
    minPauseS: number
    onNoData: 'skip' | 'fallback_schedule'
    tagName: string
  },
  defs: CommandDefT[],
): string {
  const noData =
    opts.onNoData === 'fallback_schedule' ? ru.rules.noDataFallback : ru.rules.noDataSkip
  return ru.rules.summaryText
    .replace('{condition}', conditionText(condition, opts.tagName))
    .replace('{action}', actionText(action, defs))
    .replace('{hysteresis}', String(opts.hysteresis))
    .replace('{pause}', durationShort(opts.minPauseS))
    .replace('{nodata}', noData)
}

/** Сводка расписания: «06:00 · ежедневно · ВКЛЮЧИТЬ · 30 мин» */
export function scheduleSummary(schedule: ScheduleT, defs: CommandDefT[]): string {
  return `${schedule.time ?? '—'} · ${daysLabel(schedule.days)} · ${actionText(
    { command_def_id: schedule.command_def_id ?? 0, duration_s: schedule.duration_s },
    defs,
  )}`
}

/** Валидность шага мастера (кнопка «Далее») */
export function wizardStepValid(
  step: number,
  condition: RuleCondition | null,
  action: RuleAction | null,
): boolean {
  if (step === 0)
    return (
      condition != null &&
      condition.tag_id !== '' &&
      condition.op !== '' &&
      Number.isFinite(condition.value)
    )
  if (step === 1) return action != null && action.command_def_id > 0
  return true
}
