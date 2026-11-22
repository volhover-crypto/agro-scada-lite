import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { setSessionToken } from '@/state/session'
import { AuditPage } from './AuditPage'

// Журнал (T15): лента из мока, человекочитаемые события, было/стало, фильтры

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
        <AuditPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AuditPage (normal: seed-записи owner)', () => {
  it('лента: время, кто, событие словами, объект; раскрытие было/стало', async () => {
    renderPage()

    const rows = await screen.findAllByTestId('audit-row')
    expect(rows.length).toBeGreaterThanOrEqual(3)
    // событие человекочитаемо (rule.approved → текст)
    expect(screen.getAllByText('Правило утверждено').length).toBeGreaterThan(0)
    // «Кто» — seed-записи от owner (живые события — demo, порядок новизны)
    expect(screen.getAllByText('owner').length).toBeGreaterThan(0)
    // раскрытие было/стало по кнопке
    const expandBtn = rows[0]!.querySelector('button')
    if (expandBtn) {
      await userEvent.click(expandBtn)
      expect(screen.getByTestId('audit-diff')).toBeInTheDocument()
      expect(screen.getByText(/Было:/)).toBeInTheDocument()
      expect(screen.getByText(/Стало:/)).toBeInTheDocument()
    }
  })

  it('фильтр по сущности: alarm → пусто (в normal тревог в журнале нет)', async () => {
    renderPage()
    await screen.findAllByTestId('audit-row')

    await userEvent.selectOptions(screen.getByLabelText('Сущность'), 'alarm')
    expect(await screen.findByText('Записей по фильтру нет')).toBeInTheDocument()
  })

  it('фильтр по автору: owner → только seed-записи', async () => {
    renderPage()
    await screen.findAllByTestId('audit-row')

    await userEvent.type(screen.getByLabelText('Автор'), 'owner')
    // server-side фильтр: все строки от owner
    const rows = await screen.findAllByTestId('audit-row')
    for (const r of rows) {
      expect(within(r).getByText('owner')).toBeInTheDocument()
    }
  })
})
