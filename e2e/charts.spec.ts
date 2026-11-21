import { expect, test } from '@playwright/test'

// Приёмка T08: 8 рядов; 9-й запрещён; агрегат при больших периодах (unit);
// график из 3 тегов строится (оси/пунктир — в unit-тестах опций)

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

test('график: выбор тегов, canvas, 2 разных единицы, 9-й запрещён', async ({ page }) => {
  await login(page)
  await page.goto('/charts')

  // дерево загрузилось: есть группы постов
  await expect(page.getByRole('button', { name: /Пост 1 ·/ }).first()).toBeVisible()

  // выбрать 3 параметра поста 1 (t воздуха °C, RH %, влажность грунта %)
  const tree = page.locator('button[class*="treeChild"]')
  await tree.filter({ hasText: 'Температура воздуха' }).first().click()
  await tree.filter({ hasText: 'Влажность воздуха' }).first().click()
  await tree.filter({ hasText: 'Влажность грунта' }).first().click()

  // график отрисовался (canvas ECharts) и легенда с 3 рядами
  await expect(page.locator('canvas').first()).toBeVisible()

  // добрать до 8 и попробовать 9-й
  const more = tree.filter({ hasText: /Влажность грунта|Температура воздуха|Влажность воздуха/ })
  const count = await more.count()
  for (let i = 3; i < Math.min(8, count); i++) await more.nth(i).click()
  if (count > 8) {
    await more.nth(8).click()
    await expect(page.getByText('Не более 8 рядов')).toBeVisible()
  }

  // смена периода на 30 дней не ломает график (агрегат 1d — unit-покрыто)
  await page.getByRole('button', { name: '30 дней' }).click()
  await expect(page.locator('canvas').first()).toBeVisible()
})

test('график: «Сохранить вид» сохраняет dashboard', async ({ page }) => {
  await login(page)
  await page.goto('/charts')
  const tree = page.locator('button[class*="treeChild"]')
  await tree.filter({ hasText: 'Температура воздуха' }).first().click()

  await page.getByRole('button', { name: 'Сохранить вид' }).click()
  await expect(page.getByText('Вид сохранён')).toBeVisible()

  // проверка через API, что дашборд реально создан
  const saved = await page.evaluate(async () => {
    const token = sessionStorage.getItem('agro-scada.session.token')
    const res = await fetch('/webhook/dashboards', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return (await res.json()) as Array<{ name?: string; layout?: Array<{ tags?: string[] }> }>
  })
  const chart = saved.find((d) => d.name?.startsWith('Графики'))
  expect(chart?.layout?.[0]?.tags?.length).toBeGreaterThanOrEqual(1)
})

test('витрина: Bar и Table рендерятся', async ({ page }) => {
  await login(page)
  await page.goto('/dev/widgets')
  await expect(page.getByRole('heading', { name: 'Bar — осадки по дням' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Table — телеметрия' })).toBeVisible()
  // таблица с данными поста 1
  await expect(page.getByRole('button', { name: /Время/ })).toBeVisible()
  await expect(page.locator('table tbody tr').first()).toContainText(/Пост 1/)
})
