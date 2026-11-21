import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { server } from './node'
import { applyScenario } from './scenarios'
import { store } from './store'
import { installVirtualClock } from './virtualClock'

/*
 * Жизненный цикл команд мока (08_BACKEND_HANDOFF §3, приёмка T04).
 * Времена управляются vi.useFakeTimers: движок кладёт таймеры на setTimeout.
 */

let token = ''

async function req(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(`/webhook${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function login(): Promise<void> {
  const res = await fetch('/webhook/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'demo', password: 'demo' }),
  })
  token = ((await res.json()) as { token: string }).token
}

async function cmdStatus(uuid: string): Promise<string> {
  const res = await req('GET', `/commands/${uuid}`)
  return ((await res.json()) as { status: string }).status
}

const clock = installVirtualClock()

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

afterAll(() => {
  server.close()
})

afterEach(() => {
  applyScenario('normal')
})

describe('команды: счастливый путь (насос, политика always)', () => {
  it('создание → подтверждение → queued → sent_gw → acked → completed', async () => {
    applyScenario('normal')
    await login()

    const created = await req('POST', '/commands', {
      command_def_id: 1, // насос on, policy always → awaiting_confirm
      duration_s: 1800,
      idempotency_key: 'cmd-happy-1',
    })
    expect(created.status).toBe(201)
    const cmd = (await created.json()) as { uuid: string; status: string; duration_s: number }
    expect(cmd.status).toBe('awaiting_confirm')

    const confirmed = await req('POST', `/commands/${cmd.uuid}/confirm`)
    expect(((await confirmed.json()) as { status: string }).status).toBe('queued')

    await clock.advance(2_100) // класс C: queued → sent_gw
    expect(await cmdStatus(cmd.uuid)).toBe('sent_gw')

    await clock.advance(3_100) // sent_gw → acked
    expect(await cmdStatus(cmd.uuid)).toBe('acked')

    // 1800 с ×60 → 30 с до completed; факт устройства включён
    await clock.advance(30_000)
    expect(await cmdStatus(cmd.uuid)).toBe('completed')

    const acts = (await (await req('GET', '/actuators')).json()) as Array<{
      id: number
      fact_state: string
    }>
    expect(acts.find((a) => a.id === 1)?.fact_state).toBe('on')

    // всё отражается в /updates
    const upd = await req('GET', `/updates?since=2020-01-01T00:00:00+03:00`)
    const body = (await upd.json()) as { commands: unknown[]; actuators: unknown[] }
    expect(body.commands.length).toBeGreaterThan(0)
    expect(body.actuators.length).toBeGreaterThan(0)
  })
})

describe('проверки создания команд', () => {
  it('on без длительности подставляет default (600 с насоса)', async () => {
    const res = await req('POST', '/commands', {
      command_def_id: 1,
      idempotency_key: 'cmd-default-1',
    })
    const cmd = (await res.json()) as { uuid: string; duration_s: number; status: string }
    expect(cmd.duration_s).toBe(600)
    await req('POST', `/commands/${cmd.uuid}/cancel`)
  })

  it('длительность больше максимума — 422 DURATION_OVER_MAX без урезания', async () => {
    const res = await req('POST', '/commands', {
      command_def_id: 1,
      duration_s: 20_000,
      idempotency_key: 'cmd-over-1',
    })
    expect(res.status).toBe(422)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('DURATION_OVER_MAX')
  })

  it('повтор idempotency_key возвращает ту же команду (200)', async () => {
    const first = (await (
      await req('POST', '/commands', { command_def_id: 2, idempotency_key: 'cmd-idem-1' })
    ).json()) as { uuid: string }
    const second = await req('POST', '/commands', {
      command_def_id: 2,
      idempotency_key: 'cmd-idem-1',
    })
    expect(second.status).toBe(200)
    expect(((await second.json()) as { uuid: string }).uuid).toBe(first.uuid)
  })

  it('off — без подтверждения сразу queued', async () => {
    const res = await req('POST', '/commands', { command_def_id: 2, idempotency_key: 'cmd-off-1' })
    expect(((await res.json()) as { status: string }).status).toBe('queued')
  })
})

describe('сбои команд', () => {
  it('потеря ack → timeout через 12 с', async () => {
    store.fail.loseAck = true
    const cmd = (await (
      await req('POST', '/commands', {
        command_def_id: 1,
        duration_s: 600,
        idempotency_key: 'cmd-to-1',
      })
    ).json()) as { uuid: string }
    await req('POST', `/commands/${cmd.uuid}/confirm`)
    await clock.advance(2_100)
    await clock.advance(12_000)
    expect(await cmdStatus(cmd.uuid)).toBe('timeout')
  })

  it('модем offline → MODEM_OFFLINE, cancelled по TTL (30 мин → 30 с при ×60)', async () => {
    const m = store.seed.modems.find((x) => x.dev_eui === '70B3D58FF0031A0D')
    m!.link_status = 'offline'
    const res = await req('POST', '/commands', {
      command_def_id: 1,
      duration_s: 600,
      idempotency_key: 'cmd-offline-1',
    })
    const cmd = (await res.json()) as {
      uuid: string
      warnings: string[]
      expires_at: string | null
    }
    expect(cmd.warnings).toContain('MODEM_OFFLINE')
    expect(cmd.expires_at).toBeTruthy()
    // политика always: сначала подтверждение, затем очередь с TTL (§3.1 п.4, п.6)
    expect(await cmdStatus(cmd.uuid)).toBe('awaiting_confirm')
    await req('POST', `/commands/${cmd.uuid}/confirm`)
    expect(await cmdStatus(cmd.uuid)).toBe('queued')

    await clock.advance(31_000)
    expect(await cmdStatus(cmd.uuid)).toBe('cancelled')
  })

  it('result_code=1 → rejected', async () => {
    store.fail.rejectResult = true
    const cmd = (await (
      await req('POST', '/commands', {
        command_def_id: 1,
        duration_s: 600,
        idempotency_key: 'cmd-rej-1',
      })
    ).json()) as { uuid: string }
    await req('POST', `/commands/${cmd.uuid}/confirm`)
    await clock.advance(2_100)
    await clock.advance(3_100)
    expect(await cmdStatus(cmd.uuid)).toBe('rejected')
  })
})

describe('замещение и отмена', () => {
  it('новая команда того же устройства гасит прежнюю неотправленную (superseded)', async () => {
    const c1 = (await (
      await req('POST', '/commands', {
        command_def_id: 1,
        duration_s: 600,
        idempotency_key: 'cmd-sup-1',
      })
    ).json()) as { uuid: string }
    await req('POST', `/commands/${c1.uuid}/confirm`)
    const c2 = (await (
      await req('POST', '/commands', { command_def_id: 2, idempotency_key: 'cmd-sup-2' })
    ).json()) as { uuid: string }
    expect(await cmdStatus(c1.uuid)).toBe('superseded')
    expect(await cmdStatus(c2.uuid)).toBe('queued')
  })

  it('cancel из awaiting_confirm → cancelled; повторный confirm — 422', async () => {
    const c = (await (
      await req('POST', '/commands', {
        command_def_id: 1,
        duration_s: 600,
        idempotency_key: 'cmd-cxl-1',
      })
    ).json()) as { uuid: string }
    await req('POST', `/commands/${c.uuid}/cancel`)
    expect(await cmdStatus(c.uuid)).toBe('cancelled')
    const again = await req('POST', `/commands/${c.uuid}/confirm`)
    expect(again.status).toBe(422)
  })
})
