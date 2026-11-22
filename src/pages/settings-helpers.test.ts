import { describe, expect, it } from 'vitest'
import type { components } from '@/api/types.gen'
import {
  channelBindingInfo,
  channelLiveValue,
  OBJECT_TYPES,
  objectTypeLabel,
  policyHint,
  policyLabel,
} from './settings-helpers'

type ChannelT = components['schemas']['Channel']

function ch(over: Partial<ChannelT>): ChannelT {
  return {
    id: 1,
    dev_eui: '70B3D58FF0031A01',
    param_code: 3,
    param_name: 'Влажность грунта',
    unit: '%',
    level_cm: -10,
    sensor_no: 1,
    status: 'unassigned',
    last_value: null,
    last_ts: null,
    tag_id: '70B3D58FF0031A01/3/-10/1',
    ...over,
  } as ChannelT
}

describe('objectTypeLabel — список 05 §10', () => {
  it('6 типов, известный и неизвестный', () => {
    expect(OBJECT_TYPES).toHaveLength(6)
    expect(objectTypeLabel('vineyard')).toBe('Виноградник')
    expect(objectTypeLabel('pump_station')).toBe('Насосная')
    expect(objectTypeLabel('alien')).toBe('alien')
  })
})

describe('policyLabel / policyHint — 4 политики с пояснением', () => {
  it('все варианты и прочерк', () => {
    expect(policyLabel('none')).toBe('Без подтверждения')
    expect(policyLabel('manual_and_rule_approval')).toBe('Ручные и по правилам')
    expect(policyHint('always')).toContain('подтверждения')
    expect(policyHint(undefined)).toBe('')
  })
})

describe('channelBindingInfo — подпись и unknown_code', () => {
  it('обычный канал: «Влажность грунта −10 см №1», привязываем', () => {
    expect(channelBindingInfo(ch({}))).toEqual({
      label: 'Влажность грунта −10 см №1',
      bindable: true,
      unknown: false,
    })
  })

  it('unknown_code: серый «Нет в справочнике», привязка запрещена', () => {
    const info = channelBindingInfo(ch({ status: 'unknown_code', param_name: '' }))
    expect(info).toEqual({
      label: 'Нет в справочнике',
      bindable: false,
      unknown: true,
    })
  })

  it('assigned — уже не привязывается', () => {
    expect(channelBindingInfo(ch({ status: 'assigned' })).bindable).toBe(false)
  })
})

describe('channelLiveValue — живое значение', () => {
  it('со значением и временем; без — «нет данных»', () => {
    const v = channelLiveValue(ch({ last_value: 27.4, last_ts: '2026-11-22T09:15:00+03:00' }))
    expect(v).toContain('27.4 %')
    expect(v).toMatch(/\d\d:\d\d/)
    expect(channelLiveValue(ch({}))).toBe('нет данных')
  })
})
