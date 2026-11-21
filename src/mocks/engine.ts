import type { components } from '@/api/types.gen'
import { valueAt } from './history'
import type { AuditEntryT } from './seed'
import { journalAdd, store, timerApi, touch, type MockCommand } from './store'
import { iso, uuid } from './util'

/*
 * Движок мока: команды по правилам 08_BACKEND_HANDOFF §3, «пакеты» модемов
 * раз в 60 с (04 §2). Переходы — секундные задержки из 04 §3; длительности
 * и TTL делятся на store.speed (ускорение ×60 по умолчанию).
 */

export class MockBusinessError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'MockBusinessError'
    this.code = code
  }
}

/** Таймер мока: учитывается при сбросе; scaled-задержки делятся на store.speed */
export function later(fn: () => void, ms: number, scaled = false): void {
  const delay = scaled ? ms / store.speed : ms
  const t = timerApi.set(() => {
    store.timers.delete(t)
    fn()
  }, delay)
  store.timers.add(t)
}

function audit(
  event: string,
  entity: string,
  entityId: string,
  after: unknown,
  before: unknown = null,
): void {
  store.seed.audit.push({
    id: store.seed.audit.length + 1,
    ts: touch(),
    actor: 'demo',
    event,
    entity,
    entity_id: entityId,
    before,
    after,
  } as unknown as AuditEntryT)
}

function pushStatus(cmd: MockCommand, status: components['schemas']['CommandStatus']): void {
  cmd.status = status
  cmd.status_history.push({ status, ts: touch() })
  journalAdd('commands', [cmd])
  audit('command.status_changed', 'command', cmd.uuid, { status })
}

function actuatorOf(defId: number) {
  const def = store.seed.commandDefs.find((d) => d.id === defId)
  if (!def) throw new MockBusinessError('NOT_FOUND', 'Неизвестная команда')
  const act = store.seed.actuators.find((a) => a.id === def.actuator_id)
  if (!act) throw new MockBusinessError('NOT_FOUND', 'Неизвестное устройство')
  return { def, act }
}

function modemOf(devEui: string) {
  return store.seed.modems.find((m) => m.dev_eui === devEui)
}

/** Создание команды: проверки 08_BACKEND_HANDOFF §3.1 по порядку */
export function createCommand(
  commandDefId: number,
  idempotencyKey: string,
  durationS: number | undefined,
  source: 'manual' | 'schedule' | 'rule' = 'manual',
): { cmd: MockCommand; replayed: boolean } {
  const existing = store.commandsById.get(idempotencyKey)
  if (existing) return { cmd: existing, replayed: true }
  const { def, act } = actuatorOf(commandDefId)

  if (act.mode === 'manual' && source !== 'manual') {
    audit('schedule.skipped', 'actuator', String(act.id), { reason: 'MODE_MANUAL' })
    throw new MockBusinessError('MODE_MANUAL', 'Устройство в ручном режиме')
  }

  let duration: number | null = null
  if (def.action === 'on' || def.action === 'open') {
    if (durationS === undefined) {
      if (act.default_duration_s == null) {
        throw new MockBusinessError('DURATION_REQUIRED', 'Не указана длительность')
      }
      duration = act.default_duration_s
    } else {
      duration = durationS
    }
    if (act.max_duration_s != null && duration > act.max_duration_s) {
      throw new MockBusinessError(
        'DURATION_OVER_MAX',
        `Максимум ${Math.round(act.max_duration_s / 3600)} ч`,
      )
    }
  }

  // Политика подтверждения (§3.3): off/close — всегда сразу, без диалога
  const needsConfirm =
    (def.action === 'on' || def.action === 'open') &&
    def.confirm_policy !== 'none' &&
    source === 'manual'
  const status: components['schemas']['CommandStatus'] = needsConfirm
    ? 'awaiting_confirm'
    : 'queued'

  // В очереди уже есть неотправленная команда этого выхода → старую гасим
  const sameOutput = store.commands.filter(
    (c) =>
      actuatorOf(c.command_def_id).act.id === act.id &&
      ['created', 'awaiting_confirm', 'queued'].includes(c.status ?? ''),
  )
  for (const old of sameOutput) pushStatus(old, 'superseded')

  const offline = modemOf(act.dev_eui)?.link_status === 'offline'
  store.cmdSeq += 1
  const cmd: MockCommand = {
    uuid: uuid(),
    cmd_id: store.cmdSeq,
    command_def_id: def.id!,
    source,
    duration_s: duration,
    status: 'created',
    status_history: [],
    result_code: null,
    expires_at: offline ? iso(Date.now() + (30 * 60_000) / store.speed) : null,
    warnings: offline ? ['MODEM_OFFLINE'] : [],
    created_by: 'demo',
    created_at: touch(),
  }
  store.commands.push(cmd)
  store.commandsById.set(idempotencyKey, cmd)
  pushStatus(cmd, status)

  if (status === 'queued') startTransitions(cmd)
  return { cmd, replayed: false }
}

/** Переходы по таймерам (04 §3); шаги пропускаются, если команда уже завершена */
function startTransitions(cmd: MockCommand): void {
  const { def, act } = actuatorOf(cmd.command_def_id)
  const isC = modemOf(act.dev_eui)?.lorawan_class === 'C'

  if (cmd.warnings.includes('MODEM_OFFLINE')) {
    // Ждёт модем до expires_at, затем отменяется (§3.1 п.6, §3.2)
    later(
      () => {
        if (cmd.status === 'queued') pushStatus(cmd, 'cancelled')
      },
      30 * 60_000,
      true,
    )
    return
  }

  // queued → sent_gw
  later(
    () => {
      if (cmd.status !== 'queued') return
      pushStatus(cmd, 'sent_gw')

      // sent_gw → acked | timeout | rejected
      later(
        () => {
          if (cmd.status !== 'sent_gw') return
          if (store.fail.loseAck) {
            pushStatus(cmd, 'timeout')
            return
          }
          if (store.fail.rejectResult) {
            cmd.result_code = 1
            pushStatus(cmd, 'rejected')
            return
          }
          cmd.result_code = 0
          pushStatus(cmd, 'acked')
          applyAck(cmd, def.action ?? 'on', act.id!, cmd.duration_s ?? 0)

          // acked → completed по duration (мок: ×60)
          later(
            () => {
              if (cmd.status === 'acked') pushStatus(cmd, 'completed')
            },
            (cmd.duration_s ?? 0) * 1000 || 1000,
            true,
          )
        },
        isC ? 3000 : 5000,
      )
    },
    isC ? 2000 : 20_000,
  )
}

/** ack 0x30: обновление факта устройства (§3.2) */
function applyAck(_cmd: MockCommand, action: string, actuatorId: number, durationS: number): void {
  const act = store.seed.actuators.find((a) => a.id === actuatorId)!
  if (action === 'on' || action === 'open') {
    act.set_state = action === 'on' ? 'on' : 'open'
    act.fact_state = act.set_state
    act.fact_until = durationS > 0 ? iso(Date.now() + (durationS * 1000) / store.speed) : null
  } else {
    act.set_state = action === 'off' ? 'off' : 'closed'
    act.fact_state = act.set_state
    act.fact_until = null
    // ack команды off/close завершает активную on/open-команду этого устройства (§3.2)
    for (const c of store.commands) {
      const other = actuatorOf(c.command_def_id)
      if (other.act.id === actuatorId && other.def.action !== action && c.status === 'acked') {
        pushStatus(c, 'completed')
      }
    }
  }
  journalAdd('actuators', [act])
}

export function confirmCommand(cmdUuid: string): MockCommand {
  const cmd = store.commands.find((c) => c.uuid === cmdUuid)
  if (!cmd) throw new MockBusinessError('NOT_FOUND', 'Команда не найдена')
  if (cmd.status !== 'awaiting_confirm') {
    throw new MockBusinessError('ALREADY_FINAL', 'Команда не ждёт подтверждения')
  }
  audit('command.confirmed', 'command', cmd.uuid, { status: 'queued' })
  pushStatus(cmd, 'queued')
  startTransitions(cmd)
  return cmd
}

export function cancelCommand(cmdUuid: string): MockCommand {
  const cmd = store.commands.find((c) => c.uuid === cmdUuid)
  if (!cmd) throw new MockBusinessError('NOT_FOUND', 'Команда не найдена')
  if (!['awaiting_confirm', 'queued', 'sent_gw'].includes(cmd.status ?? '')) {
    throw new MockBusinessError('ALREADY_FINAL', 'Команду уже нельзя отменить')
  }
  audit('command.cancelled', 'command', cmd.uuid, { status: 'cancelled' })
  pushStatus(cmd, 'cancelled')
  return cmd
}

/** Раз в 60 с «приходит пакет» от 1–3 случайных модемов (04 §2) */
function packetTick(): void {
  const online = store.seed.modems.filter((m) => m.link_status === 'online')
  const count = Math.min(online.length, 1 + Math.floor(Math.random() * 3))
  const tagValues: Array<Record<string, unknown>> = []
  for (let i = 0; i < count && online.length > 0; i++) {
    const m = online.splice(Math.floor(Math.random() * online.length), 1)[0]!
    m.last_seen = touch()
    for (const t of store.seed.tags) {
      if (!t.tagId.startsWith(`${m.dev_eui}/`)) continue
      const v = valueAt(t.tagId, t.code, t.levelCm, Date.now())
      store.channelValues.set(t.channelId, { value: v, ts: Date.now() })
      const ch = store.seed.channels.find((c) => c.id === t.channelId)
      if (ch) {
        ch.last_value = v
        ch.last_ts = iso()
      }
      tagValues.push({ tag_id: t.tagId, value: v })
    }
    journalAdd('modems', [m])
  }
  if (tagValues.length) journalAdd('tags', tagValues)
  later(packetTick, 60_000)
}

export function startLoops(): void {
  later(packetTick, 60_000)
}
