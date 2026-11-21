/*
 * Время в поясе объекта (01_README_AGENT §4.8): ISO 8601 с поясом,
 * отображение «20.11.2026 09:15», по умолчанию Europe/Moscow.
 */

const DEFAULT_TZ = 'Europe/Moscow'

function parts(iso: string, tz: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const fmt = new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz || DEFAULT_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  // ru-RU даёт «20.11.2026, 09:15» — убираем запятую
  return fmt.format(d).replace(',', '')
}

/** «20.11.2026 09:15» в поясе tz */
export function formatDateTimeRu(iso: string, tz?: string): string {
  return parts(iso, tz ?? DEFAULT_TZ)
}

/** «09:15» в поясе tz */
export function formatTimeRu(iso: string, tz?: string): string {
  return parts(iso, tz ?? DEFAULT_TZ).slice(-5)
}

/** ISO 8601 с поясом +03:00 (для since поллера; сравнимо строково с ответами мока) */
export function toMskIso(ms: number = Date.now()): string {
  return new Date(ms + 3 * 3_600_000).toISOString().replace('Z', '+03:00')
}
