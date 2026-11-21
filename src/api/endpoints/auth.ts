import type { paths } from '@/api/types.gen'
import { api, ApiError } from '../client'
import { clearSession, setSessionToken } from '@/state/session'

// Тип ответа логина — из сгенерированного контракта (без ручных типов API)
type LoginResponse = paths['/auth/login']['post']['responses']['200']['content']['application/json']

/** Вход: при успехе кладёт токен в сессию и возвращает ответ целиком */
export async function login(loginName: string, password: string): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/login', { login: loginName, password })
  if (!res.token) {
    // по контракту 200 всегда содержит токен; защита от повреждённого ответа
    throw new ApiError(500, 'UNKNOWN', 'Сервер не вернул токен')
  }
  setSessionToken(res.token, res.user?.login ?? loginName)
  return res
}

/** Выход: сообщает серверу и чистит сессию; ошибку сети/401 игнорируем — чистим всё равно */
export async function logout(): Promise<void> {
  try {
    await api.post<void>('/auth/logout')
  } finally {
    clearSession()
  }
}
