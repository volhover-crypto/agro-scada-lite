import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { installUnauthorizedRedirect } from './router'
import { setSessionToken } from '@/state/session'

// Приёмка T03: 401 → редирект на /login с возвратом на исходный путь

function ProbePage() {
  useEffect(() => {
    // запрос падает 401 при рендере — как любой экран с данными
    void api.get('/objects').catch(() => {})
  }, [])
  return <p>probe</p>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('401 → редирект на /login', () => {
  it('после 401 роутер оказывается на /login, from = путь запроса', async () => {
    setSessionToken('t1')
    const router = createMemoryRouter(
      [
        { path: '/', element: <ProbePage /> },
        { path: '/login', element: <p>login-page</p> },
      ],
      { initialEntries: ['/'] },
    )
    installUnauthorizedRedirect(router)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'x' } }), {
          status: 401,
        }),
      ),
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(screen.getByText('login-page')).toBeInTheDocument()
    expect((router.state.location.state as { from?: string }).from).toBe('/objects')
  })
})
