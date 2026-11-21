import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { setSessionToken } from '@/state/session'
import { RulesPage } from './RulesPage'

// Правила (T14): список из мока, утверждение, мастер — сводка и сохранение

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
        <RulesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RulesPage (normal: утверждённое правило «Полив по влажности»)', () => {
  it('список: имя, устройство, статус «Утверждено», последний запуск', async () => {
    renderPage()

    const row = await screen.findByTestId('rule-row')
    expect(row).toHaveTextContent('Полив по влажности (Пост 5)')
    expect(row).toHaveTextContent('Клапан 2')
    expect(row).toHaveTextContent('Утверждено')
    expect(row).toHaveTextContent('не запускалось')
  })

  it('мастер: сводка на шаге 4, «Сохранить черновик» → строка «Ждёт утверждения»', async () => {
    renderPage()
    await screen.findByTestId('rule-row')

    await userEvent.click(screen.getByRole('button', { name: 'Создать правило' }))
    // шаг 1: тег/оператор/значение (каталог тегов грузится асинхронно)
    const tagSelect = screen.getByLabelText('Тег')
    await within(tagSelect).findAllByRole('option', { name: /Пост/ })
    await userEvent.selectOptions(tagSelect, within(tagSelect).getAllByRole('option')[1]!)
    await userEvent.type(screen.getByLabelText('Значение'), '25')
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }))
    // шаг 2: команда
    const cmdSelect = screen.getByLabelText('Команда')
    await userEvent.selectOptions(cmdSelect, within(cmdSelect).getAllByRole('option')[1]!)
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }))
    // шаг 3: ограничения по умолчанию
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }))
    // шаг 4: сводка + название
    expect(screen.getByTestId('rule-summary')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Название правила'), 'Полив утром')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }))

    const rows = await screen.findAllByTestId('rule-row')
    const newRow = rows.find((r) => r.textContent?.includes('Полив утром'))!
    expect(newRow).toHaveTextContent('Ждёт утверждения')
    // у черновика есть кнопка утверждения
    expect(within(newRow).getByRole('button', { name: 'Утвердить' })).toBeInTheDocument()
  })

  it('правка утверждённого: предупреждение в мастере', async () => {
    renderPage()
    const rows = await screen.findAllByTestId('rule-row')
    const row = rows.find((r) => r.textContent?.includes('Полив по влажности'))!
    await userEvent.click(within(row).getByRole('button', { name: 'Изменить' }))

    expect(await screen.findByTestId('edit-warning')).toHaveTextContent(
      'После изменения правило потребует повторного утверждения',
    )
    // шаг 4: сохранение → сервер сбрасывает в pending
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }))
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }))
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }))
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => {
      const after = await screen.findAllByTestId('rule-row')
      const edited = after.find((r) => r.textContent?.includes('Полив по влажности'))
      expect(edited).toHaveTextContent('Ждёт утверждения')
    })
  })
})
