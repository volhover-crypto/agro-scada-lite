import type { ReactNode } from 'react'
import { BarWidget } from './Bar'
import { CardWidget } from './Card'
import { ChartWidget } from './Chart'
import { GaugeWidget } from './Gauge'
import { LampWidget, type LampOptions } from './Lamp'
import { TableWidget } from './Table'
import type { WidgetConfig, WidgetKind } from './types'

/*
 * Фабрика виджетов (07 §1): конфиг из dashboards.layout → компонент.
 * scene3d/soil3d/map рендерятся вне сетки (T10/T11 и карта объекта).
 */

/** Опции виджета из options (типизированно; в моке может быть что угодно) */
function num(opts: Record<string, unknown>, key: string, fallback: number): number {
  const v = opts[key]
  return typeof v === 'number' ? v : fallback
}

const RENDERERS: Record<WidgetKind, (config: WidgetConfig) => ReactNode> = {
  card: (config) => (
    <CardWidget
      title={config.title}
      tags={config.tags}
      precision={num(config.options ?? {}, 'precision', 1)}
    />
  ),
  gauge: (config) => (
    <GaugeWidget
      title={config.title}
      tags={config.tags}
      thresholds={config.thresholds ?? []}
      options={{
        min: num(config.options ?? {}, 'min', 0),
        max: num(config.options ?? {}, 'max', 100),
      }}
    />
  ),
  lamp: (config) => (
    <LampWidget
      title={config.title}
      tags={config.tags}
      options={(config.options ?? {}) as LampOptions}
    />
  ),
  chart: (config) => {
    const opts = config.options ?? {}
    return (
      <ChartWidget
        title={config.title}
        tags={config.tags}
        thresholds={config.thresholds ?? []}
        period={(opts.period as '24h' | '7d' | '30d') ?? '24h'}
        agg={(opts.agg as 'avg' | 'min' | 'max') ?? 'avg'}
      />
    )
  },
  bar: (config) => (
    <BarWidget
      title={config.title}
      tags={config.tags}
      period={((config.options ?? {}).period as '24h' | '7d' | '30d') ?? '7d'}
    />
  ),
  table: (config) => <TableWidget title={config.title} tags={config.tags} />,
  map: () => <div>Вид «map» рендерится страницей объекта</div>,
  scene3d: () => <div>Вид «scene3d» рендерится страницей объекта</div>,
  soil3d: () => <div>Вид «soil3d» рендерится страницей объекта</div>,
}

/** Конфиг → виджет */
export function WidgetById({ config }: { config: WidgetConfig }) {
  const render = RENDERERS[config.kind]
  return render ? render(config) : <div>Виджет «{config.kind}» не поддерживается в сетке</div>
}
