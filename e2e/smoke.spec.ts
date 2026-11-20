import { expect, test } from '@playwright/test'

// Базовая проверка T01: приложение открывается и отдаёт заголовок
test('приложение открывается', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Agro-SCADA Lite' })).toBeVisible()
})
