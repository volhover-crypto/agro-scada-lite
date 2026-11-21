// Токен сессии: память + sessionStorage, не localStorage (02_ARCHITECTURE_FE §4).
// 401 из API → clearSession() + переход на /login (обвязка в app/router.tsx).

const KEY = 'agro-scada.session.token'
const USER_KEY = 'agro-scada.session.user'

let token: string | null = readStorage()
let userLogin: string | null = readUser()

function readStorage(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    // sessionStorage недоступен (иные ограничения) — токен только в памяти
    return null
  }
}

function readUser(): string | null {
  try {
    return sessionStorage.getItem(USER_KEY)
  } catch {
    return null
  }
}

export function getSessionToken(): string | null {
  return token
}

/** Логин пользователя для шапки (T06); хранится вместе с токеном */
export function getSessionUser(): string | null {
  return userLogin
}

export function setSessionToken(value: string, login?: string): void {
  token = value
  userLogin = login ?? userLogin
  try {
    sessionStorage.setItem(KEY, value)
    if (login) sessionStorage.setItem(USER_KEY, login)
  } catch {
    // память уже обновлена — продолжаем
  }
}

export function clearSession(): void {
  token = null
  userLogin = null
  try {
    sessionStorage.removeItem(KEY)
    sessionStorage.removeItem(USER_KEY)
  } catch {
    // память уже очищена — продолжаем
  }
}
