import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { setSessionToken } from '@/state/session'
import { CardWidget } from './Card'

// Card: значение с единицами + стрелка тренда по истории 24 ч (07 §2)

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
})

afterAll(() => server.close())

const VALUE = {
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

// растущая история 24 ч → стрелка ↑
const RISING = {
  tag_id: 'T/1/0/1',
  unit: '°C',
  points: Array.from({ length: 24 }, (_, h) => [
    `2026-11-21T${String(h).padStart(2, '0')}:00:00+03:00`,
    5 + h * 0.3,
    'good',
  ]),
}

describe('CardWidget', () => {
  it('показывает значение с запятой, единицы и стрелку роста', async () => {
    // заглушки ДО рендера: тега T/1/0/1 в seed нет, дефолтный ответ — пусто
    server.use(
      http.get('/webhook/tags/current', () => HttpResponse.json([VALUE])),
      http.get('/webhook/tags/history', () => HttpResponse.json([RISING])),
    )
    render(
      <QueryClientProvider client={queryClient}>
        <CardWidget title="t воздуха" tags={['T/1/0/1']} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('9,5 °C')).toBeInTheDocument()
    // история 24 ч грузится отдельным запросом — ждём стрелку
    expect(await screen.findByRole('img', { name: 'Растёт' })).toHaveTextContent('↑')
    expect(document.querySelector('svg[class*="sparkline"]')).not.toBeNull()
  })

  it('ошибка значения — перечёркнутый текст', async () => {
    server.use(
      http.get('/webhook/tags/current', () =>
        HttpResponse.json([{ ...VALUE, value: 147, quality: 'out_of_range' }]),
      ),
    )
    render(
      <QueryClientProvider client={queryClient}>
        <CardWidget title="t" tags={['T/1/0/1']} />
      </QueryClientProvider>,
    )
    // toHaveClass не принимает stringContaining — проверяем строку классов
    const el = await screen.findByText('147 °C')
    expect(el.className).toContain('valueBad')
  })
})
