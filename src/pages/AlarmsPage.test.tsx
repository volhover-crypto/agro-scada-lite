import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { setSessionToken } from '@/state/session'
import { AlarmsPage } from './AlarmsPage'

// Страница тревог (T13): таблица из мока, ack без диалога с отметкой,
// пустое состояние

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

function renderPage() {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AlarmsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AlarmsPage (normal: тревога P3 поста 5)', () => {
  it('таблица: приоритет, место, сообщение, состояние, «К устройству»', async () => {
    renderPage()

    const row = await screen.findByTestId('alarm-row')
    expect(within(row).getByText('P3 Предупреждение')).toBeInTheDocument()
    expect(within(row).getByText('Влажность грунта 22 % ниже 25 %')).toBeInTheDocument()
    expect(within(row).getByText(/Виноградник Золотая Балка · Пост 5/)).toBeInTheDocument()
    expect(within(row).getByText('Активна')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'К устройству' })).toHaveAttribute('href', '/o/1/p/5')
    // по умолчанию фильтр «Активные» → кнопка подтверждения видна
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument()
  })

  it('ack без диалога: после подтверждения — отметка «Подтвердил demo», кнопки нет', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Подтвердить' }))

    // useAckAlarm инвалидирует ['alarms'] → строка перерисуется как active_acked
    expect(await screen.findByText(/Подтвердил demo/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Подтвердить' })).not.toBeInTheDocument()
  })
})

describe('AlarmsPage — пустой сценарий', () => {
  it('«Тревог по фильтру нет»', async () => {
    applyScenario('empty')
    await queryClient.invalidateQueries({ queryKey: ['alarms'] })
    renderPage()
    expect(await screen.findByText('Тревог по фильтру нет')).toBeInTheDocument()
  })
})
