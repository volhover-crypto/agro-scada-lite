import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
// Inter локально (06_DESIGN_TOKENS §3): текст 400, заголовки/крупные значения 600
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import { installUnauthorizedRedirect, router } from '@/app/router'
import '@/styles/tokens.css'
import '@/styles/global.css'

// 401 из любого запроса → /login (02 §4)
installUnauthorizedRedirect(router)

// Мок (MSW): подключается только динамическими импортами внутри условия —
// в прод-сборке (VITE_USE_MOCK=false) ветка вырезается, кода мока в бандле нет
async function enableMock(): Promise<void> {
  const { worker } = await import('@/mocks/browser')
  const { applyScenario, isScenario } = await import('@/mocks/scenarios')
  const { mountDebugPanel } = await import('@/mocks/mountDebugPanel')
  await worker.start({ onUnhandledFrame: 'bypass' })
  const scenario = new URLSearchParams(window.location.search).get('scenario')
  applyScenario(isScenario(scenario) ? scenario : 'normal')
  mountDebugPanel()
  // флаг для e2e: воркер активен и перехватывает запросы
  ;(window as unknown as Record<string, unknown>).__mockReady = true
}

if (import.meta.env.VITE_USE_MOCK === 'true') {
  void enableMock()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
