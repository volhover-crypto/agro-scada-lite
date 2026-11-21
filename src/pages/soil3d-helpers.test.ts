import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ZONES,
  MOISTURE_SCALE,
  NO_DATA_COLOR,
  isoScreenY,
  labelTopPx,
  lerpColor,
  moistureColor,
  tempColor,
  timeGrid,
  valueAt,
  valueAtDepth,
  type SeriesPoint,
} from './soil3d-helpers'

function points(list: Array<[number, number | null]>): SeriesPoint[] {
  return list.map(([ts, value]) => ({ ts, value }))
}

describe('lerpColor', () => {
  it('края и середина', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000')
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(lerpColor('#102030', '#304050', 0.5)).toBe('#203040')
  })

  it('клампит t вне 0..1', () => {
    expect(lerpColor('#000000', '#ffffff', -2)).toBe('#000000')
    expect(lerpColor('#000000', '#ffffff', 3)).toBe('#ffffff')
  })
})

describe('moistureColor — шкала 07 §3.2 (A1: зоны 20/35)', () => {
  it('0 — сухо, граница dry — норма, norm и выше — переувлажнение', () => {
    expect(moistureColor(0)).toBe(MOISTURE_SCALE.dry)
    expect(moistureColor(DEFAULT_ZONES.dry)).toBe(MOISTURE_SCALE.norm)
    expect(moistureColor(DEFAULT_ZONES.norm)).toBe(MOISTURE_SCALE.over)
    expect(moistureColor(90)).toBe(MOISTURE_SCALE.over)
  })

  it('середины зон — смесь соседних цветов', () => {
    expect(moistureColor(DEFAULT_ZONES.dry / 2)).toBe(
      lerpColor(MOISTURE_SCALE.dry, MOISTURE_SCALE.norm, 0.5),
    )
    const mid = (DEFAULT_ZONES.dry + DEFAULT_ZONES.norm) / 2
    expect(moistureColor(mid)).toBe(lerpColor(MOISTURE_SCALE.norm, MOISTURE_SCALE.over, 0.5))
  })

  it('null и вырожденные зоны', () => {
    expect(moistureColor(null)).toBe(NO_DATA_COLOR)
    expect(moistureColor(36, { dry: 35, norm: 35 })).toBe(MOISTURE_SCALE.over)
  })
})

describe('tempColor — относительная шкала (A2)', () => {
  it('min — холод, max — тепло, середина — смесь', () => {
    expect(tempColor(10, 10, 20)).toBe('#2f7fd8')
    expect(tempColor(20, 10, 20)).toBe('#c62828')
    expect(tempColor(15, 10, 20)).toBe(lerpColor('#2F7FD8', '#C62828', 0.5))
  })

  it('null и вырожденное окно', () => {
    expect(tempColor(null, 0, 10)).toBe(NO_DATA_COLOR)
    expect(tempColor(5, 5, 5)).toBe(MOISTURE_SCALE.norm)
  })
})

describe('valueAt — последняя точка не позже t', () => {
  const pts = points([
    [1000, 1],
    [2000, 2],
    [3000, null],
    [4000, 4],
  ])

  it('точно в точке и между точками', () => {
    expect(valueAt(pts, 2000)).toBe(2)
    expect(valueAt(pts, 2500)).toBe(2)
    expect(valueAt(pts, 3000)).toBe(null)
  })

  it('до первых данных и на пустом ряду', () => {
    expect(valueAt(pts, 500)).toBe(null)
    expect(valueAt([], 1000)).toBe(null)
  })
})

describe('timeGrid — объединение и сортировка', () => {
  it('союз меток без дублей', () => {
    expect(
      timeGrid([
        points([
          [3000, 1],
          [1000, 2],
        ]),
        points([
          [2000, 5],
          [3000, 7],
        ]),
      ]),
    ).toEqual([1000, 2000, 3000])
  })

  it('пустой вход', () => {
    expect(timeGrid([])).toEqual([])
  })
})

describe('isoScreenY / labelTopPx — подписи по проекции', () => {
  it('экранная вертикаль растёт с мировым Y (верх блока выше низа)', () => {
    expect(isoScreenY([3, 3.5, 1.5])).toBeGreaterThan(isoScreenY([3, -3.5, 1.5]))
  })

  it('глубже датчик — метка ниже; все внутри канваса 300 px', () => {
    const shallow = labelTopPx(10, 70, 30, 300)
    const deep = labelTopPx(60, 70, 30, 300)
    expect(shallow).toBeGreaterThan(0)
    expect(shallow).toBeLessThan(300)
    expect(deep).toBeGreaterThan(shallow)
    expect(deep).toBeLessThanOrEqual(300)
  })

  it('поверхность — выше мелкого датчика', () => {
    expect(labelTopPx(0, 70, 30, 300)).toBeLessThan(labelTopPx(10, 70, 30, 300))
  })
})

describe('valueAtDepth — профиль между датчиками', () => {
  const readings = [
    { depthCm: 10, value: 20 },
    { depthCm: 30, value: 30 },
    { depthCm: 60, value: 40 },
  ]

  it('интерполирует между соседними глубинами', () => {
    expect(valueAtDepth(readings, 20)).toBe(25)
    expect(valueAtDepth(readings, 45)).toBe(35)
  })

  it('кламп к крайним датчикам', () => {
    expect(valueAtDepth(readings, 0)).toBe(20)
    expect(valueAtDepth(readings, 100)).toBe(40)
  })

  it('не входит в неотсортированный список', () => {
    const messy = [readings[2]!, readings[0]!, readings[1]!]
    expect(valueAtDepth(messy, 20)).toBe(25)
  })

  it('null у соседа — данных нет', () => {
    const hole = [
      { depthCm: 10, value: 20 },
      { depthCm: 30, value: null },
    ]
    expect(valueAtDepth(hole, 20)).toBe(null)
    expect(valueAtDepth(hole, 5)).toBe(20)
  })

  it('пустой список', () => {
    expect(valueAtDepth([], 10)).toBe(null)
  })
})
