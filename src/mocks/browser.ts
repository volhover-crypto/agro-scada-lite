import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// Воркер мока для браузера (dev, VITE_USE_MOCK=true).
// В прод-сборку не попадает: подключается только динамическим импортом
// из main.tsx внутри условия VITE_USE_MOCK (09_INTEGRATION_CHECKLIST A1).
export const worker = setupWorker(...handlers)
