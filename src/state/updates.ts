import type { components } from '@/api/types.gen'
import { api } from '@/api/client'
import { queryClient } from '@/api/queryClient'
import { toMskIso } from '@/lib/time'
import { useUiStore } from './ui'

/*
 * Глобальный поллер /updates (02 §3): 30 с; 5 с, пока есть команда в статусах
 * created/awaiting_confirm/queued/sent_gw; пауза при скрытой вкладке;
 * ошибка сети — баннер «Нет связи» + backoff 5→60 с. Ответ раскладывается
 * в кэш Query по сущностям, полные списки экраны перезапрашивают сами.
 */

type Updates = components['schemas']['Updates']
type CommandT = components['schemas']['Command']
type AlarmT = components['schemas']['Alarm']
type ActuatorT = components['schemas']['Actuator']
type ModemT = components['schemas']['Modem']

export const UPDATES_INTERVAL_MS = 30_000
export const FAST_INTERVAL_MS = 5_000
const ACTIVE_STATUSES = new Set(['created', 'awaiting_confirm', 'queued', 'sent_gw'])

/** Есть ли активная команда → интервал 5 с */
export function pickInterval(tracked: Iterable<string>): number {
  for (const s of tracked) if (ACTIVE_STATUSES.has(s)) return FAST_INTERVAL_MS
  return UPDATES_INTERVAL_MS
}

function mergeBy<T>(old: T[] | undefined, patch: T[], key: (x: T) => string): T[] {
  if (!patch.length) return old ?? []
  const map = new Map((old ?? []).map((x) => [key(x), x]))
  for (const x of patch) map.set(key(x), x)
  return [...map.values()]
}

/** Раскладка ответа /updates в кэш Query + флаги в ui-store. Экспортировано для теста */
export function applyUpdates(res: Updates): void {
  for (const tag of res.tags ?? []) {
    if (tag?.tag_id) queryClient.setQueryData(['tag', tag.tag_id], tag)
  }
  if (res.commands?.length) {
    queryClient.setQueryData(['commands'], (old: CommandT[] | undefined) =>
      mergeBy(old, res.commands as CommandT[], (c) => c.uuid ?? ''),
    )
  }
  if (res.alarms?.length) {
    queryClient.setQueryData(['alarms'], (old: AlarmT[] | undefined) =>
      mergeBy(old, res.alarms as AlarmT[], (a) => String(a.id ?? '')),
    )
  }
  if (res.actuators?.length) {
    queryClient.setQueryData(['actuators'], (old: ActuatorT[] | undefined) =>
      mergeBy(old, res.actuators as ActuatorT[], (a) => String(a.id ?? '')),
    )
  }
  if (res.modems?.length) {
    queryClient.setQueryData(['modems'], (old: ModemT[] | undefined) =>
      mergeBy(old, res.modems as ModemT[], (m) => m.dev_eui ?? ''),
    )
  }
  useUiStore.getState().setSimMode(res.client_flags?.sim_mode === true)
}

/** Отслеживание активных команд между опросами (ответ несёт только изменения) */
export function trackCommands(tracked: Map<string, string>, commands: CommandT[]): void {
  for (const c of commands) {
    const status = c.status ?? ''
    if (ACTIVE_STATUSES.has(status)) tracked.set(c.uuid ?? '', status)
    else tracked.delete(c.uuid ?? '')
  }
}

export function startUpdatesPolling(): () => void {
  let since = toMskIso(0) // первый опрос забирает весь журнал сценария
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const tracked = new Map<string, string>()
  let backoffMs = 5_000

  async function tick(): Promise<void> {
    if (stopped) return
    try {
      const res = await api.get<Updates>(`/updates?since=${encodeURIComponent(since)}`)
      if (stopped) return
      since = res.server_ts ?? since
      const commands = (res.commands ?? []) as CommandT[]
      trackCommands(tracked, commands)
      applyUpdates(res)
      useUiStore.getState().setOfflineSince(null)
      backoffMs = 5_000
      schedule(pickInterval(tracked.values()))
    } catch {
      if (stopped) return
      useUiStore.getState().setOfflineSince(toMskIso())
      schedule(backoffMs)
      backoffMs = Math.min(backoffMs * 2, 60_000)
    }
  }

  function schedule(ms: number): void {
    if (stopped) return
    timer = setTimeout(() => void tick(), ms)
  }

  function onVisibility(): void {
    if (stopped) return
    if (document.visibilityState === 'visible') {
      if (timer) clearTimeout(timer)
      void tick()
    } else if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  document.addEventListener('visibilitychange', onVisibility)
  void tick()

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
