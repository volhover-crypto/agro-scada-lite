/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// base — из VITE_BASE_PATH (02_ARCHITECTURE_FE §6): dev '/', прод '/dash/'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
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
    },
  }
})
