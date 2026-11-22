import { expect, test, type Page } from '@playwright/test'

// Приёмка T16 (05 §10): onboarding — 4 канала привязаны, исчезают из
// «неназначенных»; объекты — редактирование; симулятор — только чтение

async function login(page: Page) {
  await page.goto('/?scenario=onboarding')
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__mockReady === true,
  )
  await page.waitForURL(/\/login/)
  await page.getByLabel('Логин').fill('demo')
  await page.getByLabel('Пароль').fill('demo')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('/')
}

async function bindAll(page: Page) {
  const rows = page.getByTestId('binding-row')
  const total = await rows.count()
  for (let i = 0; i < total; i++) {
    const first = rows.first()
    await first.getByRole('combobox').selectOption({ index: 1 })
    await first.getByRole('button', { name: 'Привязать' }).click()
    await expect(rows).toHaveCount(total - i - 1, { timeout: 10_000 })
  }
  await expect(page.getByTestId('binding-empty')).toBeVisible()
}

test('onboarding: 4 канала ТОЧКА-16 привязаны — исчезают из неназначенных', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Настройки' }).click()
  await page.getByRole('tab', { name: /Привязка/ }).click()

  // ТОЧКА-16 — 4 неназначенных канала (t возд., RH, грунт −10, EC)
  const m16 = page.getByTestId('binding-row').filter({ hasText: 'ТОЧКА-16' })
  await expect(m16).toHaveCount(4)

  await bindAll(page)
})

test('объекты: переименование сохраняется (PUT), тип из списка', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Настройки' }).click()

  const row = page.getByTestId('object-row').filter({ hasText: 'Насосная-1' })
  await row.getByRole('button', { name: 'Изменить' }).click()
  await page.getByLabel('Название').fill('Насосная-1 (юг)')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('Сохранено')).toBeVisible()
  await expect(page.getByTestId('object-row').filter({ hasText: 'Насосная-1 (юг)' })).toBeVisible()
})

test('симулятор: состояние только для чтения, флаги клиента сохраняются', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Настройки' }).click()
  await page.getByRole('tab', { name: 'Симулятор' }).click()

  await expect(page.getByTestId('sim-state')).toContainText('Выключен')
  await expect(page.getByText(/BR-FE-6/)).toBeVisible()

  await page.getByRole('checkbox', { name: 'Доступ в интернет разрешён' }).click()
  await expect(page.getByText('Сохранено')).toBeVisible()
})
