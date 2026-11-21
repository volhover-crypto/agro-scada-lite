import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, delay, http } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { setSessionToken } from '@/state/session'
import { WidgetFrame } from './WidgetFrame'

// Состояния рамки: скелетон / ошибка + Повторить / нет данных (07 §1 п.3)

function mount(ui: React.ReactNode) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

beforeAll(async () => {
  server.listen({ onUnhandledFrame: 'error' })
  applyScenario('normal')
  const res = await fetch('/webhook/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'demo', password: 'demo' }),
  })
  const { token } = (await res.json()) as { token: string }
  setSessionToken(token, 'demo')
})

afterEach(() => {
  server.resetHandlers()
  queryClient.clear()
  applyScenario('normal')
})

afterAll(() => server.close())

const GOOD = {
  tag_id: 'T/1/0/1',
  name: 't',
  unit: '°C',
  value: 9.5,
  quality: 'good',
  kind: 'fact',
  origin: 'live',
  ts_measured: '2026-11-21T12:00:00+03:00',
  ts_received: '2026-11-21T12:00:01+03:00',
}

describe('WidgetFrame', () => {
  it('пока запрос идёт — скелетон, затем тело с данными', async () => {
    server.use(
      http.get('/webhook/tags/current', async () => {
        await delay(400)
        return HttpResponse.json([GOOD])
      }),
    )
    mount(
      <WidgetFrame title="Тест" tagIds={['T/1/0/1']}>
        {(values) => <span>значение: {String(values[0]!.value)}</span>}
      </WidgetFrame>,
    )
    expect(screen.getByTestId('widget-skeleton')).toBeInTheDocument()
    expect(await screen.findByText('значение: 9.5')).toBeInTheDocument()
    expect(screen.queryByTestId('widget-skeleton')).not.toBeInTheDocument()
  })

  it('ошибка API → «Не удалось загрузить» + Повторить возвращает данные', async () => {
    server.use(
      http.get('/webhook/tags/current', () =>
        HttpResponse.json({ error: { code: 'VALIDATION', message: 'x' } }, { status: 500 }),
      ),
    )
    mount(
      <WidgetFrame title="Тест" tagIds={['T/1/0/1']}>
        {(values) => <span>значение: {String(values[0]!.value)}</span>}
      </WidgetFrame>,
    )
    // React Query делает 1 retry с задержкой 1 с — таймаут с запасом
    expect(await screen.findByTestId('widget-error', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText('Не удалось загрузить')).toBeInTheDocument()

    server.use(http.get('/webhook/tags/current', () => HttpResponse.json([GOOD])))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Повторить' }))
    await waitFor(() => expect(screen.getByText('значение: 9.5')).toBeInTheDocument())
  })

  it('пустой ответ → «Нет данных»', async () => {
    server.use(http.get('/webhook/tags/current', () => HttpResponse.json([])))
    mount(
      <WidgetFrame title="Тест" tagIds={['T/1/0/1']}>
        {() => <span>не должно отрисоваться</span>}
      </WidgetFrame>,
    )
    expect(await screen.findByTestId('widget-empty')).toBeInTheDocument()
    expect(screen.getByText('Нет данных')).toBeInTheDocument()
  })
})
