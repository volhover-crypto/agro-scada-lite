import { expect, test, type Page } from '@playwright/test'

// Приёмка T13 (05 §6): таблица/фильтры, ack с отметкой, шаг эскалации
// в pressure_drop (тревога ~20 с, шаг 1 ~40 с, шаг 2 ~60 с после старта сценария)

async function login(page: Page) {
  await page.goto('/?scenario=pressure_drop')
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__mockReady === true,
  )
  await page.waitForURL(/\/login/)
  await page.getByLabel('Логин').fill('demo')
  await page.getByLabel('Пароль').fill('demo')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('/')
}

test('pressure_drop: тревога P1, шаг эскалации, ack с отметкой, фильтры', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page)
  await page.goto('/alarms')

  // тревога P1 появляется через ~20 с сценария (seed-тревога P3 не считается)
  const row = page.getByTestId('alarm-row').filter({ hasText: 'Давление 1,2' })
  await expect(row).toBeVisible({ timeout: 60_000 })
  await expect(row).toContainText('P1 Авария')
  await expect(row).toContainText('Насосная-1 · Пост 13')

  // эскалация: шаг 1 ~40 с, шаг 2 ~60 с — ждём любой ненулевой шаг
  await expect(row).toContainText(/Шаг \d/, { timeout: 60_000 })

  // ack без диалога → отметка «Подтвердил demo»
  await row.getByRole('button', { name: 'Подтвердить' }).click()
  await expect(row).toContainText(/Подтвердил demo/, { timeout: 10_000 })
  await expect(row).toContainText('Подтверждена')

  // фильтры: «Неподтверждённые» скрывает подтверждённую (seed P3 остаётся), «Все» показывает
  await page.getByRole('button', { name: 'Неподтверждённые' }).click()
  await expect(page.getByTestId('alarm-row').filter({ hasText: 'Давление 1,2' })).toBeHidden()
  await page.getByRole('button', { name: 'Все' }).click()
  await expect(row).toContainText('Подтверждена')

  // «К устройству» ведёт на страницу поста (в «Все» две строки — берём P1)
  await row.getByRole('link', { name: 'К устройству' }).click()
  await expect(page).toHaveURL(/\/o\/2\/p\/13$/)
})
