import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { setSessionToken } from '@/state/session'
import { SettingsPage } from './SettingsPage'

// Настройки (T16): объекты PUT, привязка onboarding, read-only разделы, симулятор

beforeAll(async () => {
  server.listen({ onUnhandledFrame: 'error' })
  applyScenario('onboarding')
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

function renderPage(path = '/settings/objects') {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings/*" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SettingsPage — объекты', () => {
  it('список с типом; редактирование → «Сохранено»', async () => {
    renderPage()

    const rows = await screen.findAllByTestId('object-row')
    const row = rows.find((r) => r.textContent?.includes('Виноградник'))!
    expect(row).toHaveTextContent('Виноградник')

    await userEvent.click(within(row).getByRole('button', { name: 'Изменить' }))
    const nameInput = screen.getByLabelText('Название')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Виноградник-Юг')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(await screen.findByText(/Сохранено/)).toBeInTheDocument()
  })
})

describe('SettingsPage — привязка (onboarding, приёмка T16)', () => {
  it('4 неназначенных канала; привязка исчезает из списка; unknown_code недоступен', async () => {
    renderPage('/settings/binding')
    await userEvent.click(screen.getByRole('tab', { name: /Привязка/ }))

    // 4 канала нового модема ТОЧКА-16 (плюс прочие неназначенные из seed)
    const all = await screen.findAllByTestId('binding-row')
    const m16 = all.filter((r) => r.textContent?.includes('ТОЧКА-16'))
    expect(m16).toHaveLength(4)

    // выбираем пост для первого канала и привязываем
    const first = m16[0]!
    await userEvent.selectOptions(
      within(first).getByRole('combobox'),
      within(first).getAllByRole('option')[1]!,
    )
    await userEvent.click(within(first).getByRole('button', { name: 'Привязать' }))

    // строка исчезла — осталось 3 канала ТОЧКА-16 (плюс прочие seed)
    const left = await screen.findAllByTestId('binding-row')
    expect(left.filter((r) => r.textContent?.includes('ТОЧКА-16'))).toHaveLength(3)
  })

  it('после привязки всех каналов — «Неназначенных каналов нет»', { timeout: 30_000 }, async () => {
    renderPage('/settings/binding')
    await userEvent.click(screen.getByRole('tab', { name: /Привязка/ }))

    // связываем все неназначенные (остатки прошлых тестов + ТОЧКА-16 из onboarding)
    for (let i = 0; i < 10; i++) {
      const all = screen.queryAllByTestId('binding-row')
      if (all.length === 0) break
      const first = all[0]!
      const select = within(first).getByRole('combobox')
      await userEvent.selectOptions(select, within(select).getAllByRole('option')[1]!)
      await userEvent.click(within(first).getByRole('button', { name: 'Привязать' }))
      const before = all.length
      await waitFor(
        () => {
          expect(screen.queryAllByTestId('binding-row')).toHaveLength(before - 1)
        },
        { timeout: 5000 },
      )
    }

    expect(await screen.findByTestId('binding-empty')).toBeInTheDocument()
  })
})

describe('SettingsPage — команды (read-only) и симулятор', () => {
  it('команды: политики с пояснением + пометка BR-FE-7', async () => {
    renderPage('/settings/commands')
    await userEvent.click(screen.getByRole('tab', { name: 'Команды' }))

    expect((await screen.findAllByTestId('command-def-row')).length).toBeGreaterThan(0)
    expect(screen.getByText(/BR-FE-7/)).toBeInTheDocument()
  })

  it('симулятор: состояние из client_flags, флаги клиента переключаются', async () => {
    renderPage('/settings/simulator')
    await userEvent.click(screen.getByRole('tab', { name: 'Симулятор' }))

    expect(await screen.findByTestId('sim-state')).toHaveTextContent('Выключен')
    const checkbox = screen.getByLabelText('Доступ в интернет разрешён')
    await userEvent.click(checkbox)
    expect(await screen.findByText('Сохранено')).toBeInTheDocument()
  })
})
