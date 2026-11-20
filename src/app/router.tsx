import { createBrowserRouter } from 'react-router'
import { HomePage } from '@/pages/HomePage'

// basename — из base Vite (VITE_BASE_PATH), чтобы маршруты работали и под /dash/
export const router = createBrowserRouter([{ path: '/', element: <HomePage /> }], {
  basename: import.meta.env.BASE_URL,
})
