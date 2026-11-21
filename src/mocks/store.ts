import type { components } from '@/api/types.gen'
import { buildSeed, type Seed } from './seed'
import { iso } from './util'

/*
 * Состояние мока: датасет + журнал изменений для /updates (04_MOCK_SPEC §6 —
 * UI работает только через /updates, без полной перезагрузки списков).
 * Модуль-синглтон: в браузере его же использует панель отладки.
 */

type JournalKind = 'tags' | 'commands' | 'alarms' | 'actuators' | 'modems'

/** Строгая форма команды: сгенерированная схема делает все поля опциональными */
export type MockCommand = Required<components['schemas']['Command']>

interface JournalEntry {
  at: string
  kind: JournalKind
  items: unknown[]
}

/** Переопределения текущих значений тегов от сценариев (качество/значение) */
export interface TagOverride {
  quality?: components['schemas']['Quality']
  value?: number | null
  origin?: 'live' | 'backlog'
  tsMeasuredOldMs?: number
}

/**
 * Таймеры мока — инъекция: тесты подменяют на виртуальные часы
 * (fetch/undici при vi.useFakeTimers повисает на своих setTimeout(0))
 */
export const timerApi: {
  set: (fn: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
} = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export interface MockStore {
  scenario: string
  seed: Seed
  /** Созданные команды (движок) и индекс идемпотентности */
  commands: MockCommand[]
  commandsById: Map<string, MockCommand>
  /** Текущие значения каналов (обновляются «пакетами» движка) */
  channelValues: Map<number, { value: number; ts: number }>
  tagOverrides: Map<string, TagOverride>
  /** server_ts, строго монотонный */
  lastMs: number
  serverTs: string
  journal: JournalEntry[]
  /** Флаг симулятора: только чтение, из /updates client_flags (BR-FE-6, 21.11.2026);
   *  в /settings/client не отдаётся и не принимается */
  simMode: boolean
  /** Ускорение времени для длительностей: 30 мин → 30 с (04 §3) */
  speed: 1 | 60
  fail: { loseAck: boolean; rejectResult: boolean }
  sessions: Set<string>
  loginFails: { count: number; windowStart: number }
  timers: Set<unknown>
  cmdSeq: number
}

export const store: MockStore = {
  scenario: 'normal',
  seed: buildSeed(),
  commands: [],
  commandsById: new Map(),
  channelValues: new Map(),
  tagOverrides: new Map(),
  lastMs: 0,
  serverTs: '',
  journal: [],
  simMode: false,
  speed: 60,
  fail: { loseAck: false, rejectResult: false },
  sessions: new Set(),
  loginFails: { count: 0, windowStart: 0 },
  timers: new Set<unknown>(),
  cmdSeq: 40210,
}

/** Новое монотонное server_ts: даже при «замороженных» часах растёт на 1 мс */
export function touch(): string {
  const now = Date.now()
  store.lastMs = now > store.lastMs ? now : store.lastMs + 1
  store.serverTs = iso(store.lastMs)
  return store.serverTs
}

export function journalAdd(kind: JournalKind, items: unknown[]): void {
  store.journal.push({ at: touch(), kind, items: items.map((x) => structuredClone(x)) })
  if (store.journal.length > 5000) store.journal.splice(0, 1000)
}

/** Всё изменённое с момента since (включая границу — дедуп на клиенте, CANON §4.7) */
export function journalSince(since: string): {
  server_ts: string
  tags: unknown[]
  commands: unknown[]
  alarms: unknown[]
  actuators: unknown[]
  modems: unknown[]
} {
  const out = {
    server_ts: touch(),
    tags: [],
    commands: [],
    alarms: [],
    actuators: [],
    modems: [],
  } as {
    server_ts: string
    tags: unknown[]
    commands: unknown[]
    alarms: unknown[]
    actuators: unknown[]
    modems: unknown[]
  }
  for (const e of store.journal) {
    if (e.at < since) continue
    const bucket = out[e.kind] as unknown[] | undefined
    if (bucket) bucket.push(...e.items)
  }
  return out
}

export function clearTimers(): void {
  for (const t of store.timers) timerApi.clear(t)
  store.timers.clear()
}

/** Полный сброс к seed; таймеры движка гасятся (запуск заново — startLoops) */
export function resetStore(scenario: string = 'normal'): void {
  clearTimers()
  store.scenario = scenario
  store.seed = buildSeed()
  store.commands = []
  store.commandsById = new Map()
  store.channelValues = new Map()
  store.tagOverrides = new Map()
  store.journal = []
  store.simMode = false
  store.speed = 60
  store.fail = { loseAck: false, rejectResult: false }
  store.loginFails = { count: 0, windowStart: 0 }
  store.cmdSeq = 40210
  touch()
}
