import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { store } from '@/mocks/store'
import { applyScenario } from '@/mocks/scenarios'
import { setSessionToken } from '@/state/session'
import { AlarmBanner } from './AlarmBanner'

// Баннер P1: показывается для active_unacked, исчезает после подтверждения

const p1 = {
  id: 2,
  alarm_def_id: 2,
  type: 'modem_immediate' as const,
  priority: 1,
  object_id: 2,
  post_id: 13,
  message: 'Давление 1,2 бар ниже 1,5',
  state: 'active_unacked' as const,
  value: 1.2,
  raised_at: '2026-11-21T09:14:00+03:00',
  acked_by: null,
  acked_at: null,
  cleared_at: null,
  escalation_step: 0,
}

function mount() {
  const router = createMemoryRouter([{ path: '/', element: <AlarmBanner /> }])
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeAll(async () => {
  server.listen({ onUnhandledFrame: 'error' })
  applyScenario('normal')
  // настоящий токен мока: ack-запрос должен пройти авторизацию
  const res = await fetch('/webhook/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'demo', password: 'demo' }),
  })
  const { token } = (await res.json()) as { token: string }
  setSessionToken(token, 'demo')
})

afterEach(() => {
  queryClient.clear()
  applyScenario('normal')
})

afterAll(() => server.close())

describe('AlarmBanner', () => {
  it('показывает P1 active_unacked с объектом и временем', async () => {
    queryClient.setQueryData(['objects'], [{ id: 2, name: 'Насосная-1', tz: 'Europe/Moscow' }])
    queryClient.setQueryData(['alarms'], [p1])
    mount()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Давление 1,2 бар ниже 1,5')
    expect(alert).toHaveTextContent('Насосная-1')
    expect(alert).toHaveTextContent('09:14')
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument()
  })

  it('после «Подтвердить» баннер исчезает', async () => {
    const user = userEvent.setup()
    // P1 есть и в моке: ack вернёт 200, повторный /alarms — уже без active_unacked
    applyScenario('normal')
    store.seed.alarms.push({ ...p1 })
    queryClient.setQueryData(['alarms'], [p1])
    queryClient.setQueryData(['objects'], [{ id: 2, name: 'Насосная-1' }])
    mount()

    await user.click(await screen.findByRole('button', { name: 'Подтвердить' }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('нет P1 — баннера нет', () => {
    queryClient.setQueryData(['alarms'], [{ ...p1, id: 3, priority: 3, state: 'active_unacked' }])
    mount()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
