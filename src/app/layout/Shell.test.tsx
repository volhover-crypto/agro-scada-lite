import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { clearSession, getSessionToken, setSessionToken } from '@/state/session'
import { Shell } from './Shell'

// Каркас: меню/шапка/нижняя панель рендерятся, без токена — редирект на /login,
// «Выйти» чистит сессию (приёмка T06)

function mountShell() {
  const router = createMemoryRouter([
    {
      path: '/',
      element: <Shell />,
      children: [
        { index: true, element: <p>home-content</p> },
        { path: 'alarms', element: <p>alarms-content</p> },
        { path: 'settings/*', element: <p>settings-content</p> },
      ],
    },
    { path: '/login', element: <p>login-page</p> },
  ])
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

// настоящий токен мока — иначе все запросы дадут 401
async function mockLogin(): Promise<string> {
  applyScenario('normal')
  const res = await fetch('/webhook/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'demo', password: 'demo' }),
  })
  return ((await res.json()) as { token: string }).token
}

afterEach(() => {
  applyScenario('normal')
  queryClient.clear()
  clearSession()
})

afterAll(() => server.close())

describe('Shell', () => {
  it('с токеном: меню, шапка с объектами и выходом; данные подтягиваются', async () => {
    setSessionToken(await mockLogin(), 'demo')
    const router = mountShell()

    // контент страницы и пункты меню
    expect(screen.getByText('home-content')).toBeInTheDocument()
    for (const label of [
      'Обзор',
      'Объекты',
      'Тревоги',
      'Графики',
      'Правила',
      'Расписания',
      'Журнал',
      'Настройки',
    ]) {
      // jsdom не применяет media-запросы: боковое и нижнее меню в DOM одновременно
      expect(
        screen.getAllByRole('link', { name: new RegExp(`^${label}`) }).length,
        label,
      ).toBeGreaterThan(0)
    }

    // шапка: объекты загрузились, пользователь и выход
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Объекты' })).toHaveDisplayValue(
        'Виноградник Золотая Балка',
      )
    })
    expect(screen.getByText('demo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('без токена — сразу на /login', async () => {
    clearSession()
    const router = mountShell()
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('«Выйти» чистит сессию и уводит на /login', async () => {
    const user = userEvent.setup()
    setSessionToken(await mockLogin(), 'demo')
    const router = mountShell()

    await user.click(await screen.findByRole('button', { name: 'Выйти' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(getSessionToken()).toBeNull()
  })
})
