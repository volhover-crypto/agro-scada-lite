import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
// Inter локально (06_DESIGN_TOKENS §3): текст 400, заголовки/крупные значения 600
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import { installUnauthorizedRedirect, router } from '@/app/router'
import { queryClient } from '@/api/queryClient'
import '@/styles/tokens.css'
import '@/styles/global.css'

// 401 из любого запроса → /login (02 §4)
installUnauthorizedRedirect(router)

// Мок (MSW): подключается только динамическими импортами внутри условия —
// в прод-сборке (VITE_USE_MOCK=false) ветка вырезается, кода мока в бандле нет
async function enableMock(): Promise<void> {
  // ?scenario= запоминаем ДО worker.start(): первая регистрация service-worker
  // перезагружает страницу, и SPA-переход успевает стереть query до перезагрузки
  const fromUrl = new URLSearchParams(window.location.search).get('scenario')
  if (fromUrl) {
    try {
      sessionStorage.setItem('agro-scada.mock.scenario', fromUrl)
    } catch {
      // ignore
    }
  }

  const { worker } = await import('@/mocks/browser')
  const { applyScenario, isScenario } = await import('@/mocks/scenarios')
  const { mountDebugPanel } = await import('@/mocks/mountDebugPanel')
  await worker.start({ onUnhandledFrame: 'bypass' })

  let stored: string | null = null
  try {
    stored = sessionStorage.getItem('agro-scada.mock.scenario')
  } catch {
    // ignore
  }
  applyScenario(isScenario(fromUrl) ? fromUrl : isScenario(stored) ? stored : 'normal')
  mountDebugPanel()
  // флаг для e2e: воркер активен и перехватывает запросы
  ;(window as unknown as Record<string, unknown>).__mockReady = true
}

if (import.meta.env.VITE_USE_MOCK === 'true') {
  void enableMock()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
