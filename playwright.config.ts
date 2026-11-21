import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Мок — изменяемое состояние (счётчик rate-limit и т.п.): и тесты внутри
  // файла, и файлы идут строго по порядку (один воркер)
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    // Явный IPv4: дефолтный биндинг vite на 'localhost' даёт адресацию,
    // которую readiness-проба webServer на этой машине не видит
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
