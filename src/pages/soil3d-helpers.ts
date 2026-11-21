/*
 * Хелперы Soil3D (07 §3.2) — чистые функции: шкала цвета влажности/температуры,
 * выборка значения на момент времени, интерполяция профиля по глубинам.
 * Тестируются напрямую (soil3d-helpers.test.ts).
 */

export interface SeriesPoint {
  ts: number
  value: number | null
}

export interface DepthReading {
  /** Глубина установки, см (level_cm < 0, храним положительной) */
  depthCm: number
  value: number | null
}

export interface MoistureZones {
  dry: number
  norm: number
}

/** Шкала 07 §3.2: сухо → норма → переувлажнение */
export const MOISTURE_SCALE = {
  dry: '#c9a26b',
  norm: '#7fa650',
  over: '#2f7fd8',
} as const

/** Нет данных — нейтральный серый (06, статус offline) */
export const NO_DATA_COLOR = '#9aa0a6'

/*
 * A1 [ASSUMPTION]: 07 §3.2 ссылается на options.moistureZones без значений.
 * Дефолт подобран под шкалу VWC мока (16–35 %): 20/35; владелец/бэкендер могут
 * уточнить зоны — константа одна, заменяется в одном месте.
 */
export const DEFAULT_ZONES: MoistureZones = { dry: 20, norm: 35 }

const HEX_RE = /^#[0-9a-f]{6}$/i

function hexToRgb(hex: string): [number, number, number] {
  if (!HEX_RE.test(hex)) throw new Error(`bad hex: ${hex}`)
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/** Линейная смесь двух цветов, t в 0..1 (вне диапазона — кламп) */
export function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const k = clamp01(t)
  const mix = ca.map((v, i) => Math.round(v + (cb[i]! - v) * k))
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Цвет влажности (A1): 0..dry — сухо→норма, dry..norm — норма→переувлажнение,
 * выше norm — переувлажнение. null — серый «нет данных».
 */
export function moistureColor(value: number | null, zones: MoistureZones = DEFAULT_ZONES): string {
  if (value == null) return NO_DATA_COLOR
  if (value <= zones.dry) {
    return lerpColor(MOISTURE_SCALE.dry, MOISTURE_SCALE.norm, value / zones.dry)
  }
  const span = zones.norm - zones.dry
  return lerpColor(
    MOISTURE_SCALE.norm,
    MOISTURE_SCALE.over,
    span > 0 ? (value - zones.dry) / span : 1,
  )
}

/**
 * Цвет температуры (A2): относительная шкала по окну данных
 * (синий холод → красный тепло); вырожденное окно — нейтральный цвет.
 */
export function tempColor(value: number | null, min: number, max: number): string {
  if (value == null) return NO_DATA_COLOR
  if (!(max > min)) return MOISTURE_SCALE.norm
  return lerpColor('#2F7FD8', '#C62828', (value - min) / (max - min))
}

/** Значение ряда на момент t: последняя точка с ts <= t; null — данных ещё нет */
export function valueAt(points: SeriesPoint[], t: number): number | null {
  let found: number | null = null
  for (const p of points) {
    if (p.ts > t) break
    found = p.value
  }
  return found
}

/** Общая сетка времени рядов: объединение меток, сортировка, без дублей */
export function timeGrid(series: SeriesPoint[][]): number[] {
  const set = new Set<number>()
  for (const points of series) for (const p of points) set.add(p.ts)
  return [...set].sort((a, b) => a - b)
}

/** Цвет заливки профиля по режиму: влажность — шкала 07 §3.2, температура — A2 */
export function profileColor(
  value: number | null,
  mode: 'moisture' | 'temperature',
  tempRange: { min: number; max: number },
  zones: MoistureZones = DEFAULT_ZONES,
): string {
  if (mode === 'moisture') return moistureColor(value, zones)
  return tempColor(value, tempRange.min, tempRange.max)
}

/**
 * Значение профиля на глубине: линейная интерполяция между соседними датчиками;
 * выше мелкого / ниже глубокого — кламп к краевому датчику.
 * null у одного из соседей — данных нет (не выдумываем).
 */
export function valueAtDepth(readings: DepthReading[], depthCm: number): number | null {
  if (readings.length === 0) return null
  const sorted = [...readings].sort((a, b) => a.depthCm - b.depthCm)
  if (depthCm <= sorted[0]!.depthCm) return sorted[0]!.value
  const last = sorted[sorted.length - 1]!
  if (depthCm >= last.depthCm) return last.value
  for (let i = 1; i < sorted.length; i++) {
    const lo = sorted[i - 1]!
    const hi = sorted[i]!
    if (depthCm <= hi.depthCm) {
      if (lo.value == null || hi.value == null) return null
      const t = (depthCm - lo.depthCm) / (hi.depthCm - lo.depthCm)
      return lo.value + (hi.value - lo.value) * t
    }
  }
  return last.value
}

/*
 * Изопроекция для подписей Soil3D: камера ортографическая с фиксированной
 * позицией ([11,7,11], взгляд в центр блока) — проекция чистая функция,
 * считается без three.js и покрывается тестами.
 */

type V3 = [number, number, number]

const SOIL_CAM: V3 = [11, 7, 11]

function norm(v: V3): V3 {
  const r = Math.hypot(v[0], v[1], v[2])
  return [v[0] / r, v[1] / r, v[2] / r]
}

function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/** Экранная вертикаль мировой точки (в мировых единицах, цель камеры — [0,0,0]) */
export function isoScreenY([x, y, z]: V3): number {
  const dir = norm(SOIL_CAM)
  const upv = norm(cross(dir, norm(cross([0, 1, 0], dir))))
  return x * upv[0] + y * upv[1] + z * upv[2]
}

/**
 * Позиция подписи датчика сверху канваса, px: та же изопроекция, что в three
 * (камера [11,7,11], взгляд в центр блока), поэтому метка совпадает с капсулой.
 * Блок в мировых координатах центрирован: x∈[-3,3], y∈[-h/2,h/2], z∈[-1.5,1.5];
 * датчик — на передней грани (x = −3+0.7·W, z = 1.5).
 */
export function labelTopPx(
  depthCm: number,
  maxDepthCm: number,
  zoom: number,
  canvasH: number,
): number {
  const h = maxDepthCm * 0.1
  const screenY = isoScreenY([1.2, h / 2 - depthCm * 0.1, 1.5])
  return canvasH / 2 - screenY * zoom
}
