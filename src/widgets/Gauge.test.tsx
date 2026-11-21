import { describe, expect, it } from 'vitest'
import { colorAt, gaugeAngle, zoneArcs } from './Gauge'

describe('gaugeAngle', () => {
  it('min → −90, середина → 0, max → +90', () => {
    expect(gaugeAngle(0, 0, 100)).toBe(-90)
    expect(gaugeAngle(50, 0, 100)).toBe(0)
    expect(gaugeAngle(100, 0, 100)).toBe(90)
  })

  it('вне диапазона — у упора', () => {
    expect(gaugeAngle(147, 0, 100)).toBe(90)
    expect(gaugeAngle(-5, 0, 100)).toBe(-90)
  })

  it('null — левый упор', () => {
    expect(gaugeAngle(null, 0, 100)).toBe(-90)
  })
})

describe('zoneArcs / colorAt', () => {
  it('threshold 25 → два сегмента: ниже warn, выше ok', () => {
    const arcs = zoneArcs(0, 100, [{ value: 25, color: 'warn' }])
    expect(arcs).toHaveLength(2)
    expect(arcs[0]).toEqual([0, 25, 'var(--alarm-p3)'])
    expect(arcs[1]).toEqual([25, 100, 'var(--actuator-on)'])
  })

  it('без thresholds — одна ok-зона', () => {
    expect(zoneArcs(0, 6, [])).toEqual([[0, 6, 'var(--actuator-on)']])
  })

  it('colorAt: «ниже value → color», иначе ok', () => {
    expect(colorAt(1.2, [{ value: 1.5, color: 'alarm' }])).toBe('alarm')
    expect(colorAt(2.8, [{ value: 1.5, color: 'alarm' }])).toBe('ok')
  })
})
