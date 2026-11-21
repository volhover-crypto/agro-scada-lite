import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * Приёмка T02: контраст текста ≥ 4.5:1 на --bg-surface (06_DESIGN_TOKENS §7).
 * Читаем tokens.css и считаем WCAG-контраст по факту — палитру не дублируем в тесте.
 */

function parseTokens(css: string): Record<string, string> {
  const vars: Record<string, string> = {}
  const re = /--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g
  for (const m of css.matchAll(re)) {
    vars[m[1]!] = m[2]!.toLowerCase()
  }
  return vars
}

function channel(hex: string, index: number): number {
  return parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255
}

function luminance(hex: string): number {
  const rgb = [0, 1, 2].map((i) => {
    const c = channel(hex, i)
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!
}

function contrast(fg: string, bg: string): number {
  const l1 = luminance(fg)
  const l2 = luminance(bg)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

// Vitest не отдаёт CSS через ?raw (по умолчанию CSS стабится) — читаем файл напрямую;
// cwd при `npm run test` — корень проекта
const tokens = parseTokens(readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf-8'))

// 06 §7: контраст ТЕКСТА ≥ 4.5:1 на --bg-surface (и на фоне страницы — тот же текст).
// P2/P3 включены после затемнения по решению владельца (QUESTIONS В9, В10)
const TEXT_PAIRS: Array<[fg: string, bg: string]> = [
  ['text-primary', 'bg-surface'],
  ['text-secondary', 'bg-surface'],
  ['text-primary', 'bg-page'],
  ['text-secondary', 'bg-page'],
  ['alarm-p2', 'alarm-p2-bg'],
  ['alarm-p2', 'bg-surface'],
  ['alarm-p3', 'alarm-p3-bg'],
  ['alarm-p3', 'bg-surface'],
]

describe('контраст токенов (06_DESIGN_TOKENS §7)', () => {
  it.each(TEXT_PAIRS)('%s на %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5)
  })

  it('все hex-токены — валидные 6-значные цвета', () => {
    for (const [name, hex] of Object.entries(tokens)) {
      expect(hex, `--${name}`).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
