import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { components } from '@/api/types.gen'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { setSessionToken } from '@/state/session'
import { bsLabel, batteryText, PostPage, soilTagsOf } from './PostPage'

// EChartCanvas в jsdom падает (нет canvas-контекста, zrender) — стаб;
// реальный график проверяется в e2e/post.spec.ts
vi.mock('@/widgets/EChartCanvas', () => ({
  EChartCanvas: () => <div data-testid="echart-stub" />,
}))

/*
 * Страница поста (T11): чистые хелперы + рендер поста 13 (путь подсказки
 * soil3d — без WebGL-канваса; канвас проверяется в e2e/post.spec.ts).
 */

type ChannelT = components['schemas']['Channel']

beforeAll(async () => {
  server.listen({ onUnhandledFrame: 'error' })
  applyScenario('normal')
  const res = await fetch('/webhook/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'demo', password: 'demo' }),
  })
  setSessionToken(((await res.json()) as { token: string }).token, 'demo')
})

afterAll(() => {
  queryClient.clear()
  server.close()
})

describe('batteryText / bsLabel', () => {
  it('мВ → В (ru-локаль), null — прочерк, ключ БС', () => {
    expect(batteryText(12300)).toBe('12,3 В')
    expect(batteryText(null)).toBe('—')
    expect(bsLabel('bs1')).toBe('БС-1')
    expect(bsLabel('bs2')).toBe('БС-2')
  })
})

describe('soilTagsOf — грунтовые каналы по коду (07 §3.2)', () => {
  const channels = [
    { tag_id: 'a/3/-10/1', param_code: 0x03, level_cm: -10, unit: '%' },
    { tag_id: 'a/3/-30/1', param_code: 0x03, level_cm: -30, unit: '%' },
    { tag_id: 'a/4/-10/1', param_code: 0x04, level_cm: -10, unit: '°C' },
    { tag_id: 'a/1/150/1', param_code: 0x01, level_cm: 150, unit: '°C' },
    { tag_id: 'a/3/-60/1', param_code: 0x03, level_cm: -60, unit: '%' }, // не привязан к посту
  ] as unknown as ChannelT[]
  const bound = new Set(['a/3/-10/1', 'a/3/-30/1', 'a/4/-10/1', 'a/1/150/1'])

  it('влажность — только отрицательные глубины поста, по возрастанию', () => {
    expect(soilTagsOf(channels, bound, 0x03)).toEqual([
      { tagId: 'a/3/-10/1', depthCm: 10, unit: '%' },
      { tagId: 'a/3/-30/1', depthCm: 30, unit: '%' },
    ])
  })

  it('температура грунта — свой код', () => {
    expect(soilTagsOf(channels, bound, 0x04)).toEqual([
      { tagId: 'a/4/-10/1', depthCm: 10, unit: '°C' },
    ])
  })
})

describe('PostPage — пост Н1 (пост 13, без грунтовых датчиков)', () => {
  it('шапка, подсказка soil3d, исполнитель, тревоги пусты', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/o/2/p/13']}>
          <Routes>
            <Route path="/o/:objectId/p/:postId" element={<PostPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('heading', { name: 'Пост Н1' })).toBeInTheDocument()
    expect(screen.getByText('Машинный зал')).toBeInTheDocument()

    // шапка модема (05 §4): батарея (класс C — null → —), SNR, RSSI, связь
    expect(await screen.findByTestId('modem-card')).toBeInTheDocument()
    expect(screen.getByText(/ТОЧКА-13/)).toBeInTheDocument()

    // < 2 глубин → подсказка вместо разреза
    expect(await screen.findByTestId('soil-hint')).toBeInTheDocument()

    // исполнитель поста 13 — Насос 1
    expect(await screen.findByText('Насос 1')).toBeInTheDocument()

    expect(screen.getByText('Активных тревог нет')).toBeInTheDocument()
  })
})
