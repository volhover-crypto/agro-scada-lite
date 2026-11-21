import { createBrowserRouter, type DataRouter } from 'react-router'
import { setUnauthorizedHandler } from '@/api/client'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'

// 401 из API: сессия уже очищена клиентом — уводим на /login с возвратом
// на исходный путь (02 §4). DataRouter — тип экземпляра createBrowserRouter
export function installUnauthorizedRedirect(router: DataRouter): void {
  setUnauthorizedHandler((requestPath) => {
    void router.navigate('/login', { state: { from: requestPath }, replace: true })
  })
}

// basename — из base Vite (VITE_BASE_PATH), чтобы маршруты работали и под /dash/
export const router = createBrowserRouter(
  [
    { path: '/', element: <HomePage /> },
    { path: '/login', element: <LoginPage /> },
    // Витрина токенов — маршрут разработки, вне навигации (DECISIONS D-05)
    {
      path: '/dev/tokens',
      lazy: () => import('@/pages/dev/TokensPage').then((m) => ({ Component: m.TokensPage })),
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
)
