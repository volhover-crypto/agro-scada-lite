// Конфиг виджета из 07_WIDGETS_SPEC §1 (хранится в dashboards.layout через API).
// Это UI-тип, не тип API — ручное описание допустимо (правило касается типов API).

export type WidgetKind =
  'gauge' | 'lamp' | 'card' | 'chart' | 'bar' | 'table' | 'map' | 'scene3d' | 'soil3d'

export interface WidgetThreshold {
  value: number
  color: 'ok' | 'warn' | 'alarm'
}

export interface WidgetConfig {
  id: string
  kind: WidgetKind
  title?: string
  /** tag_id в формате {dev_eui}/{code}/{level}/{no} */
  tags: string[]
  thresholds?: WidgetThreshold[]
  options?: Record<string, unknown>
  grid: { x: number; y: number; w: number; h: number }
}
