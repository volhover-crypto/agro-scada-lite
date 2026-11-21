import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ApiError } from '@/api/client'
import { formatApiError } from '@/api/errors'
import { login } from '@/api/endpoints/auth'
import logo from '@/assets/brand/logo.svg'
import { ru } from '@/i18n/ru'
import { getSessionToken } from '@/state/session'
import s from './login.module.css'

/*
 * Экран входа (05_UI_SPEC §1): логотип, логин/пароль, «Войти».
 * Ошибки: неверные данные — своя формулировка, RATE_LIMIT и прочее — из
 * i18n по коду (02 §8). После успеха — возврат на исходный путь (02 §4).
 */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return // защита от двойного нажатия
    setBusy(true)
    setError(null)
    try {
      await login(name, password)
      navigate(from && from !== '/login' ? from : '/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
        setError(ru.login.wrongCredentials)
      } else {
        setError(formatApiError(err))
      }
    } finally {
      setBusy(false)
    }
  }

  // Уже вошли — на /login делать нечего
  if (getSessionToken()) {
    queueMicrotask(() => navigate(from && from !== '/login' ? from : '/', { replace: true }))
  }

  return (
    <main className={s.wrap}>
      <form className={s.card} onSubmit={onSubmit} noValidate>
        <img className={s.logo} src={logo} alt="AgroЭЛЕМЕНТ" />
        <h1 className={s.title}>{ru.login.title}</h1>

        <label className={s.field}>
          <span className={s.label}>{ru.login.loginLabel}</span>
          <input
            className={s.input}
            type="text"
            name="login"
            autoComplete="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            required
          />
        </label>

        <label className={s.field}>
          <span className={s.label}>{ru.login.passwordLabel}</span>
          <input
            className={s.input}
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
          />
        </label>

        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}

        <button className={s.submit} type="submit" disabled={busy}>
          {busy ? ru.login.submitting : ru.login.submit}
        </button>
      </form>
    </main>
  )
}
