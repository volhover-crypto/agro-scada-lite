import { expect, test, type Page } from '@playwright/test'

// Приёмка T14 (05 §8): мастер 4 шага → «Утверждено»; правка утверждённого →
// предупреждение → «Ждёт утверждения»; OVERLAP при пересечении расписаний

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

test('правило: мастер 4 шага → Утвердить и включить → «Утверждено»; правка → предупреждение → «Ждёт утверждения»', async ({
  page,
}) => {
  await login(page)
  await page.goto('/rules')

  await page.getByRole('button', { name: 'Создать правило' }).click()
  const wizard = page.getByTestId('rule-wizard')

  // шаг 1: условие
  await wizard.getByLabel('Тег').selectOption({ index: 1 })
  await wizard.getByLabel('Значение').fill('25')
  await wizard.getByRole('button', { name: 'Далее' }).click()
  // шаг 2: действие
  await wizard.getByLabel('Команда').selectOption({ index: 1 })
  await wizard.getByRole('button', { name: 'Далее' }).click()
  // шаг 3: ограничения по умолчанию
  await wizard.getByRole('button', { name: 'Далее' }).click()
  // шаг 4: сводка + утверждение и включение
  await expect(wizard.getByTestId('rule-summary')).toContainText(/Если .+, то/)
  await wizard.getByLabel('Название правила').fill('Полив по утрам e2e')
  await wizard.getByRole('button', { name: 'Утвердить и включить' }).click()

  const newRow = page.getByTestId('rule-row').filter({ hasText: 'Полив по утрам e2e' })
  await expect(newRow).toBeVisible({ timeout: 10_000 })
  await expect(newRow).toContainText('Утверждено')

  // правка утверждённого: предупреждение + сброс в pending после сохранения
  await newRow.getByRole('button', { name: 'Изменить' }).click()
  await expect(page.getByTestId('edit-warning')).toContainText('потребует повторного утверждения')
  for (let i = 0; i < 3; i++) {
    await wizard.getByRole('button', { name: 'Далее' }).click()
  }
  await wizard.getByRole('button', { name: 'Сохранить' }).click()
  await expect(newRow).toContainText('Ждёт утверждения', { timeout: 10_000 })
})

test('расписание: создание с пересечением → жёлтое OVERLAP-предупреждение', async ({ page }) => {
  await login(page)
  await page.goto('/schedules')

  await page.getByRole('button', { name: 'Новое расписание' }).click()
  const form = page.getByTestId('schedule-form')
  // пересечение: seed-расписание «Клапан 1» — ежедневно; выбираем тот же выход
  await form.getByLabel('Команда').selectOption({ label: 'Клапан 1 · ВКЛЮЧИТЬ' })
  await form.getByLabel('Длительность (сек)').fill('900')
  await form.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByTestId('overlap-warning')).toContainText('Пересечение', {
    timeout: 10_000,
  })
})
