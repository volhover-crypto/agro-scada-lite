import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { setSessionToken } from '@/state/session'
import { useUiStore } from '@/state/ui'
import { DevicePage } from './DevicePage'

// Страница устройства (T12): шапка, факт, кнопки, пресет длительности,
// пометка симулятора (D-18), подсказка ручного режима

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

function renderDevice(path: string) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/a/:actuatorId" element={<DevicePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DevicePage — Клапан 1 (normal)', () => {
  it('шапка с постом и участком, кнопки, пресет 30 мин, история пуста', async () => {
    renderDevice('/a/2')

    expect(
      await screen.findByRole('heading', { name: /Клапан 1 · Пост 7 · Участок Б/ }),
    ).toBeInTheDocument()
    expect(await screen.findByTestId('primary-action')).toHaveTextContent('ВКЛЮЧИТЬ')
    expect(screen.getByTestId('secondary-action')).toHaveTextContent('ВЫКЛЮЧИТЬ')
    // default_duration_s = 1800 → пресет «30 мин»
    expect(await screen.findByDisplayValue('30 мин')).toBeInTheDocument()
    expect(screen.getByText('Команд ещё не было')).toBeInTheDocument()
  })

  it('sim_mode — пометка «идёт в симулятор» у действий (D-18)', async () => {
    useUiStore.getState().setSimMode(true)
    renderDevice('/a/2')
    expect(await screen.findAllByText('идёт в симулятор')).not.toHaveLength(0)
    useUiStore.getState().setSimMode(false)
  })
})

describe('DevicePage — Клапан 2 (manual_mode: сценарий переводит actuator id=3)', () => {
  it('подсказка «автоматика не выполняется»', async () => {
    applyScenario('manual_mode')
    // staleTime 30 с: кэш actuator'ов из предыдущих тестов ещё «свежий» — сбрасываем
    await queryClient.invalidateQueries({ queryKey: ['actuators'] })
    renderDevice('/a/3')

    expect(
      await screen.findByText('Расписания и автоматика не выполняются для этого устройства'),
    ).toBeInTheDocument()
  })
})
