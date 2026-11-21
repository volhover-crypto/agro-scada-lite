import { ru } from '@/i18n/ru'

// Заглушка маршрута /login (T03): нужна для редиректа при 401.
// Полноценный экран входа — задача T05.
export function LoginPage() {
  return (
    <main>
      <h1>{ru.common.loginTitle}</h1>
      <p>{ru.common.loginStubNote}</p>
    </main>
  )
}
