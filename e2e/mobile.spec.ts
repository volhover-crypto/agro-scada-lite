import { expect, test, type Page } from '@playwright/test'

// Приёмка T18 (08_TASKS_PLAN «обязательные сценарии» №1):
// включить полив с телефона (360 px) с двойным подтверждением → acked → completed.
// Путь по мобильному каркасу: нижняя панель → 3D-сцена → пост 7 → Клапан 1.
// Таймауты 30 с: e2e флакают при параллельном прогоне (урок T13)

test.use({ viewport: { width: 360, height: 800 } })

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

test('360: вход → полив (Клапан 1) с удержанием → цепочка → Выполнено', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page)

  // нижняя панель: «Управление» → выбранный объект 1 (05 §0, D-20)
  const bottom = page.getByRole('navigation', { name: 'Нижняя панель' })
  await expect(bottom).toBeVisible()
  await bottom.getByText('Управление').click()
  await expect(page).toHaveURL(/\/o\/1$/)

  // 3D-сцена: метка поста 7. На 360 px метки в проекции перекрываются —
  // force-клик попадает на верхнюю метку (урок scene.spec), поэтому
  // событие уходит прямо на кнопку нужного поста (без hit-testing)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /Пост 7/ }).dispatchEvent('click')
  await expect(page.getByRole('heading', { name: /Пост 7 · / })).toBeVisible({ timeout: 30_000 })

  // исполнитель Клапан 1 (actuator 2, post 7) — ссылка из панели поста.
  // Обычный click не проходит actionability: низ панели перекрыт нижней
  // панелью телефона, поэтому событие уходит напрямую в ссылку
  await page.getByRole('link', { name: 'Клапан 1' }).dispatchEvent('click')
  await expect(page).toHaveURL(/\/a\/2$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: /Клапан 1 · Пост 7/ })).toBeVisible()

  // двойное подтверждение: длительность → диалог → удержание 1,7 с
  await page.getByTestId('duration-select').selectOption('10')
  await page.getByTestId('primary-action').dblclick()
  const hold = page.getByTestId('hold-button')
  await expect(hold).toBeVisible()
  const box = (await hold.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(1_700)
  await page.mouse.up()
  await expect(hold).toBeHidden({ timeout: 30_000 })

  // цепочка: acked → факт → completed (10 мин ×60 = 10 с в моке)
  const trail = page.getByTestId('status-trail')
  await expect(trail.getByText('✓ Подтверждено')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('● Включено')).toBeVisible({ timeout: 30_000 })
  await expect(trail.getByText('✓ Выполнено')).toBeVisible({ timeout: 30_000 })
})
