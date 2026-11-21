import { describe, expect, it } from 'vitest'
import type { components } from '@/api/types.gen'
import {
  DEFAULT_FILTERS,
  alarmTarget,
  escalationLabel,
  filterAlarms,
  isActiveAlarm,
  isUnacked,
  priorityLabel,
  stateLabel,
} from './alarms-helpers'

type AlarmT = components['schemas']['Alarm']

function alarm(over: Partial<AlarmT>): AlarmT {
  return {
    id: 1,
    alarm_def_id: 1,
    type: 'threshold',
    priority: 3,
    object_id: 1,
    post_id: 5,
    message: 'Влажность грунта 22 % ниже 25 %',
    state: 'active_unacked',
    value: 22,
    raised_at: '2026-11-22T09:00:00+03:00',
    acked_by: null,
    acked_at: null,
    cleared_at: null,
    escalation_step: 0,
    ...over,
  } as AlarmT
}

describe('isActiveAlarm / isUnacked', () => {
  it('активные — оба active; неподтверждённые — не подтверждённые оператором', () => {
    expect(isActiveAlarm(alarm({}))).toBe(true)
    expect(isActiveAlarm(alarm({ state: 'active_acked' }))).toBe(true)
    expect(isActiveAlarm(alarm({ state: 'closed' }))).toBe(false)
    expect(isUnacked(alarm({}))).toBe(true)
    expect(isUnacked(alarm({ state: 'cleared_unacked' }))).toBe(true)
    expect(isUnacked(alarm({ state: 'active_acked' }))).toBe(false)
  })
})

describe('filterAlarms — состояние × объект × приоритет (05 §6)', () => {
  const list = [
    alarm({ id: 1, priority: 1, object_id: 1, state: 'active_unacked' }),
    alarm({ id: 2, priority: 3, object_id: 2, state: 'active_acked' }),
    alarm({ id: 3, priority: 3, object_id: 1, state: 'closed' }),
    alarm({ id: 4, priority: 2, object_id: 2, state: 'cleared_unacked' }),
  ]

  it('активные по умолчанию — снятые и закрытые не входят', () => {
    expect(filterAlarms(list, DEFAULT_FILTERS).map((a) => a.id)).toEqual([1, 2])
  })

  it('неподтверждённые — unacked-состояния', () => {
    expect(filterAlarms(list, { ...DEFAULT_FILTERS, state: 'unacked' }).map((a) => a.id)).toEqual([
      1, 4,
    ])
  })

  it('все + фильтры объекта и приоритета', () => {
    const all = { ...DEFAULT_FILTERS, state: 'all' as const }
    expect(filterAlarms(list, all)).toHaveLength(4)
    expect(filterAlarms(list, { ...all, objectId: 2 }).map((a) => a.id)).toEqual([2, 4])
    expect(filterAlarms(list, { ...all, priority: 3 }).map((a) => a.id)).toEqual([2, 3])
    expect(filterAlarms(list, { ...all, objectId: 2, priority: 3 }).map((a) => a.id)).toEqual([2])
  })
})

describe('stateLabel / priorityLabel / escalationLabel', () => {
  it('подписи состояний', () => {
    expect(stateLabel('active_unacked')).toBe('Активна')
    expect(stateLabel('active_acked')).toBe('Подтверждена')
    expect(stateLabel('cleared_unacked')).toBe('Снята')
    expect(stateLabel('closed')).toBe('Закрыта')
    expect(stateLabel(undefined)).toBe('—')
  })

  it('подписи приоритетов', () => {
    expect(priorityLabel(1)).toBe('P1 Авария')
    expect(priorityLabel(4)).toBe('P4 Информация')
    expect(priorityLabel(null)).toBe('—')
  })

  it('эскалация: 0 — прочерк, N — шаг', () => {
    expect(escalationLabel(0)).toBe('—')
    expect(escalationLabel(2)).toBe('Шаг 2')
    expect(escalationLabel(null)).toBe('—')
  })
})

describe('alarmTarget — «К устройству»: пост, иначе объект', () => {
  it('с постом — на страницу поста; без поста — к объекту; без объекта — null', () => {
    expect(alarmTarget(alarm({}))).toEqual({ to: '/o/1/p/5', label: 'К устройству' })
    expect(alarmTarget(alarm({ post_id: null }))).toEqual({ to: '/o/1', label: 'К объекту' })
    expect(alarmTarget(alarm({ object_id: undefined, post_id: undefined }))).toBe(null)
  })
})
