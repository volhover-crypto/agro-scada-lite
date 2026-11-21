/*
 * Чистые функции конструктора дашборда (07 §4) — покрыты юнит-тестами.
 * Сетка: 12 колонок ≥1280, 6 — 768–1279, 1 — <768 (06 §4).
 * На телефоне — только порядок (перестановка без resize).
 */

import type { components } from '@/api/types.gen'
import type { WidgetConfig, WidgetKind } from '@/widgets/types'

type DashboardT = components['schemas']['Dashboard']

export const GRID_COLS = { desktop: 12, tablet: 6, mobile: 1 } as const

/** Все виджеты в одну колонку и «стопкой» — режим телефона (только порядок) */
export function stackLayout(layout: WidgetConfig[]): WidgetConfig[] {
  let y = 0
  return layout.map((w) => {
    const stacked = { ...w, grid: { x: 0, y, w: 1, h: w.grid.h } }
    y += w.grid.h
    return stacked
  })
}

/** Свободное место в 12 колонках: нижняя строка, слева направо */
export function addWidgetToLayout(
  layout: WidgetConfig[],
  kind: WidgetKind,
  tags: string[],
  title: string,
  extra?: { thresholds?: WidgetConfig['thresholds']; options?: Record<string, unknown> },
): WidgetConfig[] {
  // высота по виду: chart 4, bar 3, table 5, остальные 2
  const h = kind === 'chart' ? 4 : kind === 'bar' ? 3 : kind === 'table' ? 5 : 2
  const w = kind === 'chart' || kind === 'table' ? 6 : 3
  const maxY = layout.reduce((m, cfg) => Math.max(m, cfg.grid.y + cfg.grid.h), 0)
  const widget: WidgetConfig = {
    id: `w${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
    kind,
    title: title || undefined,
    tags,
    thresholds: extra?.thresholds,
    options: extra?.options,
    grid: { x: 0, y: maxY, w, h },
  }
  return [...layout, widget]
}

/** Удаление виджета по id */
export function removeWidgetFromLayout(layout: WidgetConfig[], id: string): WidgetConfig[] {
  return layout.filter((w) => w.id !== id)
}

/** Дашборд объекта: первый существующий (layout инициализируется seed'ом) */
export function dashboardOf(
  list: DashboardT[] | undefined,
  objectId: number,
): DashboardT | undefined {
  return list?.find((d) => d.object_id === objectId)
}

/** Порог одного виджета из конструктора: [{ value, color }] */
export function thresholdsFrom(
  value: number | null,
  kind: 'warn' | 'alarm',
): WidgetConfig['thresholds'] {
  if (value == null || Number.isNaN(value)) return []
  return [{ value, color: kind }]
}
