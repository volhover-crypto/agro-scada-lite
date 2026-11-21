import { describe, expect, it } from 'vitest'
import type { components } from '@/api/types.gen'
import {
  DURATION_PRESETS_MIN,
  actionLabel,
  actionOfDef,
  durationLabel,
  durationOverMax,
  factStateLabel,
  finalOutcome,
  historyRow,
  isActiveStatus,
  isDone,
  isRunning,
  maxDurationHint,
  needsConfirm,
  needsDuration,
  remainingText,
  statusStepLabel,
  trailView,
} from './device-helpers'

type CommandDefT = components['schemas']['CommandDef']

function def(over: Partial<CommandDefT>): CommandDefT {
  return {
    id: 1,
    actuator_id: 1,
    action: 'on',
    confirm_policy: 'manual_only',
    ...over,
  } as CommandDefT
}

describe('actionLabel / isRunning — ВКЛЮЧИТЬ превращается в ПРОДЛИТЬ', () => {
  it('on: выкл → ВКЛЮЧИТЬ, вкл → ПРОДЛИТЬ', () => {
    expect(actionLabel('on', 'off')).toBe('ВКЛЮЧИТЬ')
    expect(actionLabel('on', 'on')).toBe('ПРОДЛИТЬ')
    expect(actionLabel('on', undefined)).toBe('ВКЛЮЧИТЬ')
  })

  it('off/open/close — фиксированные подписи', () => {
    expect(actionLabel('off', 'on')).toBe('ВЫКЛЮЧИТЬ')
    expect(actionLabel('open', 'closed')).toBe('ОТКРЫТЬ')
    expect(actionLabel('close', 'open')).toBe('ЗАКРЫТЬ')
  })

  it('isRunning — только on/open', () => {
    expect(isRunning('on')).toBe(true)
    expect(isRunning('open')).toBe(true)
    expect(isRunning('pending')).toBe(false)
    expect(isRunning(null)).toBe(false)
  })
})

describe('needsConfirm / needsDuration — политики 05 §5 и канон §3.1', () => {
  it('on с политикой manual_only — диалог; off/close — никогда', () => {
    expect(needsConfirm(def({ action: 'on', confirm_policy: 'manual_only' }))).toBe(true)
    expect(needsConfirm(def({ action: 'on', confirm_policy: 'always' }))).toBe(true)
    expect(needsConfirm(def({ action: 'on', confirm_policy: 'none' }))).toBe(false)
    expect(needsConfirm(def({ action: 'off', confirm_policy: 'always' }))).toBe(false)
    expect(needsConfirm(def({ action: 'close', confirm_policy: 'always' }))).toBe(false)
  })

  it('длительность — только для on (open/close без длительности, канон §3.1 п.3)', () => {
    expect(needsDuration('on')).toBe(true)
    expect(needsDuration('off')).toBe(false)
    expect(needsDuration('open')).toBe(false)
    expect(needsDuration('close')).toBe(false)
  })

  it('пресеты — 10/15/30/60 мин, 2/4 ч', () => {
    expect(DURATION_PRESETS_MIN).toEqual([10, 15, 30, 60, 120, 240])
  })
})

describe('remainingText — «до HH:MM (осталось N мин)»', () => {
  const now = Date.parse('2026-11-22T10:22:30+03:00')

  it('больше минуты — округление до минут', () => {
    const until = new Date(now + 23 * 60_000).toISOString()
    expect(remainingText(until, now)).toMatch(/осталось 23 мин/)
  })

  it('меньше минуты и прошедшее время', () => {
    expect(remainingText(new Date(now + 30_000).toISOString(), now)).toMatch(/меньше минуты/)
    expect(remainingText(new Date(now - 60_000).toISOString(), now)).toMatch(/истекло/)
  })

  it('null и мусор — пустая строка', () => {
    expect(remainingText(null, now)).toBe('')
    expect(remainingText('not-a-date', now)).toBe('')
  })
})

describe('factStateLabel', () => {
  it('все состояния факта', () => {
    expect(factStateLabel('on')).toBe('Включено')
    expect(factStateLabel('open')).toBe('Открыто')
    expect(factStateLabel('off')).toBe('Выключено')
    expect(factStateLabel('closed')).toBe('Закрыто')
    expect(factStateLabel('pending')).toBe('Ожидание')
    expect(factStateLabel('fault')).toBe('Авария')
    expect(factStateLabel('unknown')).toBe('Неизвестно')
  })
})

describe('StatusTrail — шаги и исходы', () => {
  it('шаги цепочки; timeout/rejected/cancelled — не шаги, а исходы', () => {
    expect(statusStepLabel('created')).toBe('Создана')
    expect(statusStepLabel('awaiting_confirm')).toBe('Ждёт подтверждения')
    expect(statusStepLabel('queued')).toBe('В очереди')
    expect(statusStepLabel('sent_gw')).toBe('Передано шлюзом')
    expect(statusStepLabel('acked')).toBe('Подтверждено')
    expect(statusStepLabel('completed')).toBe('Выполнено')
    expect(statusStepLabel('timeout')).toBe(null)
    expect(statusStepLabel('rejected')).toBe(null)
  })

  it('исходы: timeout / rejected с кодом / cancelled / superseded', () => {
    expect(finalOutcome('timeout', null)).toMatchObject({ kind: 'fail' })
    expect(finalOutcome('rejected', 1)?.text).toContain('код 1')
    expect(finalOutcome('cancelled', null)?.kind).toBe('neutral')
    expect(finalOutcome('superseded', null)?.kind).toBe('neutral')
    expect(finalOutcome('acked', 0)).toBe(null)
  })

  it('«Выполнено» — только acked/completed', () => {
    expect(isDone('acked')).toBe(true)
    expect(isDone('completed')).toBe(true)
    expect(isDone('sent_gw')).toBe(false)
    expect(isDone('timeout')).toBe(false)
    expect(isDone(null)).toBe(false)
  })

  it('активные статусы — для блокировки кнопок', () => {
    expect(isActiveStatus('queued')).toBe(true)
    expect(isActiveStatus('awaiting_confirm')).toBe(true)
    expect(isActiveStatus('acked')).toBe(false)
    expect(isActiveStatus('rejected')).toBe(false)
  })
})

describe('durationLabel / maxDurationHint', () => {
  it('минуты, часы, null', () => {
    expect(durationLabel(1800)).toBe('30 мин')
    expect(durationLabel(7200)).toBe('2 ч')
    expect(durationLabel(null)).toBe('—')
    expect(durationLabel(1500)).toBe('25 мин')
  })

  it('подсказка максимума', () => {
    expect(maxDurationHint(14_400)).toBe('максимум 4 ч')
    expect(maxDurationHint(null)).toBe(null)
  })
})

describe('actionOfDef — действие по def id', () => {
  it('находит и возвращает null для неизвестного', () => {
    const defs = [def({ id: 5, action: 'on' }), def({ id: 6, action: 'off' })]
    expect(actionOfDef(defs, 6)).toBe('off')
    expect(actionOfDef(defs, 99)).toBe(null)
  })
})

describe('durationOverMax / trailView / historyRow', () => {
  const defs = [def({ id: 3, action: 'on' }), def({ id: 4, action: 'off' })]

  it('overMax: только когда заданы оба и секунды больше максимума', () => {
    expect(durationOverMax(14_401, 14_400)).toBe(true)
    expect(durationOverMax(14_400, 14_400)).toBe(false)
    expect(durationOverMax(null, 14_400)).toBe(false)
    expect(durationOverMax(5000, null)).toBe(false)
  })

  it('trailView: шаги цепочки, done-галки, исход timeout', () => {
    const cmd = {
      uuid: 'u1',
      command_def_id: 3,
      status: 'timeout',
      result_code: null,
      warnings: [],
      status_history: [
        { status: 'created', ts: '2026-11-22T10:00:00+03:00' },
        { status: 'queued', ts: '2026-11-22T10:00:01+03:00' },
        { status: 'sent_gw', ts: '2026-11-22T10:00:02+03:00' },
        { status: 'timeout', ts: '2026-11-22T10:00:07+03:00' },
      ],
    } as unknown as components['schemas']['Command']
    const view = trailView(cmd)
    expect(view.steps.map((s) => s.label)).toEqual(['Создана', 'В очереди', 'Передано шлюзом'])
    expect(view.steps.every((s) => !s.done)).toBe(true)
    expect(view.isTimeout).toBe(true)
    expect(view.outcome?.text).toContain('Не подтверждено модемом')
    expect(view.offlineWarning).toBe(false)
  })

  it('trailView: MODEM_OFFLINE c expires_at — предупреждение', () => {
    const cmd = {
      uuid: 'u2',
      command_def_id: 3,
      status: 'queued',
      result_code: null,
      warnings: ['MODEM_OFFLINE'],
      expires_at: '2026-11-22T10:30:00+03:00',
      status_history: [
        { status: 'created', ts: 'x' },
        { status: 'queued', ts: 'y' },
      ],
    } as unknown as components['schemas']['Command']
    expect(trailView(cmd).offlineWarning).toBe(true)
  })

  it('historyRow: действие, длительность и вид статуса', () => {
    const done = {
      uuid: 'u3',
      command_def_id: 3,
      status: 'completed',
      duration_s: 1800,
      result_code: 0,
      status_history: [],
    } as unknown as components['schemas']['Command']
    expect(historyRow(done, defs)).toMatchObject({
      action: 'ВКЛЮЧИТЬ',
      duration: '30 мин',
      label: 'Выполнено',
      kind: 'done',
    })
    const rejected = {
      uuid: 'u4',
      command_def_id: 3,
      status: 'rejected',
      duration_s: null,
      result_code: 1,
      status_history: [],
    } as unknown as components['schemas']['Command']
    expect(historyRow(rejected, defs).kind).toBe('fail')
  })
})
