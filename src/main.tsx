import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
// Inter локально (06_DESIGN_TOKENS §3): текст 400, заголовки/крупные значения 600
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import { router } from '@/app/router'
import '@/styles/tokens.css'
import '@/styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
