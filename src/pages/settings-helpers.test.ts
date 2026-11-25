import { describe, expect, it } from 'vitest'
import { OBJECT_TYPES, objectTypeLabel } from './settings-helpers'

describe('objectTypeLabel — канонический список из 7 кодов (T20)', () => {
  const canonicalCodes = [
    'vineyard',
    'orchard',
    'greenhouse',
    'pump_station',
    'field',
    'meteo',
    'other',
  ] as const

  it('содержит все 7 канонических кодов', () => {
    expect(OBJECT_TYPES.map(([code]) => code)).toEqual(canonicalCodes)
  })

  it('возвращает русские подписи, а не сырые коды', () => {
    for (const code of canonicalCodes) {
      const label = objectTypeLabel(code)
      expect(label).not.toBe(code)
      expect(label).not.toBe('—')
      expect(/[А-Яа-яЁё]/.test(label)).toBe(true)
    }
  })
})
