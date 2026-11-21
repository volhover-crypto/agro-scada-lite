import type { components } from './types.gen'
import { clearSession, getSessionToken } from '@/state/session'

/*
 * Единственная точка всех HTTP-запросов (01_README_AGENT §4.2).
 * Базовый URL — VITE_API_BASE (по умолчанию /webhook); мок или реальный API
 * переключаются переменной VITE_USE_MOCK (подключается в T04).
 */

// Тело ошибки контракта: { error: { code, message } } (03_API_CONTRACT, Error)
type ErrorBody = components['schemas']['Error']

export class ApiError extends Error {
  /** HTTP-статус; 0 — сетевая ошибка (код NETWORK, клиентский) */
  readonly status: number
  /** Код из error.code; NETWORK/UNKNOWN — клиентские, не из контракта */
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// 401 → экран входа (02 §4). Клиент не знает роутер — обработчик ставит приложение.
type UnauthorizedHandler = (requestPath: string) => void
let onUnauthorized: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

function baseUrl(): string {
  return import.meta.env.VITE_API_BASE || '/webhook'
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getSessionToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(baseUrl() + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    // Нет сети — не ошибка протокола: в T06 превращается в жёлтый баннер связи (02 §3)
    throw new ApiError(0, 'NETWORK', 'Нет связи с сервером')
  }

  if (res.status === 204) return undefined as T

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // тело не JSON — оставляем null, ниже останется только статус
  }

  if (!res.ok) {
    const err = (data as ErrorBody | null)?.error
    const code = err?.code ?? 'UNKNOWN'
    const message = err?.message ?? `HTTP ${res.status}`
    if (res.status === 401) {
      clearSession()
      onUnauthorized?.(path)
    }
    throw new ApiError(res.status, code, message)
  }

  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
}
