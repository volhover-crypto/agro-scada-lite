import { HttpResponse, http } from 'msw'
import type { components } from '@/api/types.gen'
import { cancelCommand, confirmCommand, createCommand, MockBusinessError } from './engine'
import { forecastAt, valueAt } from './history'
import { PARAM_DICT, paramByCode } from './paramDict'
import {
  DEMO_USER,
  displayName,
  type AuditEntryT,
  type DashboardT,
  type PostT,
  type RuleT,
  type ScheduleT,
  type SeedTag,
} from './seed'
import {
  journalAdd,
  journalSince,
  readDashboardOverrides,
  store,
  touch,
  writeDashboardOverride,
} from './store'
import { iso, uuid } from './util'

/*
 * MSW-обработчики всех путей 03_API_CONTRACT (базовый /webhook).
 * Ответы собираются из store; изменения идут через журнал /updates.
 */

const BASE = '/webhook'

type TagValueT = components['schemas']['TagValue']
type Quality = components['schemas']['Quality']

function errBody(code: string, message: string) {
  return { error: { code, message } }
}

function err(status: number, code: string, message: string) {
  return HttpResponse.json(errBody(code, message), { status })
}

function bizError(e: MockBusinessError) {
  const status = e.code === 'NOT_FOUND' ? 404 : e.code === 'RATE_LIMIT' ? 429 : 422
  return HttpResponse.json(errBody(e.code, e.message), { status })
}

function bearer(request: Request): string | null {
  const h = request.headers.get('Authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

/*
 * Сессии — в localStorage, не в памяти страницы: обработчики MSW живут в
 * контексте страницы, и после полной перезагрузки стор обнуляется — токен из
 * sessionStorage должен оставаться действительным (как серверная сессия в бэкенде)
 */
const MOCK_SESSIONS_KEY = 'agro-scada.mock.sessions'

function listSessions(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MOCK_SESSIONS_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function addSession(token: string): void {
  const list = listSessions()
  list.push(token)
  try {
    localStorage.setItem(MOCK_SESSIONS_KEY, JSON.stringify(list))
  } catch {
    // localStorage недоступен — сессия только на текущую страницу
  }
}

function removeSession(token: string): void {
  try {
    localStorage.setItem(
      MOCK_SESSIONS_KEY,
      JSON.stringify(listSessions().filter((t) => t !== token)),
    )
  } catch {
    // ignore
  }
}

/** 401 без/с чужим токеном; для /auth/login не применяется */
function guard(request: Request): Response | null {
  const t = bearer(request)
  if (!t || !listSessions().includes(t)) return err(401, 'UNAUTHORIZED', 'Нет или истёк токен')
  return null
}

async function jsonBody<T>(request: Request): Promise<T> {
  return (await request.json()) as T
}

function audit(
  event: string,
  entity: string,
  entityId: string,
  after: unknown,
  before: unknown = null,
) {
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

function bindingName(tagId: string): string {
  const parts = tagId.split('/')
  return displayName(Number(parts[1]), Number(parts[2]), Number(parts[3]))
}

/** Текущее значение тега с качеством (04 §2, CANON §4) */
function tagValueFor(t: SeedTag): TagValueT {
  const [eui] = t.tagId.split('/')
  const modem = store.seed.modems.find((m) => m.dev_eui === eui)
  const ov = store.tagOverrides.get(t.tagId)
  let quality: Quality = 'good'
  if (ov?.quality) quality = ov.quality
  else if (modem?.link_status === 'offline') quality = 'offline'
  else if (
    modem &&
    Date.now() - Date.parse(modem.last_seen) > 2 * modem.uplink_interval_s * 1000 + 120_000
  )
    quality = 'stale'

  const cached = store.channelValues.get(t.channelId)
  const value =
    ov?.value !== undefined
      ? ov.value
      : (cached?.value ?? valueAt(t.tagId, t.code, t.levelCm, Date.now()))
  const tsM = cached?.ts ?? Date.now() - (modem ? modem.uplink_interval_s * 500 : 0)

  const ch = store.seed.channels.find((c) => c.id === t.channelId)
  if (ch) {
    ch.last_value = value
    ch.last_ts = iso(tsM)
  }
  return {
    tag_id: t.tagId,
    name:
      store.seed.bindings.find((b) => b.channel_id === t.channelId)?.display_name ??
      bindingName(t.tagId),
    post_id: t.postId,
    unit: paramByCode(t.code)?.unit ?? '',
    value,
    quality,
    kind: 'fact',
    origin: ov?.origin ?? 'live',
    ts_measured: iso(tsM),
    ts_received: iso(Date.now()),
  }
}

function forecastTagValue(): TagValueT {
  const f = store.seed.forecastTag
  return {
    tag_id: f.tagId,
    name: f.name,
    post_id: null,
    unit: f.unit,
    value: forecastAt(f.tagId, Date.now() + 3_600_000),
    quality: 'good',
    kind: 'forecast',
    origin: 'live',
    ts_measured: iso(Date.now() + 3_600_000),
    ts_received: iso(Date.now()),
  }
}

const STEP_MS: Record<string, number> = { '15m': 900_000, '1h': 3_600_000, '1d': 86_400_000 }

/** /tags/history: точки считаются генератором на лету (историю не храним) */
function seriesFor(
  tagId: string,
  from: number,
  to: number,
  stepMs: number,
  agg: string,
): Required<components['schemas']['Series']> {
  const parts = tagId.split('/')
  const isForecast = parts[0] === 'EXT0000000000001'
  const code = Number(parts[1])
  const level = Number(parts[2])
  const unit = isForecast ? store.seed.forecastTag.unit : (paramByCode(code)?.unit ?? '')
  const points: Array<[string, number, string]> = []
  for (let t = from; t <= to; t += stepMs) {
    if (agg === 'raw') {
      const v = isForecast ? forecastAt(tagId, t) : valueAt(tagId, code, level, t)
      points.push([iso(t), v, 'good'])
    } else {
      const sub = [0, 1, 2, 3].map((k) =>
        isForecast
          ? forecastAt(tagId, t + (k * stepMs) / 4)
          : valueAt(tagId, code, level, t + (k * stepMs) / 4),
      )
      const v =
        agg === 'avg'
          ? sub.reduce((a, b) => a + b, 0) / sub.length
          : agg === 'min'
            ? Math.min(...sub)
            : Math.max(...sub)
      points.push([iso(t), +v.toFixed(2), 'good'])
    }
  }
  return { tag_id: tagId, unit, points }
}

export const handlers = [
  // ── Авторизация ────────────────────────────────────────────────────────────
  http.post(BASE + '/auth/login', async ({ request }) => {
    const body = await jsonBody<{ login?: string; password?: string }>(request)
    const now = Date.now()
    if (now - store.loginFails.windowStart > 60_000)
      store.loginFails = { count: 0, windowStart: now }
    if (store.loginFails.count >= 5) {
      return err(429, 'RATE_LIMIT', 'Слишком много попыток, повторите через минуту')
    }
    if (body.login === DEMO_USER.login && body.password === DEMO_USER.password) {
      const token = 'mock-' + uuid()
      addSession(token)
      store.loginFails = { count: 0, windowStart: now }
      audit('user.login', 'user', String(DEMO_USER.id), { login: DEMO_USER.login })
      return HttpResponse.json({
        token,
        expires_at: iso(now + 8 * 3_600_000),
        user: { id: DEMO_USER.id, login: DEMO_USER.login },
      })
    }
    store.loginFails.count += 1
    store.loginFails.windowStart ||= now
    return err(401, 'UNAUTHORIZED', 'Неверный логин или пароль')
  }),

  http.post(BASE + '/auth/logout', ({ request }) => {
    const t = bearer(request)
    if (t) removeSession(t)
    return new HttpResponse(null, { status: 204 })
  }),

  // ── Справочники ────────────────────────────────────────────────────────────
  http.get(
    BASE + '/objects',
    ({ request }) => guard(request) ?? HttpResponse.json(store.seed.objects),
  ),

  http.put(BASE + '/objects/:id', async ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    const obj = store.seed.objects.find((o) => o.id === Number(params.id))
    if (!obj) return err(404, 'NOT_FOUND', 'Объект не найден')
    const body = await jsonBody<Partial<components['schemas']['Object']>>(request)
    audit('object.updated', 'object', String(obj.id), body, {
      name: obj.name,
      object_type: obj.object_type,
    })
    Object.assign(obj, body)
    return HttpResponse.json(obj)
  }),

  http.get(BASE + '/posts', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const oid = new URL(request.url).searchParams.get('object_id')
    const list = oid
      ? store.seed.posts.filter((p) => p.object_id === Number(oid))
      : store.seed.posts
    return HttpResponse.json(list)
  }),

  http.post(BASE + '/posts', async ({ request }) => {
    const g = guard(request)
    if (g) return g
    const body = await jsonBody<Partial<components['schemas']['Post']>>(request)
    const id = Math.max(0, ...store.seed.posts.map((p) => p.id)) + 1
    const post = {
      id,
      object_id: body.object_id ?? 1,
      name: body.name ?? `Пост ${id}`,
      plot_name: body.plot_name ?? '',
      lat: body.lat ?? 44.53,
      lon: body.lon ?? 33.7,
      scene_x: body.scene_x ?? null,
      scene_y: body.scene_y ?? null,
      worst_status: 'ok',
    } satisfies PostT
    store.seed.posts.push(post)
    audit('post.created', 'post', String(id), { name: post.name })
    return HttpResponse.json(post, { status: 201 })
  }),

  http.get(BASE + '/modems', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const oid = new URL(request.url).searchParams.get('object_id')
    const list = oid
      ? store.seed.modems.filter((m) => m.object_id === Number(oid))
      : store.seed.modems
    return HttpResponse.json(list)
  }),

  http.get(BASE + '/channels', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const q = new URL(request.url).searchParams
    let list = store.seed.channels
    const status = q.get('status')
    if (status) list = list.filter((c) => c.status === status)
    const eui = q.get('dev_eui')
    if (eui) list = list.filter((c) => c.dev_eui === eui)
    return HttpResponse.json(list)
  }),

  // ── Привязки ───────────────────────────────────────────────────────────────
  http.post(BASE + '/bindings', async ({ request }) => {
    const g = guard(request)
    if (g) return g
    const body = await jsonBody<components['schemas']['Binding']>(request)
    const ch = store.seed.channels.find((c) => c.id === body.channel_id)
    if (!ch) return err(404, 'NOT_FOUND', 'Канал не найден')
    const postId = Number(body.post_id)
    if (!Number.isFinite(postId) || !store.seed.posts.some((p) => p.id === postId)) {
      return err(404, 'NOT_FOUND', 'Пост не найден')
    }
    // Активная привязка канала закрывается (valid_to = now, контракт)
    const prev = store.seed.bindings.find((b) => b.channel_id === ch.id && b.valid_to === null)
    if (prev) (prev as { valid_to: string | null }).valid_to = touch()
    const id = Math.max(0, ...store.seed.bindings.map((b) => b.id)) + 1
    const binding = {
      id,
      channel_id: ch.id,
      post_id: postId,
      display_name: body.display_name ?? displayName(ch.param_code, ch.level_cm, ch.sensor_no),
      range_min: body.range_min ?? 0,
      range_max: body.range_max ?? 100,
      offset: body.offset ?? 0,
      factor: body.factor ?? 1,
      valid_from: touch(),
      valid_to: null,
    } satisfies Required<components['schemas']['Binding']>
    store.seed.bindings.push(binding)
    ch.status = 'assigned'
    const [, code, level, no] = ch.tag_id.split('/')
    if (!store.seed.tags.some((t) => t.tagId === ch.tag_id)) {
      store.seed.tags.push({
        tagId: ch.tag_id,
        channelId: ch.id,
        postId,
        code: Number(code),
        levelCm: Number(level),
        sensorNo: Number(no),
      })
    }
    audit('binding.created', 'binding', String(id), { channel: ch.tag_id, post: postId })
    return HttpResponse.json(binding, { status: 201 })
  }),

  // ── Теги ───────────────────────────────────────────────────────────────────
  http.get(BASE + '/tags/current', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const ids = (new URL(request.url).searchParams.get('ids') ?? '').split(',').filter(Boolean)
    const out: TagValueT[] = []
    for (const id of ids) {
      if (id === store.seed.forecastTag.tagId) {
        out.push(forecastTagValue())
        continue
      }
      const t = store.seed.tags.find((x) => x.tagId === id)
      if (t) out.push(tagValueFor(t))
    }
    return HttpResponse.json(out)
  }),

  http.get(BASE + '/tags/history', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const q = new URL(request.url).searchParams
    const ids = (q.get('ids') ?? '').split(',').filter(Boolean)
    if (ids.length === 0) return err(422, 'VALIDATION', 'Не указаны теги')
    if (ids.length > 8) return err(422, 'VALIDATION', 'Не более 8 тегов')
    const from = Date.parse(q.get('from') ?? '')
    const to = Date.parse(q.get('to') ?? '')
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
      return err(422, 'VALIDATION', 'Неверный период')
    }
    const agg = q.get('agg') ?? 'raw'
    const stepMs = STEP_MS[q.get('step') ?? '1h'] ?? 3_600_000
    return HttpResponse.json(ids.map((id) => seriesFor(id, from, to, stepMs, agg)))
  }),

  // ── Исполнители и команды ─────────────────────────────────────────────────
  http.get(BASE + '/actuators', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const oid = new URL(request.url).searchParams.get('object_id')
    const posts = oid
      ? new Set(store.seed.posts.filter((p) => p.object_id === Number(oid)).map((p) => p.id))
      : null
    const list = posts
      ? store.seed.actuators.filter((a) => posts.has(a.post_id))
      : store.seed.actuators
    return HttpResponse.json(list)
  }),

  http.put(BASE + '/actuators/:id/mode', async ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    const act = store.seed.actuators.find((a) => a.id === Number(params.id))
    if (!act) return err(404, 'NOT_FOUND', 'Устройство не найдено')
    const body = await jsonBody<{ mode?: string }>(request)
    if (body.mode !== 'auto' && body.mode !== 'manual') {
      return err(422, 'VALIDATION', 'mode должен быть auto или manual')
    }
    const before = act.mode
    act.mode = body.mode
    act.mode_changed_at = touch()
    audit('actuator.mode_changed', 'actuator', String(act.id), { mode: act.mode }, { mode: before })
    journalAdd('actuators', [act])
    return HttpResponse.json(act)
  }),

  http.post(BASE + '/commands', async ({ request }) => {
    const g = guard(request)
    if (g) return g
    const body = await jsonBody<components['schemas']['CommandCreate']>(request)
    if (!body.idempotency_key || !body.command_def_id) {
      return err(422, 'VALIDATION', 'Нужны command_def_id и idempotency_key')
    }
    try {
      const { cmd, replayed } = createCommand(
        body.command_def_id,
        body.idempotency_key,
        body.duration_s,
      )
      return HttpResponse.json(cmd, { status: replayed ? 200 : 201 })
    } catch (e) {
      if (e instanceof MockBusinessError) return bizError(e)
      throw e
    }
  }),

  http.get(BASE + '/commands', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const q = new URL(request.url).searchParams
    const actId = q.get('actuator_id')
    const limit = Number(q.get('limit') ?? 20)
    let list = [...store.commands].reverse()
    if (actId) {
      const defIds = new Set(
        store.seed.commandDefs.filter((d) => d.actuator_id === Number(actId)).map((d) => d.id),
      )
      list = list.filter((c) => defIds.has(c.command_def_id))
    }
    return HttpResponse.json(list.slice(0, limit))
  }),

  http.get(BASE + '/commands/:uuid', ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    const cmd = store.commands.find((c) => c.uuid === params.uuid)
    return cmd ? HttpResponse.json(cmd) : err(404, 'NOT_FOUND', 'Команда не найдена')
  }),

  http.post(BASE + '/commands/:uuid/confirm', ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    try {
      return HttpResponse.json(confirmCommand(String(params.uuid)))
    } catch (e) {
      if (e instanceof MockBusinessError) return bizError(e)
      throw e
    }
  }),

  http.post(BASE + '/commands/:uuid/cancel', ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    try {
      return HttpResponse.json(cancelCommand(String(params.uuid)))
    } catch (e) {
      if (e instanceof MockBusinessError) return bizError(e)
      throw e
    }
  }),

  // ── Правила ────────────────────────────────────────────────────────────────
  http.get(BASE + '/rules', ({ request }) => guard(request) ?? HttpResponse.json(store.seed.rules)),

  http.post(BASE + '/rules', async ({ request }) => {
    const g = guard(request)
    if (g) return g
    const body = await jsonBody<Partial<components['schemas']['Rule']>>(request)
    const id = Math.max(0, ...store.seed.rules.map((r) => r.id)) + 1
    const rule = {
      id,
      name: body.name ?? `Правило ${id}`,
      condition: body.condition ?? {},
      action: body.action ?? {},
      hysteresis: body.hysteresis ?? 0,
      min_pause_s: body.min_pause_s ?? 0,
      on_no_data: body.on_no_data ?? 'skip',
      fallback_schedule_id: body.fallback_schedule_id ?? null,
      enabled: body.enabled ?? false,
      approval_status: 'pending',
      last_fired_at: null,
    } as unknown as RuleT
    store.seed.rules.push(rule)
    audit('rule.created', 'rule', String(id), { name: rule.name })
    return HttpResponse.json(rule, { status: 201 })
  }),

  http.put(BASE + '/rules/:id', async ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    const rule = store.seed.rules.find((r) => r.id === Number(params.id))
    if (!rule) return err(404, 'NOT_FOUND', 'Правило не найдено')
    const body = await jsonBody<Partial<components['schemas']['Rule']>>(request)
    Object.assign(rule, body)
    rule.approval_status = 'pending' // изменение сбрасывает утверждение (контракт)
    audit('rule.updated', 'rule', String(rule.id), { approval_status: 'pending' })
    return HttpResponse.json(rule)
  }),

  http.post(BASE + '/rules/:id/approve', ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    const rule = store.seed.rules.find((r) => r.id === Number(params.id))
    if (!rule) return err(404, 'NOT_FOUND', 'Правило не найдено')
    rule.approval_status = 'approved'
    audit(
      'rule.approved',
      'rule',
      String(rule.id),
      { approval_status: 'approved' },
      { approval_status: 'pending' },
    )
    return HttpResponse.json(rule)
  }),

  // ── Расписания ─────────────────────────────────────────────────────────────
  http.get(
    BASE + '/schedules',
    ({ request }) => guard(request) ?? HttpResponse.json(store.seed.schedules),
  ),

  http.post(BASE + '/schedules', async ({ request }) => {
    const g = guard(request)
    if (g) return g
    const body = await jsonBody<Partial<components['schemas']['Schedule']>>(request)
    const id = Math.max(0, ...store.seed.schedules.map((s) => s.id)) + 1
    const sch: components['schemas']['Schedule'] & { warnings?: string[] } = {
      id,
      command_def_id: body.command_def_id ?? 1,
      time: body.time ?? '06:00',
      days: body.days ?? [1, 2, 3, 4, 5, 6, 7],
      duration_s: body.duration_s ?? 1800,
      enabled: body.enabled ?? false,
      approval_status: 'pending',
    }
    // Пересечение на одном выходе — предупреждение при сохранении (контракт)
    const sameOutput = store.seed.schedules.filter((s) => {
      const a1 = store.seed.commandDefs.find((d) => d.id === s.command_def_id)?.actuator_id
      const a2 = store.seed.commandDefs.find((d) => d.id === sch.command_def_id)?.actuator_id
      return a1 === a2 && (s.days?.some((d) => sch.days?.includes(d) ?? false) ?? false)
    })
    if (sameOutput.length) sch.warnings = ['OVERLAP']
    store.seed.schedules.push(sch as unknown as ScheduleT)
    audit('schedule.created', 'schedule', String(id), { time: sch.time })
    return HttpResponse.json(sch, { status: 201 })
  }),

  http.post(BASE + '/schedules/:id/approve', ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    const sch = store.seed.schedules.find((s) => s.id === Number(params.id))
    if (!sch) return err(404, 'NOT_FOUND', 'Расписание не найдено')
    sch.approval_status = 'approved'
    audit(
      'schedule.approved',
      'schedule',
      String(sch.id),
      { approval_status: 'approved' },
      { approval_status: 'pending' },
    )
    return HttpResponse.json(sch)
  }),

  // ── Тревоги ────────────────────────────────────────────────────────────────
  http.get(BASE + '/alarms', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const q = new URL(request.url).searchParams
    let list = store.seed.alarms
    const st = q.get('state')
    if (st) {
      const set = new Set(st.split(','))
      list = list.filter((a) => set.has(a.state))
    }
    const pr = q.get('priority')
    if (pr) {
      const set = new Set(pr.split(','))
      list = list.filter((a) => set.has(String(a.priority)))
    }
    const oid = q.get('object_id')
    if (oid) list = list.filter((a) => a.object_id === Number(oid))
    return HttpResponse.json(list)
  }),

  http.post(BASE + '/alarms/:id/ack', ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    const a = store.seed.alarms.find((x) => x.id === Number(params.id))
    if (!a) return err(404, 'NOT_FOUND', 'Тревога не найдена')
    if (a.state === 'active_unacked') a.state = 'active_acked'
    else if (a.state === 'cleared_unacked') a.state = 'closed'
    else return HttpResponse.json(a)
    a.acked_by = 'demo'
    a.acked_at = touch()
    audit('alarm.acked', 'alarm', String(a.id), { state: a.state }, { state: 'active_unacked' })
    journalAdd('alarms', [a])
    return HttpResponse.json(a)
  }),

  // ── Обновления ─────────────────────────────────────────────────────────────
  http.get(BASE + '/updates', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const since = new URL(request.url).searchParams.get('since')
    if (!since) return err(422, 'VALIDATION', 'Нужен параметр since')
    const buckets = journalSince(since)
    return HttpResponse.json({
      ...buckets,
      client_flags: { sim_mode: store.simMode },
    })
  }),

  // ── Дашборды ───────────────────────────────────────────────────────────────
  http.get(BASE + '/dashboards', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const oid = new URL(request.url).searchParams.get('object_id')
    // сохранённые layout (D-30) поверх seed
    const overrides = readDashboardOverrides()
    const list = store.seed.dashboards.map((d) =>
      overrides[String(d.id)] != null ? { ...d, layout: overrides[String(d.id)] } : d,
    )
    const filtered = oid ? list.filter((d) => d.object_id === Number(oid)) : list
    return HttpResponse.json(filtered)
  }),

  http.post(BASE + '/dashboards', async ({ request }) => {
    const g = guard(request)
    if (g) return g
    const body = await jsonBody<Partial<components['schemas']['Dashboard']>>(request)
    const id = Math.max(0, ...store.seed.dashboards.map((d) => d.id)) + 1
    const d = {
      id,
      object_id: body.object_id ?? 1,
      name: body.name ?? `Дашборд ${id}`,
      layout: body.layout ?? [],
    } as unknown as DashboardT
    store.seed.dashboards.push(d)
    audit('dashboard.created', 'dashboard', String(id), { name: d.name })
    return HttpResponse.json(d, { status: 201 })
  }),

  http.put(BASE + '/dashboards/:id', async ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    const d = store.seed.dashboards.find((x) => x.id === Number(params.id))
    if (!d) return err(404, 'NOT_FOUND', 'Дашборд не найден')
    const body = await jsonBody<Partial<components['schemas']['Dashboard']>>(request)
    audit(
      'dashboard.updated',
      'dashboard',
      String(d.id),
      { name: body.name ?? d.name },
      { name: d.name },
    )
    Object.assign(d, body)
    if (body.layout != null) writeDashboardOverride(d.id, body.layout)
    return HttpResponse.json(d)
  }),

  // ── Настройки ──────────────────────────────────────────────────────────────
  http.get(BASE + '/settings/:section', ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    const s = store.seed
    switch (String(params.section)) {
      case 'command_defs':
        return HttpResponse.json(s.commandDefs)
      case 'alarm_defs':
        return HttpResponse.json(s.alarmDefs)
      case 'chains':
        return HttpResponse.json(s.chains)
      case 'channels':
        return HttpResponse.json(s.notifyChannels)
      case 'client':
        return HttpResponse.json(s.client)
      case 'param_dict':
        return HttpResponse.json(PARAM_DICT)
      case 'actuators':
        return HttpResponse.json(s.actuators)
      default:
        return err(404, 'NOT_FOUND', 'Неизвестный раздел настроек')
    }
  }),

  http.put(BASE + '/settings/:section', async ({ request, params }) => {
    const g = guard(request)
    if (g) return g
    if (params.section === 'client') {
      const body = await jsonBody<Record<string, unknown>>(request)
      // BR-FE-6: флаг симулятора из настроек не принимается — только бэкенд
      delete body.sim_mode
      Object.assign(store.seed.client, body)
      audit('settings.updated', 'settings', 'client', body)
    }
    return new HttpResponse(null, { status: 200 })
  }),

  // ── Журнал ─────────────────────────────────────────────────────────────────
  http.get(BASE + '/audit', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const q = new URL(request.url).searchParams
    let list = [...store.seed.audit].reverse()
    const from = q.get('from')
    if (from) list = list.filter((e) => e.ts >= from)
    const to = q.get('to')
    if (to) list = list.filter((e) => e.ts <= to)
    const entity = q.get('entity')
    if (entity) list = list.filter((e) => e.entity === entity)
    const actor = q.get('actor')
    if (actor) list = list.filter((e) => e.actor === actor)
    const offset = Number(q.get('offset') ?? 0)
    const limit = Number(q.get('limit') ?? 100)
    return HttpResponse.json(list.slice(offset, offset + limit))
  }),

  // ── Экспорт ────────────────────────────────────────────────────────────────
  http.get(BASE + '/export', ({ request }) => {
    const g = guard(request)
    if (g) return g
    const q = new URL(request.url).searchParams
    const ids = (q.get('ids') ?? '').split(',').filter(Boolean)
    const from = Date.parse(q.get('from') ?? '')
    const to = Date.parse(q.get('to') ?? '')
    if (!ids.length || !Number.isFinite(from) || !Number.isFinite(to)) {
      return err(422, 'VALIDATION', 'Нужны ids, from и to')
    }
    const series = ids.map((id) => seriesFor(id, from, to, 3_600_000, 'raw'))
    const header = ['ts', ...ids].join(';')
    const rows: string[] = []
    const len = Math.max(0, ...series.map((s) => s.points.length))
    for (let i = 0; i < len; i++) {
      const cells = series.map((s) => String(s.points[i]?.[1] ?? ''))
      rows.push([series[0]?.points[i]?.[0] ?? '', ...cells].join(';'))
    }
    return new HttpResponse([header, ...rows].join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    })
  }),
]
