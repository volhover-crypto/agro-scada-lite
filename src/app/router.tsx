/* eslint-disable react-refresh/only-export-components -- файл конфигурации роутера,
   не компонент-модуль для HMR */
import { Navigate, createBrowserRouter, type DataRouter } from 'react-router'
import { setUnauthorizedHandler } from '@/api/client'
import { Shell } from './layout/Shell'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { MorePage } from '@/pages/MorePage'
import { StubPage } from '@/pages/StubPage'
import { ru } from '@/i18n/ru'
import { useUiStore } from '@/state/ui'

// 401 из API: сессия уже очищена клиентом — уводим на /login с возвратом
// на исходный путь (02 §4). DataRouter — тип экземпляра createBrowserRouter
export function installUnauthorizedRedirect(router: DataRouter): void {
  setUnauthorizedHandler((requestPath) => {
    useUiStore.getState().setSimMode(false)
    void router.navigate('/login', { state: { from: requestPath }, replace: true })
  })
}

/** /o без id — к выбранному объекту (или первый раздел заглушек) */
function ObjectsRedirect() {
  const selected = useUiStore((st) => st.selectedObjectId)
  return <Navigate to={selected != null ? `/o/${selected}` : '/settings/objects'} replace />
}

// basename — из base Vite (VITE_BASE_PATH), чтобы маршруты работали и под /dash/
export const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      path: '/',
      element: <Shell />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'o', element: <ObjectsRedirect /> },
        {
          path: 'o/:objectId',
          lazy: () => import('@/pages/ObjectPage').then((m) => ({ Component: m.ObjectPage })),
        },
        {
          path: 'o/:objectId/p/:postId',
          lazy: () => import('@/pages/PostPage').then((m) => ({ Component: m.PostPage })),
        },
        { path: 'a/:actuatorId', element: <StubPage title="Устройство" task="T12" /> },
        { path: 'alarms', element: <StubPage title={ru.shell.navAlarms} task="T13" /> },
        {
          path: 'charts',
          lazy: () => import('@/pages/ChartsPage').then((m) => ({ Component: m.ChartsPage })),
        },
        { path: 'rules', element: <StubPage title={ru.shell.navRules} task="T14" /> },
        { path: 'schedules', element: <StubPage title={ru.shell.navSchedules} task="T14" /> },
        { path: 'audit', element: <StubPage title={ru.shell.navAudit} task="T15" /> },
        { path: 'settings/*', element: <StubPage title={ru.shell.navSettings} task="T16" /> },
        { path: 'more', element: <MorePage /> },
      ],
    },
    // Витрина токенов — маршрут разработки, вне навигации (DECISIONS D-05)
    {
      path: '/dev/tokens',
      lazy: () => import('@/pages/dev/TokensPage').then((m) => ({ Component: m.TokensPage })),
    },
    // Витрина виджетов (T07) — тоже dev-маршрут вне навигации
    {
      path: '/dev/widgets',
      lazy: () => import('@/pages/dev/WidgetsPage').then((m) => ({ Component: m.WidgetsPage })),
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
)
