import { timerApi } from './store'

/*
 * Виртуальные часы для тестов мока: подменяют timerApi движка, чтобы
 * двигать таймеры команд/сценариев без vi.useFakeTimers (фейковые таймеры
 * вешают fetch/undici на внутренних setTimeout(0)).
 */

export function installVirtualClock(): { advance: (ms: number) => Promise<void> } {
  let now = 0
  let nextId = 1
  const queue = new Map<number, { at: number; fn: () => void }>()

  const realSet = timerApi.set
  timerApi.set = (fn, ms) => {
    const id = nextId++
    queue.set(id, { at: now + ms, fn })
    return id
  }
  timerApi.clear = (handle) => {
    queue.delete(handle as number)
  }

  async function advance(ms: number): Promise<void> {
    const target = now + ms
    for (;;) {
      let due: { id: number; at: number; fn: () => void } | null = null
      for (const [id, task] of queue) {
        if (task.at <= target && (!due || task.at < due.at)) due = { id, at: task.at, fn: task.fn }
      }
      if (!due) break
      now = Math.max(now, due.at)
      queue.delete(due.id)
      due.fn()
      // дать разрешиться промисам (реальный macrotask — фейковых таймеров нет)
      await new Promise((resolve) => realSet(() => resolve(null), 0))
    }
    now = target
  }

  return { advance }
}
