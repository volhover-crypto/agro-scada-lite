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
