/// <reference types="vitest/config" />
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Прод-сборка без мока: файл воркера MSW не должен попадать в dist
// (09_INTEGRATION_CHECKLIST A1: поиск по dist не находит MSW)
function stripMswWorker(): Plugin {
  return {
    name: 'strip-msw-worker',
    closeBundle() {
      rmSync(resolve(import.meta.dirname, 'dist/mockServiceWorker.js'), { force: true })
    },
  }
}

// base — из VITE_BASE_PATH (02_ARCHITECTURE_FE §6): dev '/', прод '/dash/'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useMock = env.VITE_USE_MOCK === 'true'
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), ...(!useMock ? [stripMswWorker()] : [])],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      // e2e — территория Playwright (npm run e2e), Vitest их не трогает
      exclude: ['e2e', '**/node_modules/**', '**/dist/**'],
      // мок — изменяемый синглтон: тест-файлы гоняем последовательно
      fileParallelism: false,
    },
  }
})
