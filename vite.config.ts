/// <reference types="vitest/config" />
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA (T17, 01_README §«Стек»): манифест, иконки, кэш оболочки.
// Офлайн-режим данных не требуется (01_README:27) — precache только статика,
// API-запросы кэшированию не подлежат. В dev SW не включается (devOptions off,
// по умолчанию) — воркеру MSW ничего не мешает; в прод-сборке мок вырезается.
const vitePWA = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg'],
  manifest: {
    name: 'Agro-SCADA Lite',
    short_name: 'Agro-SCADA',
    description: 'Мониторинг агро-объектов и управление исполнительными устройствами',
    lang: 'ru',
    theme_color: '#7A8B3A',
    background_color: '#EFE6D6',
    display: 'standalone',
    icons: [
      { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // оболочка = вся статика сборки (js/css/html/svg/png); API не кэшируем
    globPatterns: ['**/*.{js,css,html,svg,png}'],
  },
})

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
    plugins: [react(), vitePWA, ...(!useMock ? [stripMswWorker()] : [])],
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
