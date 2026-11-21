import { expect, test } from '@playwright/test'

// Приёмка T09: сохранение layout через API; на телефоне — только порядок

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

test('обзор: карточки объектов с постами и типом', async ({ page }) => {
  await login(page)
  await expect(page.getByTestId('object-card-1')).toContainText('Виноградник Золотая Балка')
  await expect(page.getByTestId('object-card-1')).toContainText('Виноградник')
  await expect(page.getByTestId('object-card-1')).toContainText(/из 12 постов онлайн/)
  await expect(page.getByTestId('object-card-2')).toContainText('Насосная-1')
})

test('объект: дашборд из seed-layoutа рендерит виджеты', async ({ page }) => {
  await login(page)
  await page.goto('/o/1')
  // вид по умолчанию 3D при WebGL → переключаемся на дашборд
  await page.getByRole('tab', { name: 'Дашборд' }).click()
  // виджеты из seed: заголовки конфигов
  await expect(page.getByText('Температура воздуха').first()).toBeVisible()
  await expect(page.getByText('Влажность грунта, Пост 5').first()).toBeVisible()
})

test('объект: конструктор добавляет виджет и сохраняет layout через API', async ({ page }) => {
  await login(page)
  await page.goto('/o/1')
  await page.getByRole('tab', { name: 'Дашборд' }).click()
  await page.getByRole('button', { name: 'Редактировать' }).click()

  // добавить виджет-лампу с порогом
  await page.getByLabel('Вид виджета').selectOption({ label: 'Лампа' })
  await page.getByLabel('Теги (до 8)').selectOption({ index: 0 })
  await page.getByLabel('Заголовок').fill('Тестовая лампа')
  await page.getByLabel('Порог').fill('25')
  await page.getByRole('button', { name: 'Добавить виджет' }).click()
  await expect(page.getByText('Тестовая лампа').first()).toBeVisible()

  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Редактировать' })).toBeVisible()

  // layout сохранился: перезагрузка страницы → виджет на месте
  await page.reload()
  await page.getByRole('tab', { name: 'Дашборд' }).click()
  await expect(page.getByText('Тестовая лампа').first()).toBeVisible()
})

test('объект: карта с маркерами постов', async ({ page }) => {
  await login(page)
  await page.goto('/o/1')
  await page.getByRole('tab', { name: 'Карта' }).click()
  // Leaflet контейнер и тайлы OSM
  await expect(page.locator('.leaflet-container')).toBeVisible()
  // 12 маркеров виноградника (цветные divIcon)
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(12)
})

test('телефон 360: виджеты в одну колонку (только порядок)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await login(page)
  await page.goto('/o/1')
  await page.getByRole('tab', { name: 'Дашборд' }).click()
  // ячейки одной ширины (1 колонка); матч только _cell_, не _cellTitle_
  const widths = await page
    .locator('[class*="_cell_"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).getBoundingClientRect().width))
  expect(widths.length).toBeGreaterThan(0)
  const first = widths[0]!
  for (const w of widths) expect(Math.abs(w - first)).toBeLessThan(2)
})
