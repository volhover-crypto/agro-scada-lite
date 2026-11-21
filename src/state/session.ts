// Токен сессии: память + sessionStorage, не localStorage (02_ARCHITECTURE_FE §4).
// 401 из API → clearSession() + переход на /login (обвязка в app/router.tsx).

const KEY = 'agro-scada.session.token'

let token: string | null = readStorage()

function readStorage(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    // sessionStorage недоступен (иные ограничения) — токен только в памяти
    return null
  }
}

export function getSessionToken(): string | null {
  return token
}

export function setSessionToken(value: string): void {
  token = value
  try {
    sessionStorage.setItem(KEY, value)
  } catch {
    // память уже обновлена — продолжаем
  }
}

export function clearSession(): void {
  token = null
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // память уже очищена — продолжаем
  }
}
