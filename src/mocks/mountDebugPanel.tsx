import { createRoot } from 'react-dom/client'
import { DebugPanel } from './DebugPanel'

/** Монтирует панель отладки в document.body (вызывается из main.tsx только при моке).
 *  Живёт отдельно от компонента: react-refresh требует файл только с компонентами. */
export function mountDebugPanel(): void {
  const host = document.createElement('div')
  host.id = 'mock-debug-panel'
  document.body.append(host)
  createRoot(host).render(<DebugPanel />)
}
