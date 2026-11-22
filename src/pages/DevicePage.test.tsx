import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { HttpResponse, http } from 'msw'
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

// FIX-1: ответ потерян → повторное нажатие уходит с тем же idempotency_key
describe('FIX-1: идемпотентность при потерянном ответе', () => {
  it('сетевая ошибка → ключ сохраняется → второй запрос с тем же ключом', async () => {
    const keys: Array<string | undefined> = []
    let call = 0
    server.use(
      http.post('*/commands', async ({ request }) => {
        call += 1
        const body = (await request.json()) as { idempotency_key?: string }
        keys.push(body.idempotency_key)
        if (call === 1) return HttpResponse.error() // ответ потерян
        return HttpResponse.json({ uuid: `u${call}`, status: 'queued' })
      }),
    )
    renderDevice('/a/2')
    const on = await screen.findByTestId('primary-action')
    fireEvent.click(on)
    await screen.findByText('Нет связи с сервером')
    fireEvent.click(on)
    await waitFor(() => expect(keys.length).toBe(2))
    expect(keys[0]).toBeTruthy()
    expect(keys[0]).toBe(keys[1])
  })
})

// FIX-2: «Повторить» передаёт длительность исходной команды
describe('FIX-2: повтор с исходной длительностью', () => {
  it('команда 10 мин → timeout → повтор → duration_s=600', async () => {
    const bodies: Array<{ duration_s?: number; idempotency_key?: string }> = []
    server.use(
      http.post('*/commands', async ({ request }) => {
        const body = (await request.json()) as { duration_s?: number; idempotency_key?: string }
        bodies.push(body)
        return HttpResponse.json({ uuid: `u-${bodies.length}`, status: 'queued' })
      }),
    )
    // on-def Клапана 1 (actuator 2, seed): action='on', id=1
    const timeoutCmd = {
      uuid: 'cmd-timeout',
      actuator_id: 2,
      command_def_id: 3,
      duration_s: 600,
      status: 'timeout',
      status_history: [
        { status: 'queued', ts: '2026-11-22T10:00:00+03:00' },
        { status: 'sent_gw', ts: '2026-11-22T10:00:02+03:00' },
      ],
    }
    queryClient.setQueryData(['commands', 2, 10], [timeoutCmd])
    renderDevice('/a/2')

    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }))
    await waitFor(() => expect(bodies.length).toBe(1))
    expect(bodies[0]?.duration_s).toBe(600)
  })

  it('определение команды не найдено → ошибка показана, не исключение', async () => {
    renderDevice('/a/2')
    const orphanCmd = {
      uuid: 'cmd-orphan',
      actuator_id: 2,
      command_def_id: 999, // нет в каталоге команд устройства
      duration_s: 300,
      status: 'timeout',
      status_history: [{ status: 'queued', ts: '2026-11-22T10:00:00+03:00' }],
    }
    queryClient.setQueryData(['commands', 2, 10], [orphanCmd])
    renderDevice('/a/2')

    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }))
    expect(
      await screen.findByText('Определение команды не найдено — повтор невозможен'),
    ).toBeInTheDocument()
  })
})

// FIX-3: нет связи с сервером → предупреждение и блокировка включения/открытия
describe('FIX-3: данные устарели (offlineSince)', () => {
  it('текст «данные устарели с HH:MM», ВКЛЮЧИТЬ заблокирована, у ВЫКЛЮЧИТЬ — предупреждение', async () => {
    useUiStore.setState({ offlineSince: '2026-11-22T12:34:00+03:00' })
    renderDevice('/a/2')
    expect(await screen.findByTestId('stale-data-warning')).toHaveTextContent('12:34')
    expect(screen.getByTestId('primary-action')).toBeDisabled()
    // решение владельца: выключение НЕ блокируем, но предупреждаем честно
    expect(screen.getByTestId('secondary-action')).toBeEnabled()
    expect(screen.getByTestId('off-link-warning')).toHaveTextContent(
      'Связь потеряна, команда может не дойти',
    )
    useUiStore.setState({ offlineSince: null })
  })
})

// FIX-4: ошибка смены режима показывается у переключателя
describe('FIX-4: ошибка смены режима', () => {
  it('PUT mode вернул 423 → текст ошибки у переключателя', async () => {
    server.use(
      http.put('*/actuators/2/mode', () =>
        HttpResponse.json(
          { error: { code: 'MODE_LOCKED', message: 'Режим заблокирован командой' } },
          { status: 423 },
        ),
      ),
    )
    renderDevice('/a/2')
    fireEvent.click(await screen.findByRole('button', { name: 'Ручной' }))
    expect(await screen.findByTestId('mode-error')).toHaveTextContent('Режим заблокирован командой')
  })
})
