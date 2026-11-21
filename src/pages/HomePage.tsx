import { ru } from '@/i18n/ru'

// Обзор объектов появится в T09; пока — ориентир по доступному
export function HomePage() {
  return (
    <main>
      <h1>{ru.appTitle}</h1>
      <p>{ru.shell.overviewNote}</p>
    </main>
  )
}
