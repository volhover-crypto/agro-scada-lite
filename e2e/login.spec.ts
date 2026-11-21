import { expect, test } from '@playwright/test'

// Приёмка T05 вживую на моке. ?scenario=normal сбрасывает стор мока
// (перезагрузка страницы заново применяет сценарий), чтобы счётчик
// rate-limit не протекал между прогонами.

test.beforeEach(async ({ page }) => {
  await page.goto('/?scenario=normal')
  // ждать активации service-worker мока, иначе POST уйдёт в vite (404)
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__mockReady === true,
  )
})

test('вход demo/demo ведёт в приложение', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Логин').fill('demo')
  await page.getByLabel('Пароль').fill('demo')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Agro-SCADA Lite' })).toBeVisible()
})

test('неверные данные — сообщение об ошибке', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Логин').fill('demo')
  await page.getByLabel('Пароль').fill('nope')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('alert')).toHaveText('Неверный логин или пароль')
})

test('после 5 неудач — RATE_LIMIT', async ({ page }) => {
  await page.goto('/login')
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('Логин').fill('demo')
    await page.getByLabel('Пароль').fill('nope')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page.getByRole('alert')).toHaveText('Неверный логин или пароль')
  }
  await page.getByLabel('Пароль').fill('demo')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('alert')).toHaveText('Слишком много попыток, повторите через минуту')
})
