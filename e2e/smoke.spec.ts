import { expect, test } from '@playwright/test'

// Базовая проверка T01: приложение открывается и отдаёт заголовок
test('приложение открывается', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Agro-SCADA Lite' })).toBeVisible()
})

// Витрина токенов (T02)
test('витрина токенов открывается', async ({ page }) => {
  await page.goto('/dev/tokens')
  await expect(page.getByRole('heading', { level: 1, name: 'Витрина токенов' })).toBeVisible()
  await expect(page.getByText('P1 Авария')).toBeVisible()
})

// Мок-воркер живой: перехватывает fetch страницы (только dev, VITE_USE_MOCK=true)
test('мок отвечает в браузере', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__mockReady === true,
  )
  const noAuth = await page.evaluate(() => fetch('/webhook/objects').then((r) => r.status))
  expect(noAuth).toBe(401)
  const login = await page.evaluate(async () => {
    const res = await fetch('/webhook/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'demo', password: 'demo' }),
    })
    if (!res.ok) return { ok: false }
    const { token } = (await res.json()) as { token: string }
    const objects = await fetch('/webhook/objects', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return { ok: objects.ok, count: ((await objects.json()) as unknown[]).length }
  })
  expect(login).toEqual({ ok: true, count: 2 })
})
