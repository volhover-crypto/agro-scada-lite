import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, setUnauthorizedHandler } from './client'
import { formatApiError } from './errors'
import { ru } from '@/i18n/ru'
import { clearSession, getSessionToken, setSessionToken } from '@/state/session'

// Мок fetch: ответ с JSON-телом (как n8n/мок по контракту)
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  setUnauthorizedHandler(null)
  clearSession()
  vi.unstubAllGlobals()
})

describe('api-клиент: 401', () => {
  it('выбрасывает ApiError(UNAUTHORIZED), чистит сессию и зовёт обработчик', async () => {
    setSessionToken('t1')
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Нет токена' } }),
        ),
    )

    await expect(api.get('/objects')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    })
    expect(handler).toHaveBeenCalledWith('/objects')
    expect(getSessionToken()).toBeNull()
  })
})

describe('api-клиент: сетевая ошибка', () => {
  it('превращается в ApiError(NETWORK), без вызова обработчика 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(api.get('/objects')).rejects.toMatchObject({ code: 'NETWORK' })
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('formatApiError (422 → текст из ru.ts)', () => {
  it('известный код ошибки → текст словаря, не сырой код', () => {
    const err = new ApiError(422, 'DURATION_OVER_MAX', 'Максимум 4 ч')
    expect(formatApiError(err)).toBe(ru.apiErrors.DURATION_OVER_MAX)
    expect(formatApiError(err)).not.toContain('DURATION_OVER_MAX')
  })

  it('неизвестный код → message сервера', () => {
    expect(formatApiError(new ApiError(422, 'SOMETHING_ELSE', 'Текст от сервера'))).toBe(
      'Текст от сервера',
    )
  })

  it('все коды из enum Error контракта имеют текст в ru.ts', () => {
    // enum Error из 03_API_CONTRACT: проверяем полный набор
    const contractCodes = [
      'UNAUTHORIZED',
      'NOT_FOUND',
      'VALIDATION',
      'MODE_MANUAL',
      'DURATION_OVER_MAX',
      'DURATION_REQUIRED',
      'NOT_APPROVED',
      'ALREADY_FINAL',
      'RATE_LIMIT',
    ]
    for (const code of contractCodes) {
      expect(ru.apiErrors[code], code).toBeTruthy()
    }
  })
})
