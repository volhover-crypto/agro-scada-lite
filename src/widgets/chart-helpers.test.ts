import { describe, expect, it } from 'vitest'
import {
  buildLineSeries,
  canAddTag,
  isForecastSeries,
  MAX_SERIES,
  pickStepAgg,
  unitAxes,
} from './chart-helpers'

// Приёмка T08: лимит 8 рядов, агрегат при больших периодах, 2 оси Y (07 §5)

describe('canAddTag — лимит рядов', () => {
  it('до 8 включительно, дубль запрещён', () => {
    const eight = Array.from({ length: 8 }, (_, i) => `t${i}`)
    expect(canAddTag([], 'a')).toBe(true)
    expect(canAddTag(['a'], 'a')).toBe(false) // дубль
    expect(canAddTag(eight.slice(0, 7), 't7')).toBe(true)
    expect(canAddTag(eight, 't8')).toBe(false) // 9-й запрещён
    expect(MAX_SERIES).toBe(8)
  })
})

describe('pickStepAgg — агрегат при больших периодах (02 §7)', () => {
  it('24ч → 1h (raw допустим); 7д/30д → raw заменяется на avg', () => {
    expect(pickStepAgg('24h', 'raw')).toEqual({ step: '1h', agg: 'raw' })
    expect(pickStepAgg('7d', 'raw')).toEqual({ step: '1h', agg: 'avg' })
    expect(pickStepAgg('30d', 'raw')).toEqual({ step: '1d', agg: 'avg' })
    expect(pickStepAgg('30d', 'min')).toEqual({ step: '1d', agg: 'min' })
    expect(pickStepAgg('24h', 'max')).toEqual({ step: '1h', agg: 'max' })
  })
})

describe('unitAxes — 2 оси Y по единицам (07 §2)', () => {
  it('одна единица — одна ось; две — левая и правая; дубль единицы не плодит осей', () => {
    expect(unitAxes(['%'])).toEqual([{ unit: '%', axisIndex: 0 }])
    expect(unitAxes(['°C', '%'])).toEqual([
      { unit: '°C', axisIndex: 0 },
      { unit: '%', axisIndex: 1 },
    ])
    expect(unitAxes(['%', '%', '%'])).toEqual([
      { unit: '%', axisIndex: 0 },
      { unit: '%', axisIndex: 0 },
      { unit: '%', axisIndex: 0 },
    ])
  })

  it('третья единица приписывается к существующей оси', () => {
    const axes = unitAxes(['°C', '%', 'бар'])
    expect(axes[2]!.axisIndex).toBe(0)
  })
})

describe('buildLineSeries / isForecastSeries', () => {
  it('прогноз (EXT-тег или kind=forecast) помечается forecast', () => {
    expect(isForecastSeries(undefined, 'EXT0000000000001/9/0/1')).toBe(true)
    expect(isForecastSeries({ kind: 'forecast' } as never, 'A/1/0/1')).toBe(true)
    expect(isForecastSeries({ kind: 'fact' } as never, 'A/1/0/1')).toBe(false)
  })

  it('серия наследует ось по единице и имя по справочнику', () => {
    const out = buildLineSeries(
      [
        { tag_id: 'a', unit: '°C', points: [['t', 1, 'good']] },
        { tag_id: 'b', unit: '%', points: [['t', 2, 'good']] },
      ] as never,
      new Map([['a', 'Температура']]),
      new Map(),
    )
    expect(out[0]).toMatchObject({ name: 'Температура', axisIndex: 0, kind: 'fact' })
    expect(out[1]).toMatchObject({ name: 'b', axisIndex: 1 })
  })
})
