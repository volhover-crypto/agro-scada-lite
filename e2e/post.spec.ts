import { expect, test, type Page } from '@playwright/test'

// Приёмка T11: страница поста (05 §4) — шапка модема, значения, график 24 ч,
// исполнители; Soil3D (07 §3.2) — разрез, ползунок времени, подсказка <2 глубин.
// Температурный режим заливки в моке недостижим (нет ≥2 датчиков температуры
// на одном посту, 04 §1: каналов 3–5) — логика цвета покрыта unit-тестами
// profileColor; переключатель проверен на недоступность с подсказкой.

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

/** Канвас разреза почвы (регион «Разрез почвы») */
function soilCanvas(page: Page) {
  return page.getByRole('region', { name: 'Разрез почвы' }).locator('canvas')
}

test('пост 1: шапка модема, значения, soil3d, график, исполнители', async ({ page }) => {
  await login(page)
  await page.goto('/o/1/p/1')

  // шапка: название и участок
  await expect(page.getByRole('heading', { name: 'Пост 1' })).toBeVisible()
  await expect(page.getByText('Участок А').first()).toBeVisible()

  // шапка модема: батарея в В, запас SNR в дБ, RSSI по БС, последняя связь
  const modem = page.getByTestId('modem-card')
  await expect(modem).toBeVisible()
  await expect(modem.getByText(/\d,\d В/)).toBeVisible()
  await expect(modem.getByText(/\d\d?,\d дБ/)).toBeVisible()
  await expect(modem.getByText(/БС-1: -\d+ дБм/)).toBeVisible()
  await expect(modem.getByText(/Последняя связь/)).toBeVisible()

  // soil3d: разрез с подписями датчиков (значения — ru-локаль)
  await expect(soilCanvas(page)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/−10 см · \d+(,\d+)? %/)).toBeVisible()
  await expect(page.getByText(/−30 см · \d+(,\d+)? %/)).toBeVisible()

  // график 24 ч: echarts-канвас в блоке (заголовок совпадает с h2 секции)
  await expect(page.getByRole('heading', { name: 'График 24 ч' }).first()).toBeVisible()
  await expect(page.locator('canvas').nth(1)).toBeVisible({ timeout: 15_000 })

  // исполнители: у поста 1 их нет (клапаны — на постах 7/8, насос — на 13)
  await expect(page.getByRole('heading', { name: 'Исполнители' })).toBeVisible()
  await expect(page.getByText('Исполнителей на посту нет')).toBeVisible()
})

test('пост 7: исполнители — мини-панели клапанов со ссылкой на устройство', async ({ page }) => {
  await login(page)
  await page.goto('/o/1/p/7')

  await expect(page.getByRole('link', { name: 'Клапан 1' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Клапан 2' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Открыть устройство' }).first()).toBeVisible()
  // класс C — батарея не показывается, прочерк
  await expect(page.getByTestId('modem-card').getByText('—').first()).toBeVisible()
})

test('soil3d: ползунок времени меняет профиль, период 7 д', async ({ page }) => {
  await login(page)
  await page.goto('/o/1/p/1')

  await expect(soilCanvas(page)).toBeVisible({ timeout: 15_000 })

  // начальная метка времени 24 ч — «ЧЧ:ММ»
  const time = page.getByTestId('soil-time')
  await expect(time).toHaveText(/^\d\d:\d\d$/)
  const before = await time.textContent()

  // ползунок в конец → время меняется (профиль перестраивается на тот же момент)
  const slider = page.getByRole('slider', { name: 'Время' })
  await slider.fill('90')
  await expect(time).not.toHaveText(before ?? '')

  // период 7 д: метка времени с датой «ДД.ММ ЧЧ:ММ»
  await page.getByRole('button', { name: '7 д' }).click()
  await expect(time).toHaveText(/^\d\d\.\d\d \d\d:\d\d$/)

  // воспроизведение: кнопка переключается на «Пауза» и обратно
  await page.getByRole('button', { name: 'Воспроизвести' }).click()
  await expect(page.getByRole('button', { name: 'Пауза' })).toBeVisible()

  // температурный режим: в моке у поста 1 один датчик температуры — недоступен
  const tempBtn = page.getByRole('button', { name: 'Температура' })
  await expect(tempBtn).toBeDisabled()
  await expect(tempBtn).toHaveAttribute('title', /≥ 2 датчиков температуры/)
})

test('пост Н1: нет грунтовых датчиков — подсказка вместо разреза', async ({ page }) => {
  await login(page)
  await page.goto('/o/2/p/13')

  await expect(page.getByRole('heading', { name: 'Пост Н1' })).toBeVisible()
  await expect(page.getByTestId('soil-hint')).toHaveText(
    'Для профиля нужно ≥ 2 датчиков на разных глубинах',
  )

  // у насосной класс C: батарея — прочерк; исполнитель — Насос 1
  await expect(page.getByTestId('modem-card').getByText('—').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Насос 1' })).toBeVisible()
})
