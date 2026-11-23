/* eslint-disable react-refresh/only-export-components -- обёртка ECharts без локального состояния */
import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

// Регистрируем только необходимое (D-04: echarts/core, tree-shaking)
echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  CanvasRenderer,
])

/**
 * Голая обёртка. При изменении опции инстанс пересоздаётся целиком:
 * merge-обновление и dispose с inside-dataZoom в echarts 6.1 падают
 * (bugs: CartesianAxisView `.group`, disposeCoordSysRecord) — пересоздание
 * обходит оба. Побочный эффект — перерисовка на каждом обновлении данных.
 */
export function EChartCanvas({
  option,
  height = '100%',
}: {
  option: EChartsCoreOption
  height?: number | string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    // echarts 6.1: dispose может бросить (inside-dataZoom) и оставить атрибут
    // _echarts_instance_ — тогда init вернёт мёртвый инстанс из реестра.
    // Снимаем атрибут до и после dispose, чтобы init всегда создавал свежий.
    try {
      echarts.dispose(host)
    } catch {
      // ignore
    }
    host.removeAttribute('_echarts_instance_')
    const chart = echarts.init(host)
    try {
      chart.setOption(option)
    } catch (e) {
      // опция кривая — не роняем страницу, график просто не отрисуется
      console.error('ECharts setOption', e)
    }
    // в jsdom ResizeObserver нет — без него график просто не ресайзится
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => chart.resize()) : null
    ro?.observe(host)
    return () => {
      ro?.disconnect()
      try {
        host.removeAttribute('_echarts_instance_')
        chart.clear()
        chart.dispose()
      } catch {
        // известный баг dispose в echarts 6.1 (inside-dataZoom)
      }
    }
  }, [option])

  return (
    <div
      ref={hostRef}
      style={{ width: '100%', height, minHeight: 180, flex: 1 }}
      role="img"
      aria-label="График"
    />
  )
}
