// Утилиты мока: время (ISO 8601 с поясом +03:00, BACKEND_CANON §4.1), id, ПСЧ

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000

/** ISO 8601 с поясом Europe/Moscow: 2026-11-21T14:05:09+03:00 */
export function iso(ms: number = Date.now()): string {
  return new Date(ms + MSK_OFFSET_MS).toISOString().replace('Z', '+03:00')
}

/** Детерминированный ПСЧ (mulberry32): одинаковый seed → одинаковые данные */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)]!
}

export function range(rnd: () => number, min: number, max: number): number {
  return min + rnd() * (max - min)
}

export function uuid(): string {
  return crypto.randomUUID()
}

/** Стабильный «шум» от строки: для детерминированных суточных кривых */
export function strHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
