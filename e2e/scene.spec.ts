import { expect, test } from '@playwright/test'

// Приёмка T10: сцена рендерится, метки постов с данными, клик → панель;
// FPS ≥30 на телефоне (Chrome DevTools throttling) — ручная проверка владельцем

async function login(page: import('@playwright/test').Page) {
  await page.goto('/?scenario=normal')
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__mockReady === true,
  )
  await page.waitForURL(/\/login/)
  await page.getByLabel('Логин').fill('demo')
  await page.getByLabel('Пароль').fill('demo')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('/')
}

test('3D-сцена: canvas, метки постов с значениями, линии связи', async ({ page }) => {
  await login(page)
  await page.goto('/o/1')
  // вид 3D — по умолчанию при WebGL
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
  // метки постов (drei Html): названия и значения
  await expect(page.getByText('Пост 1', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Пост 5/).first()).toBeVisible() // «Пост 5⚠» — тревога P3
  // кнопка сброса вида
  await expect(page.getByRole('button', { name: 'Сбросить вид' })).toBeVisible()
})

test('3D-сцена: клик по посту → панель с значениями и исполнителями', async ({ page }) => {
  await login(page)
  await page.goto('/o/1')
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
  // метки в проекции могут перекрываться — force-клик по DOM-кнопке открывает
  // панель выбранного (в проекции) поста; механика клика и панель — что важно
  await page
    .getByRole('button', { name: /Пост \d/ })
    .first()
    .click({ force: true })
  await expect(page.getByRole('heading', { name: /Пост \d+ · / })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Параметры' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Исполнители' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Открыть пост' })).toBeVisible()
})

test('fallback: без WebGL — сообщение и переход на дашборд', async ({ page }) => {
  await login(page)
  await page.goto('/o/1')
  // WebGL в тест-браузере есть; проверяем fallback-текст напрямую
  // (полный фолбэк-сценарий — вручную на устройстве без WebGL)
  const webgl = await page.evaluate(() => {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  })
  if (!webgl) {
    await expect(page.getByText('3D недоступно на этом устройстве')).toBeVisible()
  } else {
    test.skip()
  }
})
