import { expect, test, type Page } from '@playwright/test'

// Приёмка T12 (05 §5): цепочка статусов до «Выполнено» (normal), OFF без диалога,
// idempotency при двойном нажатии, timeout → Повторить (cmd_fail),
// MODEM_OFFLINE «команда ждёт до HH:MM» (link_loss)
// Времена мока (×60): queued→sent_gw 2 с, sent→ack 3 с, 10 мин → 10 с

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

/** Удержание кнопки подтверждения 1,7 с (реальные pointer-события) */
async function holdConfirm(page: Page) {
  const hold = page.getByTestId('hold-button')
  await expect(hold).toBeVisible()
  const box = (await hold.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(1_700)
  await page.mouse.up()
  await expect(hold).toBeHidden({ timeout: 5_000 })
}

async function select10min(page: Page) {
  await page.getByTestId('duration-select').selectOption('10')
}

test('normal, Клапан 1: включение с удержанием → цепочка → Выполнено; двойное нажатие — одна команда', async ({
  page,
}) => {
  await login(page)
  await page.goto('/a/2')

  await expect(page.getByRole('heading', { name: /Клапан 1 · Пост 7/ })).toBeVisible()
  await select10min(page)

  // двойное нажатие: второе игнорируется (кнопка блокируется / idempotency)
  await page.getByTestId('primary-action').dblclick()
  await holdConfirm(page)

  // цепочка: Ждёт подтверждения → В очереди → Передано шлюзом → Подтверждено
  const trail = page.getByTestId('status-trail')
  await expect(trail).toBeVisible()
  await expect(trail.getByText('В очереди')).toBeVisible({ timeout: 10_000 })
  await expect(trail.getByText('Передано шлюзом')).toBeVisible({ timeout: 10_000 })
  await expect(trail.getByText('✓ Подтверждено')).toBeVisible({ timeout: 10_000 })

  // факт включился; ВКЛЮЧИТЬ → ПРОДЛИТЬ; «до HH:MM (осталось …)»
  await expect(page.getByText('● Включено')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('primary-action')).toHaveText('ПРОДЛИТЬ')
  await expect(page.getByText(/до \d\d:\d\d \(осталось/)).toBeVisible()

  // 10 мин ×60 → 10 с до «Выполнено»
  await expect(trail.getByText('✓ Выполнено')).toBeVisible({ timeout: 25_000 })
})

test('normal, Клапан 1: ВЫКЛЮЧИТЬ — без диалога, факт гаснет', async ({ page }) => {
  await login(page)
  await page.goto('/a/2')

  await select10min(page)
  await page.getByTestId('primary-action').click()
  await holdConfirm(page)
  await expect(page.getByText('● Включено')).toBeVisible({ timeout: 30_000 })

  await page.getByTestId('secondary-action').click()
  // диалог подтверждения не появляется
  await expect(page.getByTestId('hold-button')).toBeHidden()
  // запас на параллельный прогон: цепочка off ~5-8 с + опрос факта
  await expect(page.getByText('● Выключено')).toBeVisible({ timeout: 30_000 })
})

test('cmd_fail: потеря ack → «Не подтверждено модемом» + Повторить', async ({ page }) => {
  await page.goto('/?scenario=cmd_fail')
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__mockReady === true,
  )
  await page.waitForURL(/\/login/)
  await page.getByLabel('Логин').fill('demo')
  await page.getByLabel('Пароль').fill('demo')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('/')
  await page.goto('/a/2')

  await select10min(page)
  await page.getByTestId('primary-action').click()
  await holdConfirm(page)

  const trail = page.getByTestId('status-trail')
  await expect(trail.getByText('Не подтверждено модемом')).toBeVisible({ timeout: 20_000 })
  // «Выполнено» не появляется — критическое правило
  await expect(trail.getByText('✓ Выполнено')).toBeHidden()

  // Повторить → новая команда (вновь диалог подтверждения)
  await trail.getByRole('button', { name: 'Повторить' }).click()
  await expect(page.getByTestId('hold-button')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: 'Отмена' }).click()
})

// FIX-4 (аудит §8.8): ошибка смены режима показывается у переключателя.
// Отказ имитируется тумблером панели отладки мока (04 §5): Playwright route
// не перехватывает запросы из service worker (MSW)
test('FIX-4: смена режима — ошибка сервера видна пользователю', async ({ page }) => {
  await page.goto('/?scenario=normal')
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__mockReady === true,
  )
  await page.waitForURL(/\/login/)
  await page.getByLabel('Логин').fill('demo')
  await page.getByLabel('Пароль').fill('demo')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('/')
  await page.goto('/a/2')

  await expect(page.getByRole('heading', { name: /Клапан 1 · Пост 7/ })).toBeVisible()
  // открыть панель отладки мока и включить сбой смены режима
  await page.getByRole('button', { name: '⚙ Мок' }).click()
  await page.getByRole('checkbox', { name: 'Ломать смену режима (423)' }).check()
  await page.getByRole('button', { name: '⚙ Мок' }).click() // свернуть панель

  await page.getByRole('button', { name: 'Ручной' }).click()
  await expect(page.getByTestId('mode-error')).toContainText('Режим заблокирован командой', {
    timeout: 10_000,
  })
})

test('link_loss, Клапан 4: модем offline — предупреждение «команда ждёт до HH:MM»', async ({
  page,
}) => {
  await page.goto('/?scenario=link_loss')
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__mockReady === true,
  )
  await page.waitForURL(/\/login/)
  await page.getByLabel('Логин').fill('demo')
  await page.getByLabel('Пароль').fill('demo')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('/')
  await page.goto('/a/7')

  await expect(page.getByRole('heading', { name: /Клапан 4 · Пост 4/ })).toBeVisible()
  await page.getByTestId('primary-action').click()
  await holdConfirm(page)

  await expect(page.getByTestId('modem-offline-warning')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('modem-offline-warning')).toHaveText(/ждёт до \d\d:\d\d/)
})
