import { expect, test } from '@playwright/test'

// Приёмка T07: все статусы качества в сценарии quality (04 §7.5, 07 §5.1)

test('в quality все статусы качества видны на виджетах', async ({ page }) => {
  await page.goto('/?scenario=quality')
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__mockReady === true,
  )
  await page.waitForURL(/\/login/)
  await page.getByLabel('Логин').fill('demo')
  await page.getByLabel('Пароль').fill('demo')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('/')
  await page.goto('/dev/widgets')
  await expect(page.getByRole('heading', { level: 1, name: 'Витрина виджетов' })).toBeVisible()

  // stale: «обновлено N мин назад»
  await expect(page.getByText(/обновлено \d+ мин назад/).first()).toBeVisible()
  // offline: крест + текст
  await expect(page.getByText(/✕ нет связи/).first()).toBeVisible()
  // out_of_range
  await expect(page.getByText('вне диапазона').first()).toBeVisible()
  // sensor_error
  await expect(page.getByText('ошибка датчика').first()).toBeVisible()
  // sim: бейдж ТЕСТ (в шапке и на виджетах)
  await expect(page.getByText('ТЕСТ').first()).toBeVisible()
  // перечёркнутое значение out_of_range (147 %)
  await expect(page.getByText('147 %').first()).toBeVisible()
  // sensor_error → прочерк
  await expect(page.getByText('— %').first()).toBeVisible()
})

test('в normal виджеты показывают значения', async ({ page }) => {
  await page.goto('/?scenario=normal')
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__mockReady === true,
  )
  await page.waitForURL(/\/login/)
  await page.getByLabel('Логин').fill('demo')
  await page.getByLabel('Пароль').fill('demo')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('/')
  await page.goto('/dev/widgets')
  // числовые значения Card и Gauge присутствуют
  await expect(page.locator('[class*="cardValue"]').first()).toContainText(/\d/)
  // стрелка gauge отрисовалась (SVG с needle-группой)
  await expect(page.locator('[class*="gaugeNeedle"]').first()).toBeAttached()
})
