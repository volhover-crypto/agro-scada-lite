import { strHash } from './util'

/*
 * Детерминированный генератор значений тегов (04_MOCK_SPEC §2):
 * суточные синусоиды, выраженные импульсы полива и просачивания по глубинам,
 * давление при работе насоса, редкие дожди.
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR

function fracOfDay(ms: number): number {
  return (((ms % DAY) + DAY) % DAY) / DAY
}

function dayIndex(ms: number): number {
  return Math.floor(ms / DAY)
}

/** Шум -1..1, детерминированный по (tag, час) */
function wobble(tagId: string, ms: number): number {
  const h = strHash(`${tagId}:${Math.floor(ms / HOUR)}`)
  return ((h % 1000) / 1000 - 0.5) * 2
}

/** Насос работает утром 06:00–07:30 и вечером 18:00–18:30 */
export function pumpActive(ms: number): boolean {
  const f = fracOfDay(ms)
  return (f >= 6 / 24 && f < 7.5 / 24) || (f >= 18 / 24 && f < 18.5 / 24)
}

/**
 * Волна промачивания после полива с задержкой по глубине:
 * верхний слой (-10 см) реагирует сразу, глубокие (-20..-60 см) — с запаздыванием
 * и меньшей амплитудой, чтобы в плеере было видно просачивание воды сверху вниз.
 */
function percolationPulse(hourOfDay: number, startHour: number, depthCm: number, peak: number): number {
  const lag = (depthCm / 60) * 3.5 // до 3.5 ч запаздывания на 60 см
  let dt = hourOfDay - (startHour + lag)
  if (dt < 0) dt += 24
  if (dt > 11) return 0
  const rise = Math.min(1, dt / 1.4)
  const decay = Math.exp(-Math.max(0, dt - 1.4) / (3.2 + depthCm * 0.04))
  const depthAtten = 1 - (depthCm / 120) * 0.35
  return peak * rise * decay * depthAtten
}

export function valueAt(tagId: string, code: number, levelCm: number, ms: number): number {
  const f = fracOfDay(ms)
  const n = wobble(tagId, ms)
  switch (code) {
    case 0x01: // t воздуха: 4–14 °C, максимум после полудня
      return +(9 + 5 * Math.sin((2 * Math.PI * (f - 0.583)) / 1) + n * 0.6).toFixed(1)
    case 0x02: // RH: 60–95 %, максимум к утру
      return +(77.5 - 17.5 * Math.sin((2 * Math.PI * (f - 0.583)) / 1) + n * 2).toFixed(1)
    case 0x03: {
      // влажность грунта 12–42 %: выраженный суточный цикл высыхания + 2 импульса полива с просачиванием
      const depth = Math.abs(levelCm)
      const h = f * 24
      const dryWeek = ((ms % (7 * DAY)) / (7 * DAY)) * 5
      // Дневное испарение сильнее в верхних слоях
      const evap = Math.max(0, Math.sin(((h - 10) / 12) * Math.PI)) * (6.5 - depth * 0.06)
      const morning = percolationPulse(h, 5.5, depth, 19)
      const evening = percolationPulse(h, 17.0, depth, 14)
      const base = 20 + (depth / 60) * 4 - dryWeek
      const v = base - evap + morning + evening + n * 1.1
      return +Math.min(42, Math.max(11, v)).toFixed(1)
    }
    case 0x04: // t грунта 8–12 °C, медленная
      return +(10 + 1.8 * Math.sin((2 * Math.PI * (ms / DAY - 0.25)) / 3) + n * 0.2).toFixed(1)
    case 0x05: // EC
      return +(1.2 + 0.15 * n).toFixed(2)
    case 0x06: // давление системы: при работе насоса 2.5–3.2 бар, иначе 0
      return pumpActive(ms) ? +(2.85 + 0.35 * n).toFixed(2) : 0
    case 0x07: // давление воздуха
      return +(1013 + 12 * Math.sin(dayIndex(ms) / 3) + n * 3).toFixed(0)
    case 0x08: {
      // влажность листа: роса ночью/утром
      const dew = f < 0.25 || f > 0.83 ? 70 + 25 * n : Math.max(0, 10 * n)
      return +Math.min(100, Math.max(0, dew)).toFixed(1)
    }
    case 0x09: {
      // осадки: редкие дождливые дни (каждый 9-й), дождь 12:00–18:00
      if (dayIndex(ms) % 9 !== 3 || f < 0.5 || f > 0.75) return 0
      return +(0.3 + 0.7 * Math.abs(n)).toFixed(1)
    }
    case 0x0a: // ветер
      return +(2 + 3 * Math.abs(n)).toFixed(1)
    case 0x0b: // радиация
      return f > 0.25 && f < 0.75
        ? +(500 * Math.sin(Math.PI * (f - 0.25) * 2) + 30 * n).toFixed(0)
        : 0
    case 0x0c: // расход при работе насоса
      return pumpActive(ms) ? +(18 + 2 * n).toFixed(1) : 0
    case 0x0d: // накопительный объём за день
      return +(dayIndex(ms) % 30) * 1.5
    case 0x0e: // уровень
      return +(52 + 3 * n).toFixed(0)
    default:
      return 0
  }
}

/** Прогноз осадков (внешний источник, kind=forecast): мягкая волна на 48 ч */
export function forecastAt(tagId: string, ms: number): number {
  const n = wobble(tagId, ms)
  const h = (((ms % DAY) + DAY) % DAY) / HOUR
  const wave = Math.max(0, Math.sin(h / 6.5))
  return +(wave * (1.6 + 0.4 * n)).toFixed(1)
}
