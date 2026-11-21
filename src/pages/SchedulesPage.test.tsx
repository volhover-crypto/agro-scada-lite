import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { setSessionToken } from '@/state/session'
import { SchedulesPage } from './SchedulesPage'

// Расписания (T14): список из мока, создание, OVERLAP-предупреждение

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
        <SchedulesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SchedulesPage (normal: 06:00, Клапан 1, ежедневно)', () => {
  it('список: время, дни, команда, статус «Утверждено»', async () => {
    renderPage()

    const rows = await screen.findAllByTestId('schedule-row')
    const row = rows.find((r) => r.textContent?.includes('06:00'))!
    expect(row).toHaveTextContent('06:00')
    expect(row).toHaveTextContent('ежедневно')
    expect(row).toHaveTextContent('Клапан 1')
    expect(row).toHaveTextContent('Утверждено')
  })

  it('создание на то же устройство и дни → жёлтое OVERLAP-предупреждение', async () => {
    renderPage()
    await screen.findAllByTestId('schedule-row')

    await userEvent.click(screen.getByRole('button', { name: 'Новое расписание' }))
    const cmdSelect = screen.getByLabelText('Команда')
    // пересечение: любой день совпадает с seed-расписанием (ежедневно) того же выхода
    const valveOption = within(cmdSelect)
      .getAllByRole('option')
      .find((o) => o.textContent?.includes('Клапан 1'))
    await userEvent.selectOptions(cmdSelect, valveOption!)
    await userEvent.type(screen.getByLabelText('Длительность (сек)'), '900')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(await screen.findByTestId('overlap-warning')).toHaveTextContent(/Пересечение/)
    // новое расписание в списке ждёт утверждения
    const rows = await screen.findAllByTestId('schedule-row')
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })
})
