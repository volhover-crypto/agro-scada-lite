import { later, startLoops } from './engine'
import { devEui, type SeedTag } from './seed'
import { journalAdd, resetStore, store, touch } from './store'
import { iso } from './util'

/*
 * Сценарии 04_MOCK_SPEC §4. applyScenario = полный сброс к seed + мутации.
 * Переключение: ?scenario=<имя> при старте или панель отладки.
 */

export const SCENARIOS = [
  'normal',
  'quality',
  'pressure_drop',
  'link_loss',
  'cmd_fail',
  'manual_mode',
  'onboarding',
  'empty',
] as const

export type ScenarioName = (typeof SCENARIOS)[number]

export function isScenario(v: string | null): v is ScenarioName {
  return v != null && (SCENARIOS as readonly string[]).includes(v)
}

function tagOf(postId: number, code: number, levelCm?: number): SeedTag | undefined {
  return store.seed.tags.find(
    (t) =>
      t.postId === postId && t.code === code && (levelCm === undefined || t.levelCm === levelCm),
  )
}

function tagsOfModem(eui: string): SeedTag[] {
  return store.seed.tags.filter((t) => t.tagId.startsWith(`${eui}/`))
}

function setPostWorst(postId: number, status: 'ok' | 'warn' | 'alarm' | 'offline'): void {
  const p = store.seed.posts.find((x) => x.id === postId)
  if (p) p.worst_status = status
}

export function applyScenario(name: ScenarioName): void {
  resetStore(name)
  // В браузере запоминаем выбор: первая регистрация service-worker мока
  // перезагружает страницу, теряя ?scenario= (см. main.tsx)
  try {
    sessionStorage.setItem('agro-scada.mock.scenario', name)
  } catch {
    // тестовое окружение node — sessionStorage нет
  }

  if (name === 'quality') {
    // stale / offline / out_of_range / sensor_error / sim / backlog на разных постах
    const stale = tagOf(2, 0x01)
    if (stale) store.tagOverrides.set(stale.tagId, { quality: 'stale', tsMeasuredOldMs: 3_600_000 })
    const m3 = store.seed.modems.find((m) => m.dev_eui === devEui(3))
    if (m3) {
      m3.link_status = 'offline'
      m3.last_seen = iso(Date.now() - 3_600_000)
    }
    for (const t of tagsOfModem(devEui(3))) store.tagOverrides.set(t.tagId, { quality: 'offline' })
    setPostWorst(3, 'offline')
    const oor = tagOf(4, 0x03, -10)
    if (oor) store.tagOverrides.set(oor.tagId, { quality: 'out_of_range', value: 147 })
    const err = tagOf(5, 0x03, -30)
    if (err) store.tagOverrides.set(err.tagId, { quality: 'sensor_error', value: null })
    for (const t of tagsOfModem(devEui(6))) store.tagOverrides.set(t.tagId, { quality: 'sim' })
    store.simMode = true
    const bl = tagOf(7, 0x02)
    if (bl) store.tagOverrides.set(bl.tagId, { origin: 'backlog' })
  }

  if (name === 'pressure_drop') {
    for (const p of [13, 14]) {
      const press = tagOf(p, 0x06)
      if (press) store.tagOverrides.set(press.tagId, { value: 1.2 })
    }
    // через 20 с — тревога P1; через 40/60 с — шаги эскалации (04 §4)
    later(() => {
      const alarm = {
        id: 2,
        alarm_def_id: 2,
        type: 'modem_immediate' as const,
        priority: 1,
        object_id: 2,
        post_id: 13,
        message: 'Давление 1,2 бар ниже 1,5',
        state: 'active_unacked' as const,
        value: 1.2,
        raised_at: touch(),
        acked_by: null,
        acked_at: null,
        cleared_at: null,
        escalation_step: 0,
      }
      store.seed.alarms.push(alarm)
      journalAdd('alarms', [alarm])
    }, 20_000)
    const escalate = (step: number) => () => {
      const a = store.seed.alarms.find((x) => x.id === 2)
      if (a?.state === 'active_unacked') {
        a.escalation_step = step
        journalAdd('alarms', [a])
      }
    }
    later(escalate(1), 40_000)
    later(escalate(2), 60_000)
  }

  if (name === 'link_loss') {
    for (const n of [3, 4, 5, 6]) {
      const m = store.seed.modems.find((x) => x.dev_eui === devEui(n))
      if (m) {
        m.link_status = 'offline'
        m.last_seen = iso(Date.now() - 3_600_000)
        for (const t of tagsOfModem(m.dev_eui))
          store.tagOverrides.set(t.tagId, { quality: 'stale' })
        setPostWorst(n, 'offline')
      }
    }
    store.seed.alarms.push({
      id: 2,
      alarm_def_id: 1,
      type: 'link',
      priority: 2,
      object_id: 1,
      post_id: null,
      message: 'Нет связи с БС-1: 4 модема offline',
      state: 'active_unacked',
      value: null,
      raised_at: touch(),
      acked_by: null,
      acked_at: null,
      cleared_at: null,
      escalation_step: 0,
    })
  }

  if (name === 'cmd_fail') {
    store.fail.loseAck = true
  }

  if (name === 'manual_mode') {
    const v2 = store.seed.actuators.find((a) => a.id === 3)
    if (v2) {
      v2.mode = 'manual'
      v2.mode_changed_at = touch()
    }
    store.seed.audit.push({
      id: store.seed.audit.length + 1,
      ts: touch(),
      actor: 'system:scheduler',
      event: 'schedule.skipped',
      entity: 'schedule',
      entity_id: '1',
      before: null,
      after: { reason: 'MODE_MANUAL', actuator: 'Клапан 2' },
    })
  }

  if (name === 'onboarding') {
    const eui = devEui(16)
    store.seed.modems.push({
      dev_eui: eui,
      dev_name: 'ТОЧКА-16',
      object_id: 1,
      lorawan_class: 'A',
      uplink_interval_s: 900,
      bat_mv: 3900,
      margin_db: 18.5,
      receptions: { bs1: { rssi: -71, snr: 9.5 } },
      last_seen: iso(Date.now() - 300_000),
      link_status: 'online',
    })
    let chId = Math.max(...store.seed.channels.map((c) => c.id))
    for (const [code, level, no] of [
      [0x01, 150, 1],
      [0x02, 150, 1],
      [0x03, -10, 1],
      [0x05, -10, 1],
    ] as const) {
      chId += 1
      store.seed.channels.push({
        id: chId,
        dev_eui: eui,
        param_code: code,
        param_name: '',
        unit: '',
        level_cm: level,
        sensor_no: no,
        status: 'unassigned',
        last_value: null,
        last_ts: null,
        tag_id: `${eui}/${code}/${level}/${no}`,
      })
    }
  }

  if (name === 'empty') {
    const s = store.seed
    s.objects = []
    s.posts = []
    s.modems = []
    s.channels = []
    s.bindings = []
    s.tags = []
    s.actuators = []
    s.commandDefs = []
    s.rules = []
    s.schedules = []
    s.alarms = []
    s.dashboards = []
    s.audit = []
  }

  startLoops()
}
