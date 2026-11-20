import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest запущен без globals — автоочистку Testing Library подключаем сами
afterEach(cleanup)
