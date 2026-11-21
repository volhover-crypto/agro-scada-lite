import { describe, expect, it } from 'vitest'
import type { components } from '@/api/types.gen'
import {
  actionText,
  conditionText,
  daysLabel,
  durationShort,
  isApprovedRule,
  ruleStatusLabel,
  ruleSummary,
  RULE_OPS,
  scheduleSummary,
  wizardStepValid,
  type RuleAction,
  type RuleCondition,
} from './rules-helpers'

type RuleT = components['schemas']['Rule']
type ScheduleT = components['schemas']['Schedule']
type CommandDefT = components['schemas']['CommandDef']

const defs: CommandDefT[] = [
  { id: 3, actuator_id: 2, action: 'on', confirm_policy: 'manual_only' },
  { id: 4, actuator_id: 2, action: 'off', confirm_policy: 'none' },
] as CommandDefT[]

const cond: RuleCondition = { tag_id: '70B3D58FF0031A01/3/-10/1', op: '<', value: 25 }
const act: RuleAction = { command_def_id: 3, duration_s: 1800 }

describe('ruleStatusLabel — Утверждено / Ждёт / Выключено', () => {
  it('approved+enabled → Утверждено; approved+off → Выключено; pending → Ждёт', () => {
    expect(ruleStatusLabel('approved', true)).toBe('Утверждено')
    expect(ruleStatusLabel('approved', false)).toBe('Выключено')
    expect(ruleStatusLabel('pending', true)).toBe('Ждёт утверждения')
    expect(ruleStatusLabel(undefined, true)).toBe('Ждёт утверждения')
  })

  it('isApprovedRule — только approval approved', () => {
    expect(isApprovedRule({ approval_status: 'approved' } as RuleT)).toBe(true)
    expect(isApprovedRule({ approval_status: 'pending' } as RuleT)).toBe(false)
  })
})

describe('conditionText / actionText — человеческий язык', () => {
  it('условие: тег, оператор-слово, значение', () => {
    expect(conditionText(cond, 'Влажность грунта −10 см')).toBe(
      'Влажность грунта −10 см ниже (<) 25'.replace(' ниже (<)', ' ниже (<)'),
    )
    expect(conditionText(cond, 'Влажность грунта −10 см')).toContain('ниже (<) 25')
  })

  it('действие: подпись команды + длительность', () => {
    expect(actionText(act, defs)).toBe('ВКЛЮЧИТЬ · 30 мин')
    expect(actionText({ command_def_id: 4, duration_s: null }, defs)).toBe('ВЫКЛЮЧИТЬ')
    expect(actionText(null, defs)).toBe('—')
  })

  it('операторы: 5 вариантов', () => {
    expect(RULE_OPS).toHaveLength(5)
  })
})

describe('durationShort / daysLabel', () => {
  it('минуты, часы, прочерк', () => {
    expect(durationShort(1800)).toBe('30 мин')
    expect(durationShort(7200)).toBe('2 ч')
    expect(durationShort(null)).toBe('—')
  })

  it('дни: все 7 — ежедневно; подмножество — имена по порядку', () => {
    expect(daysLabel([1, 2, 3, 4, 5, 6, 7])).toBe('ежедневно')
    expect(daysLabel([6, 7, 1])).toBe('Пн, Сб, Вс')
    expect(daysLabel([])).toBe('—')
  })
})

describe('ruleSummary — сводка шага 4', () => {
  it('полный текст со всеми частями', () => {
    const text = ruleSummary(
      cond,
      act,
      { hysteresis: 5, minPauseS: 3600, onNoData: 'skip', tagName: 'Влажность грунта −10 см' },
      defs,
    )
    expect(text).toContain('Влажность грунта −10 см ниже (<) 25')
    expect(text).toContain('ВКЛЮЧИТЬ · 30 мин')
    expect(text).toContain('Гистерезис: 5')
    expect(text).toContain('пауза: 1 ч')
    expect(text).toContain('пропустить')
  })

  it('fallback_schedule — «по запасному расписанию»', () => {
    const text = ruleSummary(
      cond,
      act,
      { hysteresis: 1, minPauseS: 60, onNoData: 'fallback_schedule', tagName: 'Т' },
      defs,
    )
    expect(text).toContain('по запасному расписанию')
  })
})

describe('scheduleSummary / wizardStepValid', () => {
  it('сводка расписания', () => {
    const sch = {
      id: 1,
      command_def_id: 3,
      time: '06:00',
      days: [1, 2, 3, 4, 5, 6, 7],
      duration_s: 1800,
      enabled: true,
      approval_status: 'approved',
    } as ScheduleT
    expect(scheduleSummary(sch, defs)).toBe('06:00 · ежедневно · ВКЛЮЧИТЬ · 30 мин')
  })

  it('валидность шагов: 0 — условие заполнено; 1 — команда выбрана; 2/3 — всегда', () => {
    expect(wizardStepValid(0, cond, act)).toBe(true)
    expect(wizardStepValid(0, { tag_id: '', op: '<', value: 1 }, act)).toBe(false)
    expect(wizardStepValid(1, cond, act)).toBe(true)
    expect(wizardStepValid(1, cond, { command_def_id: 0 })).toBe(false)
    expect(wizardStepValid(2, cond, act)).toBe(true)
    expect(wizardStepValid(3, cond, act)).toBe(true)
  })
})
