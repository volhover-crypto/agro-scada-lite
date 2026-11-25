/*
 * Чистые хелперы страницы поста (07 §3.1) — перенесены из PostPage.tsx
 * (этап 8, §8.7): файл компонента экспортирует только компоненты.
 */

import { formatNumber } from '@/widgets/quality'

/** Ключ базовой станции: 'bs1' → 'БС-1' (формат receptions мока; BR-FE-1) */
export function bsLabel(key: string): string {
  return key.replace(/^bs/i, 'БС-')
}

export function batteryText(batMv: number | null | undefined): string {
  return batMv == null ? '—' : `${formatNumber(batMv / 1000)} В`
}
