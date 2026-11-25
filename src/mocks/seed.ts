import type { components } from '@/api/types.gen'
import { paramByCode } from './paramDict'
import { iso, mulberry32 } from './util'

/*
 * Стартовый набор данных (04_MOCK_SPEC §1). Всё детерминировано:
 * одинаковые координаты/имена/политики при каждом сбросе.
 */

// Сгенерированные схемы делают все поля опциональными; данные мока всегда полные —
// берём строгие формы через Required
type Obj = Required<components['schemas']['Object']>
export type PostT = Required<components['schemas']['Post']>
type ModemT = Required<components['schemas']['Modem']>
type ChannelT = Required<components['schemas']['Channel']>
type BindingT = Required<components['schemas']['Binding']>
type ActuatorT = Required<components['schemas']['Actuator']>
type CommandDefT = Required<components['schemas']['CommandDef']>
// condition/action/layout в схеме — object без свойств; для мока — unknown-объекты
export type RuleT = Required<Omit<components['schemas']['Rule'], 'condition' | 'action'>> & {
  condition: Record<string, unknown>
  action: Record<string, unknown>
}
export type ScheduleT = Required<components['schemas']['Schedule']>
type AlarmT = Required<components['schemas']['Alarm']>
export type DashboardT = Required<Omit<components['schemas']['Dashboard'], 'layout'>> & {
  layout: Array<Record<string, unknown>>
}
// before/after в схеме — object без свойств (типируется как Record<string, never>);
// для мока полезнее unknown
export type AuditEntryT = Required<
  Omit<components['schemas']['AuditEntry'], 'before' | 'after'>
> & {
  before: unknown
  after: unknown
}

export interface SeedTag {
  tagId: string
  channelId: number
  postId: number
  code: number
  levelCm: number
  sensorNo: number
}

export interface Seed {
  farm: { id: number; name: string }
  objects: Obj[]
  posts: PostT[]
  modems: ModemT[]
  channels: ChannelT[]
  bindings: BindingT[]
  tags: SeedTag[]
  forecastTag: { tagId: string; name: string; unit: string }
  actuators: ActuatorT[]
  commandDefs: CommandDefT[]
  rules: RuleT[]
  schedules: ScheduleT[]
  alarms: AlarmT[]
  alarmDefs: Array<Record<string, unknown>>
  chains: Array<Record<string, unknown>>
  notifyChannels: Array<{ id: number; type: string; address: string; enabled: boolean }>
  dashboards: DashboardT[]
  audit: AuditEntryT[]
  client: {
    internet_allowed: boolean
    allowed_channels: string[]
    external_sources_allowed: boolean
  }
}

export const DEMO_USER = { id: 1, login: 'demo', password: 'demo' }

export function devEui(n: number): string {
  return `70B3D58FF0031A${n.toString(16).padStart(2, '0').toUpperCase()}`
}

export function makeTagId(eui: string, code: number, level: number, no: number): string {
  // CANON §4: десятичные числа без ведущих нулей
  return `${eui}/${code}/${level}/${no}`
}

/**
 * Координаты постов в области 1-го отделения «Золотой Балки» (Севастополь):
 * lat 44.5180..44.5375, lon 33.5650..33.6150
 */
const VINEYARD_COORDS: ReadonlyArray<readonly [number, number]> = [
  [44.5335, 33.5715],
  [44.5318, 33.5752],
  [44.5289, 33.5734],
  [44.5262, 33.5778],
  [44.5326, 33.5824],
  [44.5294, 33.5848],
  [44.5271, 33.5812],
  [44.5305, 33.5985],
  [44.5282, 33.6034],
  [44.5258, 33.6078],
  [44.5241, 33.6002],
  [44.5266, 33.5955],
]

const PUMP_COORDS: ReadonlyArray<readonly [number, number]> = [
  [44.5224, 33.5908],
  [44.5218, 33.5926],
  [44.5231, 33.5892],
]

/** 5 уровней влажности грунта по глубине (см) */
const SOIL_MOISTURE_LEVELS = [-10, -20, -30, -45, -60] as const

export function displayName(code: number, level: number, no: number): string {
  const p = paramByCode(code)
  const lvl = level === 0 ? '' : level > 0 ? ` +${level} см` : ` ${level} см`
  return `${p?.name ?? 'Параметр'}${lvl} №${no}`
}

export function buildSeed(): Seed {
  const rnd = mulberry32(20261121)
  const now = Date.now()
  const OBJ1 = {
    id: 1,
    farm_id: 1,
    name: 'Виноградник Золотая Балка',
    object_type: 'vineyard',
    lat: 44.5285,
    lon: 33.591,
    tz: 'Europe/Moscow',
  } as Obj
  const OBJ2 = {
    id: 2,
    farm_id: 1,
    name: 'Насосная-1',
    object_type: 'pump_station',
    lat: 44.5224,
    lon: 33.5908,
    tz: 'Europe/Moscow',
  } as Obj

  // 12 постов виноградника в кварталах 1-го отделения «Золотой Балки»; 3 поста насосной у водоёмов
  const plots = ['Участок А', 'Участок Б', 'Участок В']
  const posts: PostT[] = []
  for (let i = 0; i < 12; i++) {
    const col = i % 4
    const row = Math.floor(i / 4)
    const [lat, lon] = VINEYARD_COORDS[i]!
    posts.push({
      id: i + 1,
      object_id: 1,
      name: `Пост ${i + 1}`,
      plot_name: plots[row]!,
      lat,
      lon,
      scene_x: col * 8,
      scene_y: row * 8,
      worst_status: 'ok',
    })
  }
  const pumpPlots = ['Машинный зал', 'Байпас', 'Резервуар']
  for (let i = 0; i < 3; i++) {
    const [lat, lon] = PUMP_COORDS[i]!
    posts.push({
      id: 13 + i,
      object_id: 2,
      name: `Пост Н${i + 1}`,
      plot_name: pumpPlots[i]!,
      lat,
      lon,
      scene_x: i * 4,
      scene_y: i * 3,
      worst_status: 'ok',
    })
  }

  // Модемы: класс C (исполнители) — 7, 8, 13, 14; остальные класс A; 15-й «новый»
  const classC = new Set([7, 8, 13, 14])
  const modems: ModemT[] = []
  for (let n = 1; n <= 15; n++) {
    const isC = classC.has(n)
    modems.push({
      dev_eui: devEui(n),
      dev_name: `ТОЧКА-${String(n).padStart(2, '0')}`,
      object_id: n <= 12 ? 1 : 2,
      lorawan_class: isC ? 'C' : 'A',
      uplink_interval_s: isC ? 300 : 900,
      bat_mv: isC ? null : Math.round(3550 + rnd() * 250),
      margin_db: +(8 + rnd() * 14).toFixed(1),
      receptions: {
        bs1: { rssi: Math.round(-(55 + rnd() * 25)), snr: +(4 + rnd() * 8).toFixed(1) },
        bs2: { rssi: Math.round(-(60 + rnd() * 25)), snr: +(3 + rnd() * 8).toFixed(1) },
      },
      last_seen: iso(now - Math.round(rnd() * 400_000)),
      link_status: 'online',
    })
  }

  // Каналы (04 §1); на постах виноградника — 5 уровней влажности грунта
  const channels: ChannelT[] = []
  const bindings: BindingT[] = []
  const tags: SeedTag[] = []
  let chId = 0
  let bindId = 0

  function addChannel(
    eui: string,
    code: number,
    level: number,
    no: number,
    postId: number | null,
    status: 'assigned' | 'unassigned' | 'unknown_code' = 'assigned',
  ): void {
    chId += 1
    const p = paramByCode(code)
    const tagId = makeTagId(eui, code, level, no)
    channels.push({
      id: chId,
      dev_eui: eui,
      param_code: code,
      param_name: status === 'unknown_code' ? '' : (p?.name ?? ''),
      unit: status === 'unknown_code' ? '' : (p?.unit ?? ''),
      level_cm: level,
      sensor_no: no,
      status,
      last_value: null,
      last_ts: null,
      tag_id: tagId,
    })
    if (postId !== null && status === 'assigned') {
      bindId += 1
      bindings.push({
        id: bindId,
        channel_id: chId,
        post_id: postId,
        display_name: displayName(code, level, no),
        range_min: code === 0x06 ? 0 : code === 0x01 ? -40 : 0,
        range_max: code === 0x06 ? 6 : code === 0x01 ? 60 : 100,
        offset: 0,
        factor: 1,
        valid_from: iso(now - 30 * 24 * 3_600_000),
        valid_to: null,
      })
      tags.push({ tagId, channelId: chId, postId, code, levelCm: level, sensorNo: no })
    }
  }

  for (let i = 1; i <= 12; i++) {
    const eui = devEui(i)
    addChannel(eui, 0x01, 150, 1, i)
    addChannel(eui, 0x02, 150, 1, i)
    for (const lvl of SOIL_MOISTURE_LEVELS) {
      addChannel(eui, 0x03, lvl, 1, i)
    }
    if (i > 6) addChannel(eui, 0x04, -10, 1, i)
    if (i === 1) addChannel(eui, 0x09, 150, 1, i)
    if (i === 2 || i === 3) addChannel(eui, 0x08, 100, 1, i)
  }
  const eui13 = devEui(13)
  addChannel(eui13, 0x06, 0, 1, 13)
  addChannel(eui13, 0x01, 150, 1, 13)
  addChannel(eui13, 0x02, 150, 1, 13)
  addChannel(eui13, 0x0c, 0, 1, 13)
  addChannel(devEui(14), 0x06, 0, 1, 14)
  addChannel(devEui(14), 0x01, 150, 1, 14)
  addChannel(devEui(14), 0x02, 150, 1, 14)
  // Новый модем 15: неназначенные и неизвестный код (04 §1)
  addChannel(devEui(15), 0x03, -20, 2, null, 'unassigned')
  addChannel(devEui(15), 0x02, 150, 2, null, 'unassigned')
  addChannel(devEui(15), 0x7a, 0, 1, null, 'unknown_code')

  const soilP5 = tags.find((t) => t.postId === 5 && t.code === 0x03 && t.levelCm === -10)!.tagId
  const tAirP1 = tags.find((t) => t.postId === 1 && t.code === 0x01)!.tagId
  const rhP1 = tags.find((t) => t.postId === 1 && t.code === 0x02)!.tagId
  const rainP1 = tags.find((t) => t.postId === 1 && t.code === 0x09)!.tagId
  const pressP13 = tags.find((t) => t.postId === 13 && t.code === 0x06)!.tagId
  const flowP13 = tags.find((t) => t.postId === 13 && t.code === 0x0c)!.tagId

  // Исполнители и команды (04 §1: насос always, клапан 1 manual_only, прочие manual_and_rule_approval)
  const actuators: ActuatorT[] = [
    {
      id: 1,
      dev_eui: eui13,
      output_no: 1,
      type: 'pump',
      name: 'Насос 1',
      post_id: 13,
      mode: 'auto',
      mode_changed_at: iso(now - 86_400_000),
      set_state: 'off',
      fact_state: 'off',
      fact_until: null,
      default_duration_s: 600,
      max_duration_s: 14_400,
      commands: [],
    },
    {
      id: 2,
      dev_eui: devEui(7),
      output_no: 1,
      type: 'valve',
      name: 'Клапан 1',
      post_id: 7,
      mode: 'auto',
      mode_changed_at: iso(now - 86_400_000),
      set_state: 'off',
      fact_state: 'off',
      fact_until: null,
      default_duration_s: 1800,
      max_duration_s: 14_400,
      commands: [],
    },
    {
      id: 3,
      dev_eui: devEui(7),
      output_no: 2,
      type: 'valve',
      name: 'Клапан 2',
      post_id: 7,
      mode: 'auto',
      mode_changed_at: iso(now - 86_400_000),
      set_state: 'off',
      fact_state: 'off',
      fact_until: null,
      default_duration_s: 1800,
      max_duration_s: 14_400,
      commands: [],
    },
    {
      id: 4,
      dev_eui: devEui(8),
      output_no: 1,
      type: 'valve',
      name: 'Клапан 3',
      post_id: 8,
      mode: 'auto',
      mode_changed_at: iso(now - 86_400_000),
      set_state: 'off',
      fact_state: 'off',
      fact_until: null,
      default_duration_s: 1800,
      max_duration_s: 14_400,
      commands: [],
    },
    {
      id: 5,
      dev_eui: devEui(14),
      output_no: 1,
      type: 'fan',
      name: 'Вентилятор',
      post_id: 14,
      mode: 'auto',
      mode_changed_at: iso(now - 86_400_000),
      set_state: 'off',
      fact_state: 'off',
      fact_until: null,
      default_duration_s: 1800,
      max_duration_s: 7200,
      commands: [],
    },
    {
      id: 6,
      dev_eui: devEui(14),
      output_no: 2,
      type: 'window',
      name: 'Форточка',
      post_id: 14,
      mode: 'auto',
      mode_changed_at: iso(now - 86_400_000),
      set_state: 'closed',
      fact_state: 'closed',
      fact_until: null,
      default_duration_s: null,
      max_duration_s: null,
      commands: [],
    },
    {
      // T12: исполнитель на посте 4 — в сценарии link_loss (модемы 3–6 offline)
      // он даёт ветку MODEM_OFFLINE у команд
      id: 7,
      dev_eui: devEui(4),
      output_no: 1,
      type: 'valve',
      name: 'Клапан 4',
      post_id: 4,
      mode: 'auto',
      mode_changed_at: iso(now - 86_400_000),
      set_state: 'off',
      fact_state: 'off',
      fact_until: null,
      default_duration_s: 1800,
      max_duration_s: 14_400,
      commands: [],
    },
  ]
  const commandDefs: CommandDefT[] = [
    { id: 1, actuator_id: 1, action: 'on', confirm_policy: 'always' },
    { id: 2, actuator_id: 1, action: 'off', confirm_policy: 'none' },
    { id: 3, actuator_id: 2, action: 'on', confirm_policy: 'manual_only' },
    { id: 4, actuator_id: 2, action: 'off', confirm_policy: 'none' },
    { id: 5, actuator_id: 3, action: 'on', confirm_policy: 'manual_and_rule_approval' },
    { id: 6, actuator_id: 3, action: 'off', confirm_policy: 'none' },
    { id: 7, actuator_id: 4, action: 'on', confirm_policy: 'manual_and_rule_approval' },
    { id: 8, actuator_id: 4, action: 'off', confirm_policy: 'none' },
    { id: 9, actuator_id: 5, action: 'on', confirm_policy: 'manual_and_rule_approval' },
    { id: 10, actuator_id: 5, action: 'off', confirm_policy: 'none' },
    { id: 11, actuator_id: 6, action: 'open', confirm_policy: 'manual_and_rule_approval' },
    { id: 12, actuator_id: 6, action: 'close', confirm_policy: 'none' },
    { id: 13, actuator_id: 7, action: 'on', confirm_policy: 'manual_and_rule_approval' },
    { id: 14, actuator_id: 7, action: 'off', confirm_policy: 'none' },
  ]
  for (const def of commandDefs) {
    actuators[def.actuator_id - 1]!.commands!.push(def)
  }

  const rules: RuleT[] = [
    {
      id: 1,
      name: 'Полив по влажности (Пост 5)',
      condition: { tag_id: soilP5, op: '<', value: 25 },
      action: { command_def_id: 5, duration_s: 1800 },
      hysteresis: 5,
      min_pause_s: 3600,
      on_no_data: 'skip',
      fallback_schedule_id: null,
      enabled: true,
      approval_status: 'approved',
      last_fired_at: null,
    },
  ]

  const schedules: ScheduleT[] = [
    {
      id: 1,
      command_def_id: 3,
      time: '06:00',
      days: [1, 2, 3, 4, 5, 6, 7],
      duration_s: 1800,
      enabled: true,
      approval_status: 'approved',
    },
    {
      id: 2,
      command_def_id: 7,
      time: '18:00',
      days: [1, 2, 3, 4, 5],
      duration_s: 1800,
      enabled: true,
      approval_status: 'pending',
    },
  ]

  const alarms: AlarmT[] = [
    {
      id: 1,
      alarm_def_id: 3,
      type: 'threshold',
      priority: 3,
      object_id: 1,
      post_id: 5,
      message: 'Влажность грунта 22 % ниже 25 %',
      state: 'active_unacked',
      value: 22,
      raised_at: iso(now - 2_400_000),
      acked_by: null,
      acked_at: null,
      cleared_at: null,
      escalation_step: 0,
    },
  ]

  return {
    farm: { id: 1, name: 'АгроЭЛЕМЕНТ-Демо' },
    objects: [OBJ1, OBJ2],
    posts,
    modems,
    channels,
    bindings,
    tags,
    forecastTag: { tagId: 'EXT0000000000001/9/0/1', name: 'Осадки (прогноз)', unit: 'мм' },
    actuators,
    commandDefs,
    rules,
    schedules,
    alarms,
    alarmDefs: [
      {
        id: 1,
        type: 'link',
        tag_id: null,
        priority: 2,
        hysteresis: null,
        delay_samples: 1,
        chain_id: null,
        enabled: true,
      },
      {
        id: 2,
        type: 'threshold',
        tag_id: pressP13,
        params: { op: '<', value: 1.5 },
        priority: 1,
        hysteresis: 0.1,
        delay_samples: 1,
        chain_id: 1,
        enabled: true,
      },
      {
        id: 3,
        type: 'threshold',
        tag_id: soilP5,
        params: { op: '<', value: 25 },
        priority: 3,
        hysteresis: 5,
        delay_samples: 2,
        chain_id: null,
        enabled: true,
      },
    ],
    chains: [
      {
        id: 1,
        name: 'Давление (P1)',
        steps: [
          { after_min: 0, channels: ['push', 'telegram'] },
          { after_min: 10, channels: ['push', 'telegram', 'sms'] },
          { after_min: 20, channels: 'all' },
        ],
      },
    ],
    notifyChannels: [
      { id: 1, type: 'push', address: 'demo-client', enabled: true },
      { id: 2, type: 'telegram', address: '-1000000000001', enabled: true },
      { id: 3, type: 'sms', address: '+790000000000', enabled: false },
    ],
    dashboards: [
      {
        id: 1,
        object_id: 1,
        name: 'Основной',
        layout: [
          {
            id: 'w1',
            kind: 'card',
            title: 'Температура воздуха',
            tags: [tAirP1],
            grid: { x: 0, y: 0, w: 3, h: 2 },
          },
          {
            id: 'w2',
            kind: 'gauge',
            title: 'Влажность грунта, Пост 5',
            tags: [soilP5],
            thresholds: [{ value: 25, color: 'warn' }],
            grid: { x: 3, y: 0, w: 3, h: 2 },
          },
          {
            id: 'w3',
            kind: 'chart',
            title: 'Климат за сутки',
            tags: [tAirP1, rhP1],
            grid: { x: 0, y: 2, w: 6, h: 3 },
          },
          {
            id: 'w4',
            kind: 'bar',
            title: 'Осадки по дням',
            tags: [rainP1],
            grid: { x: 6, y: 2, w: 3, h: 3 },
          },
        ],
      },
      {
        id: 2,
        object_id: 2,
        name: 'Насосная',
        layout: [
          {
            id: 'w1',
            kind: 'gauge',
            title: 'Давление системы',
            tags: [pressP13],
            thresholds: [{ value: 1.5, color: 'alarm' }],
            grid: { x: 0, y: 0, w: 3, h: 2 },
          },
          {
            id: 'w2',
            kind: 'card',
            title: 'Расход',
            tags: [flowP13],
            grid: { x: 3, y: 0, w: 3, h: 2 },
          },
        ],
      },
    ],
    audit: [
      {
        id: 1,
        ts: iso(now - 172_800_000),
        actor: 'owner',
        event: 'rule.created',
        entity: 'rule',
        entity_id: '1',
        before: null,
        after: { name: 'Полив по влажности (Пост 5)' },
      },
      {
        id: 2,
        ts: iso(now - 172_800_000),
        actor: 'owner',
        event: 'rule.approved',
        entity: 'rule',
        entity_id: '1',
        before: { approval_status: 'pending' },
        after: { approval_status: 'approved' },
      },
      {
        id: 3,
        ts: iso(now - 86_400_000),
        actor: 'owner',
        event: 'schedule.approved',
        entity: 'schedule',
        entity_id: '1',
        before: { approval_status: 'pending' },
        after: { approval_status: 'approved' },
      },
    ],
    client: {
      internet_allowed: true,
      allowed_channels: ['push', 'telegram'],
      external_sources_allowed: true,
    },
  }
}
