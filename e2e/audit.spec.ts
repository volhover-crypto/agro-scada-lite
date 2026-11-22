import { expect, test, type Page } from '@playwright/test'

// Приёмка T15 (05 §9): лента журнала, человекочитаемые события, фильтры,
// было/стало, пагинация (кнопки; >100 записей в моке не набирается —
// логика страниц покрыта unit-тестами hasNextPage)

async function login(page: Page) {
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

test('журнал: лента, событие словами, фильтр по сущности, было/стало', async ({ page }) => {
  await login(page)

  // генерируем запись в журнале: включить/выключить клапан (команда → статусы)
  await page.goto('/a/2')
  await page.getByTestId('primary-action').click()
  const hold = page.getByTestId('hold-button')
  const box = (await hold.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(1_700)
  await page.mouse.up()
  await expect(page.getByTestId('status-trail')).toContainText('В очереди', { timeout: 10_000 })

  // далее — только клиентская навигация: goto() создаёт новый документ и
  // сбрасывает мок-стор (D-25), записи журнала пропали бы
  await page.getByRole('link', { name: 'Журнал' }).click()
  await expect(page).toHaveURL(/\/audit$/)
  const rows = page.getByTestId('audit-row')
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })

  // событие человекочитаемо; свежая командная запись — от demo
  await expect(rows.first()).toContainText('demo', { timeout: 10_000 })

  // фильтр по сущности: rule → записи правил
  await page.getByLabel('Сущность').selectOption('rule')
  await expect(rows.first()).toContainText('Правило')

  // фильтр по периоду: будущая дата → пусто
  await page.getByLabel('Сущность').selectOption('')
  await page.getByLabel('С', { exact: true }).fill('2027-01-01')
  await expect(page.getByText('Записей по фильтру нет')).toBeVisible({ timeout: 10_000 })
  await page.getByLabel('С', { exact: true }).fill('')
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })

  // пагинация: записей < 100 — «Вперёд» недоступна
  await expect(page.getByRole('button', { name: 'Вперёд →' })).toBeDisabled()
})
