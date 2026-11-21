import { ru } from '@/i18n/ru'

/** Заглушка раздела до его задачи (T06: каркас маршрутов) */
export function StubPage({ title, task }: { title: string; task: string }) {
  return (
    <main>
      <h1>{title}</h1>
      <p>{ru.shell.stubNote.replace('{task}', task)}</p>
    </main>
  )
}
