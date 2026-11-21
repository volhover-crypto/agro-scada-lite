import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Тот же набор обработчиков для Vitest (msw/node)
export const server = setupServer(...handlers)
