import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { setSessionToken } from '@/state/session'
import { HomePage } from './HomePage'

// Обзор (T09): карточки объектов из мока
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

describe('HomePage (Обзор)', () => {
  it('показывает карточки обоих объектов', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Виноградник Золотая Балка')).toBeInTheDocument()
    expect(screen.getByText('Насосная-1')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Обзор' })).toBeInTheDocument()
  })
})
