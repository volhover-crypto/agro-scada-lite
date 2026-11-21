import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { load as yamlLoad } from 'js-yaml'
import { applyScenario } from './scenarios'
import { server } from './node'

/*
 * Приёмка T04 (04_MOCK_SPEC §7.1): ответы мока по всем путям контракта
 * сверяются со схемами 03_API_CONTRACT.yaml. Тот же файл потом прогоняется
 * против стенда бэкенда (09 B3): TEST_API_BASE заменяет базу.
 */

const API_BASE = process.env.TEST_API_BASE ?? ''

// ── Загрузка контракта и разбор $ref → обычные JSON-схемы ────────────────────

type Node = Record<string, unknown>

function deref(node: unknown, root: Node): unknown {
  if (Array.isArray(node)) return node.map((n) => deref(n, root))
  if (node === null || typeof node !== 'object') return node
  const obj = node as Node
  if (typeof obj.$ref === 'string') {
    const path = obj.$ref.replace(/^#\//, '').split('/')
    let cur: unknown = root
    for (const p of path) cur = (cur as Node)[p]
    return deref(cur, root)
  }
  const out: Node = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'example' || k === 'description' || k === 'default' || k === 'readOnly') continue
    out[k] = deref(v, root)
  }
  // OpenAPI 3.0 nullable → union с null для ajv
  if (out.nullable === true) {
    delete out.nullable
    const base = { ...out }
    delete base.type
    out.anyOf = [
      base,
      typeof out.type === 'string' ? { type: [out.type, 'null'] } : { type: 'null' },
    ]
    delete out.type
  }
  return out
}

const contract = yamlLoad(
  readFileSync(resolve(process.cwd(), 'contract/03_API_CONTRACT.yaml'), 'utf-8'),
) as Node
const ajv = new Ajv({ strict: false, allErrors: true })
addFormats(ajv)

function responseSchema(path: string, method: string, status: number): Node | null {
  const item = (contract.paths as Node)[path] as Node | undefined
  const op = item?.[method] as Node | undefined
  const responses = op?.responses as Node | undefined
  const resp = responses?.[String(status)] as Node | undefined
  const json = (resp?.content as Node | undefined)?.['application/json'] as Node | undefined
  return (json?.schema as Node | undefined) ?? null
}

function validate(path: string, method: string, status: number, body: unknown): string[] {
  const raw = responseSchema(path, method, status)
  if (!raw) return []
  const schema = deref(raw, contract) as Node
  if (!ajv.validate(schema as object, body)) {
    return (ajv.errors ?? []).map((e) => `${e.instancePath} ${e.message ?? ''}`)
  }
  return []
}

// ── HTTP поверх MSW-node ──────────────────────────────────────────────────────

let token = ''

async function req(method: string, path: string, body?: unknown, auth = true): Promise<Response> {
  const headers: Record<string, string> = {}
  if (auth && token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(`${API_BASE}/webhook${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

interface Case {
  name: string
  method: string
  path: string
  contractPath: string
  status: number
  body?: unknown
  /** Схема ответа в контракте — type: object, а раздел описан как «Массив/объект»
   *  (BR-FE-4): проверяем ослабленно */
  loose?: boolean
}

const tagA = '70B3D58FF0031A01/1/150/1'
const from = '2026-11-20T00:00:00+03:00'
const to = '2026-11-21T00:00:00+03:00'

const CASES: Case[] = [
  { name: 'объекты', method: 'get', path: '/objects', contractPath: '/objects', status: 200 },
  { name: 'посты', method: 'get', path: '/posts?object_id=1', contractPath: '/posts', status: 200 },
  {
    name: 'модемы',
    method: 'get',
    path: '/modems?object_id=1',
    contractPath: '/modems',
    status: 200,
  },
  {
    name: 'каналы unassigned',
    method: 'get',
    path: '/channels?status=unassigned',
    contractPath: '/channels',
    status: 200,
  },
  {
    name: 'текущие значения',
    method: 'get',
    path: `/tags/current?ids=${tagA}`,
    contractPath: '/tags/current',
    status: 200,
  },
  {
    name: 'история',
    method: 'get',
    path: `/tags/history?ids=${tagA}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    contractPath: '/tags/history',
    status: 200,
  },
  {
    name: 'исполнители',
    method: 'get',
    path: '/actuators?object_id=1',
    contractPath: '/actuators',
    status: 200,
  },
  {
    name: 'список команд',
    method: 'get',
    path: '/commands?limit=5',
    contractPath: '/commands',
    status: 200,
  },
  { name: 'правила', method: 'get', path: '/rules', contractPath: '/rules', status: 200 },
  {
    name: 'расписания',
    method: 'get',
    path: '/schedules',
    contractPath: '/schedules',
    status: 200,
  },
  { name: 'тревоги', method: 'get', path: '/alarms', contractPath: '/alarms', status: 200 },
  {
    name: 'обновления',
    method: 'get',
    path: `/updates?since=${encodeURIComponent(from)}`,
    contractPath: '/updates',
    status: 200,
  },
  {
    name: 'дашборды',
    method: 'get',
    path: '/dashboards?object_id=1',
    contractPath: '/dashboards',
    status: 200,
  },
  {
    name: 'настройки command_defs',
    method: 'get',
    path: '/settings/command_defs',
    contractPath: '/settings/{section}',
    status: 200,
    loose: true,
  },
  {
    name: 'настройки param_dict',
    method: 'get',
    path: '/settings/param_dict',
    contractPath: '/settings/{section}',
    status: 200,
    loose: true,
  },
  { name: 'журнал', method: 'get', path: '/audit', contractPath: '/audit', status: 200 },
  {
    name: 'создание команды',
    method: 'post',
    path: '/commands',
    contractPath: '/commands',
    status: 201,
    body: { command_def_id: 1, duration_s: 600, idempotency_key: 'schema-1' },
  },
  {
    name: 'создание правила',
    method: 'post',
    path: '/rules',
    contractPath: '/rules',
    status: 201,
    body: {
      name: 'Тестовое',
      condition: { tag_id: tagA, op: '<', value: 10 },
      action: { command_def_id: 3, duration_s: 600 },
    },
  },
  {
    name: 'создание расписания',
    method: 'post',
    path: '/schedules',
    contractPath: '/schedules',
    status: 201,
    body: { command_def_id: 3, time: '07:30', days: [1, 2], duration_s: 600 },
  },
]

beforeAll(async () => {
  server.listen({ onUnhandledFrame: 'error' })
  applyScenario('normal')
  const res = await req('post', '/auth/login', { login: 'demo', password: 'demo' }, false)
  token = ((await res.json()) as { token: string }).token
})

afterAll(() => server.close())

describe('мок соответствует контракту', () => {
  it.each(CASES)('$name', async (c) => {
    const res = await req(c.method, c.path, c.body)
    expect(res.status, `${c.method} ${c.path}`).toBe(c.status)
    const body = await res.json()
    if (c.loose) {
      expect(body, c.name).toSatisfy((b: unknown) => Array.isArray(b) || typeof b === 'object')
      return
    }
    const problems = validate(c.contractPath, c.method, c.status, body)
    expect(problems, problems.join('; ')).toEqual([])
  })
})

describe('авторизация', () => {
  it('без токена — 401 с телом Error', async () => {
    const res = await fetch(`${API_BASE}/webhook/objects`)
    expect(res.status).toBe(401)
    const problems = validate('/objects', 'get', 401, await res.json())
    expect(problems).toEqual([])
  })

  it('demo/demo входит, неверный пароль — 401', async () => {
    const ok = await req('post', '/auth/login', { login: 'demo', password: 'demo' }, false)
    expect(ok.status).toBe(200)
    const bad = await req('post', '/auth/login', { login: 'demo', password: 'no' }, false)
    expect(bad.status).toBe(401)
  })

  it('5 неудач → RATE_LIMIT', async () => {
    for (let i = 0; i < 5; i++)
      await req('post', '/auth/login', { login: 'x', password: 'y' }, false)
    const res = await req('post', '/auth/login', { login: 'x', password: 'y' }, false)
    expect(res.status).toBe(429)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('RATE_LIMIT')
  })
})

describe('экспорт CSV', () => {
  it('отдаёт text/csv', async () => {
    const res = await req(
      'get',
      `/export?ids=${tagA}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    const text = await res.text()
    expect(text.split('\n')[0]).toContain('ts')
  })
})
