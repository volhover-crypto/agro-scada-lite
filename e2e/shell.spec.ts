import { expect, test } from '@playwright/test'

// Приёмка T06: каркас на 1920 и 360, баннер P1 в pressure_drop, метка «ТЕСТ»

async function login(page: import('@playwright/test').Page) {
  // ждать активации service-worker мока на уже открытой странице (гонка POST→vite 404)
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__mockReady === true,
  )
  // без токена каркас приводит на /login клиентски; ждём перехода —
  // полный goto('/login') перезагрузил бы страницу и сбросил ?scenario= в normal
  await page.waitForURL(/\/login/)
  await page.getByLabel('Логин').fill('demo')
  await page.getByLabel('Пароль').fill('demo')
  await page.getByRole('button', { name: 'Войти' }).click()
}

test.describe.configure({ mode: 'serial' })

test('каркас на десктопе 1920: меню, шапка, выбор объекта', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?scenario=normal')
  await login(page)

  await expect(page.getByRole('navigation', { name: 'Основное меню' })).toBeVisible()
  for (const label of [
    'Обзор',
    'Объекты',
    'Тревоги',
    'Графики',
    'Правила',
    'Расписания',
    'Журнал',
    'Настройки',
  ]) {
    await expect(
      page.getByRole('navigation', { name: 'Основное меню' }).getByText(label),
    ).toBeVisible()
  }
  await expect(page.getByRole('combobox', { name: 'Объекты' })).toHaveValue('1')
  await expect(page.getByText('demo')).toBeVisible()
})

test('каркас на телефоне 360: нижняя панель, меню скрыто', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/?scenario=normal')
  await login(page)

  const bottom = page.getByRole('navigation', { name: 'Нижняя панель' })
  await expect(bottom).toBeVisible()
  for (const label of ['Обзор', 'Тревоги', 'Управление', 'Ещё']) {
    await expect(bottom.getByText(label)).toBeVisible()
  }
  await expect(page.getByRole('navigation', { name: 'Основное меню' })).toBeHidden()
})

test('метка «ТЕСТ» при sim_mode (quality)', async ({ page }) => {
  await page.goto('/?scenario=quality')
  await login(page)
  // появляется после первого опроса /updates
  await expect(page.getByTitle('Режим симулятора: данные тестовые')).toHaveText('ТЕСТ')
})

test('баннер P1 в pressure_drop: появляется, «Открыть» ведёт к объекту', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/?scenario=pressure_drop')
  await login(page)

  const banner = page.getByRole('alert')
  // тревога поднимается через ~20 с после старта сценария, поллер подхватит
  await expect(banner).toContainText('Давление 1,2 бар ниже 1,5', { timeout: 60_000 })
  await expect(banner).toContainText('Насосная-1')

  await banner.getByRole('button', { name: 'Открыть' }).click()
  await expect(page).toHaveURL(/\/o\/2$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Объекты' })).toBeVisible()
})
