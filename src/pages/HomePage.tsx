import { ru } from '@/i18n/ru'

// Заглушка T01; реальные экраны — с T05+
export function HomePage() {
  return (
    <main>
      <h1>{ru.appTitle}</h1>
      <p>{ru.t01ScaffoldNote}</p>
    </main>
  )
}
