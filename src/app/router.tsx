import { createBrowserRouter } from 'react-router'
import { HomePage } from '@/pages/HomePage'

// basename — из base Vite (VITE_BASE_PATH), чтобы маршруты работали и под /dash/
export const router = createBrowserRouter(
  [
    { path: '/', element: <HomePage /> },
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
