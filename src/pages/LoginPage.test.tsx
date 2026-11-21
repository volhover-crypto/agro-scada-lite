import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { login, logout } from '@/api/endpoints/auth'
import { server } from '@/mocks/node'
import { applyScenario } from '@/mocks/scenarios'
import { clearSession, getSessionToken } from '@/state/session'
import { LoginPage } from './LoginPage'

/*
 * Приёмка T05: demo/demo входит; logout чистит; RATE_LIMIT показывается.
 */

function mountLogin(from?: string) {
  return createMemoryRouter(
    [
      { path: '/', element: <p>home-page</p> },
      { path: '/objects', element: <p>objects-page</p> },
      { path: '/login', element: <LoginPage /> },
    ],
    {
      initialEntries: [from ? { pathname: '/login', state: { from } } : '/login'],
    },
  )
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  login: string,
  pass: string,
) {
  await user.type(screen.getByLabelText('Логин'), login)
  await user.type(screen.getByLabelText('Пароль'), pass)
  await user.click(screen.getByRole('button', { name: 'Войти' }))
}

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
  applyScenario('normal')
})

afterEach(() => {
  applyScenario('normal') // сбрасывает и счётчик rate-limit мока
  clearSession()
})

afterAll(() => server.close())

describe('LoginPage', () => {
  it('demo/demo входит и возвращается на исходный путь', async () => {
    const user = userEvent.setup()
    const router = mountLogin('/objects')
    render(<RouterProvider router={router} />)

    await fillAndSubmit(user, 'demo', 'demo')

    await waitFor(() => expect(router.state.location.pathname).toBe('/objects'))
    expect(getSessionToken()).toBeTruthy()
  })

  it('неверный пароль — сообщение из ru.ts, сессии нет', async () => {
    const user = userEvent.setup()
    const router = mountLogin()
    render(<RouterProvider router={router} />)

    await fillAndSubmit(user, 'demo', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный логин или пароль')
    expect(getSessionToken()).toBeNull()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('после 5 неудач — текст RATE_LIMIT', async () => {
    const user = userEvent.setup()
    const router = mountLogin()
    render(<RouterProvider router={router} />)

    for (let i = 0; i < 5; i++) {
      await fillAndSubmit(user, 'demo', 'wrong')
      await screen.findByRole('alert') // дождаться ответа каждой попытки
      await user.clear(screen.getByLabelText('Логин'))
      await user.clear(screen.getByLabelText('Пароль'))
    }
    await fillAndSubmit(user, 'demo', 'demo') // даже верные данные заблокированы

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Слишком много попыток, повторите через минуту',
    )
    expect(getSessionToken()).toBeNull()
  })

  it('logout чистит сессию на клиенте и на сервере', async () => {
    const res = await login('demo', 'demo')
    const token = res.token
    expect(getSessionToken()).toBe(token)

    await logout()

    expect(getSessionToken()).toBeNull()
    expect(sessionStorage.getItem('agro-scada.session.token')).toBeNull()
    // токен больше не действует и на сервере
    const check = await fetch('/webhook/objects', { headers: { Authorization: `Bearer ${token}` } })
    expect(check.status).toBe(401)
  })
})
