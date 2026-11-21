import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { server } from './node'
import { applyScenario, SCENARIOS } from './scenarios'
import { store } from './store'
import { installVirtualClock } from './virtualClock'

/*
 * Приёмка T04 (04_MOCK_SPEC §7.3): все 8 сценариев воспроизводимы.
 * Ожидаемый вид UI описан в docs/MOCK_SCENARIOS.md.
 */

let token = ''

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/webhook${path}`, { headers: { Authorization: `Bearer ${token}` } })
  return (await res.json()) as T
}

const clock = installVirtualClock()

beforeAll(async () => {
  server.listen({ onUnhandledFrame: 'error' })
  applyScenario('normal')
  const res = await fetch('/webhook/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'demo', password: 'demo' }),
  })
  token = ((await res.json()) as { token: string }).token
})

afterAll(() => {
  server.close()
})

describe('переключение всех 8 сценариев', () => {
  it('список сценариев полный', () => {
    expect([...SCENARIOS]).toEqual([
      'normal',
      'quality',
      'pressure_drop',
      'link_loss',
      'cmd_fail',
      'manual_mode',
      'onboarding',
      'empty',
    ])
  })

  it('normal: 2 объекта, 15 постов, 15 модемов, 1 тревога P3', async () => {
    applyScenario('normal')
    expect((await get<unknown[]>('/objects')).length).toBe(2)
    expect((await get<unknown[]>('/posts')).length).toBe(15)
    expect((await get<unknown[]>('/modems')).length).toBe(15)
    const alarms = await get<Array<{ priority: number; state: string }>>('/alarms')
    expect(alarms).toHaveLength(1)
    expect(alarms[0]).toMatchObject({ priority: 3, state: 'active_unacked' })
  })

  it('quality: все виды качества доступны в /tags/current', async () => {
    applyScenario('quality')
    const allIds = [...store.seed.tags.map((t) => t.tagId), store.seed.forecastTag.tagId].join(',')
    const tags = await get<Array<{ tag_id: string; quality: string; origin: string }>>(
      `/tags/current?ids=${encodeURIComponent(allIds)}`,
    )
    const qualities = new Set(tags.map((t) => t.quality))
    for (const q of ['stale', 'offline', 'out_of_range', 'sensor_error', 'sim', 'good']) {
      expect(qualities, q).toContain(q)
    }
    expect(tags.some((t) => t.origin === 'backlog')).toBe(true)
    const upd = await get<{ client_flags: { sim_mode: boolean } }>(
      `/updates?since=2020-01-01T00:00:00+03:00`,
    )
    expect(upd.client_flags.sim_mode).toBe(true)
  })

  it('pressure_drop: P1 через 20 с, эскалация 1 и 2', async () => {
    applyScenario('pressure_drop')
    await clock.advance(21_000)
    let alarms =
      await get<
        Array<{ priority: number; state: string; escalation_step: number; message: string }>
      >('/alarms')
    const p1 = alarms.find((a) => a.priority === 1)
    expect(p1?.state).toBe('active_unacked')
    expect(p1?.message).toContain('Давление 1,2')

    await clock.advance(20_000)
    alarms =
      await get<
        Array<{ priority: number; state: string; escalation_step: number; message: string }>
      >('/alarms')
    expect(alarms.find((a) => a.priority === 1)?.escalation_step).toBe(1)

    await clock.advance(20_000)
    alarms =
      await get<
        Array<{ priority: number; state: string; escalation_step: number; message: string }>
      >('/alarms')
    expect(alarms.find((a) => a.priority === 1)?.escalation_step).toBe(2)
  })

  it('link_loss: 4 модема offline, их теги stale', async () => {
    applyScenario('link_loss')
    const modems = await get<Array<{ link_status: string }>>('/modems')
    expect(modems.filter((m) => m.link_status === 'offline')).toHaveLength(4)
    const offTag = store.seed.tags.find((t) => t.tagId.startsWith('70B3D58FF0031A03'))!
    const tags = await get<Array<{ tag_id: string; quality: string }>>(
      `/tags/current?ids=${offTag.tagId}`,
    )
    expect(tags[0]?.quality).toBe('stale')
    const alarms = await get<Array<{ type: string; priority: number }>>('/alarms')
    expect(alarms.some((a) => a.type === 'link' && a.priority === 2)).toBe(true)
  })

  it('cmd_fail: все команды завершаются timeout', async () => {
    applyScenario('cmd_fail')
    expect(store.fail.loseAck).toBe(true)
    const res = await fetch('/webhook/commands', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command_def_id: 1, duration_s: 600, idempotency_key: 'scen-fail-1' }),
    })
    const cmd = (await res.json()) as { uuid: string }
    await fetch(`/webhook/commands/${cmd.uuid}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    await clock.advance(2_100)
    await clock.advance(12_000)
    const after = await get<{ status: string }>(`/commands/${cmd.uuid}`)
    expect(after.status).toBe('timeout')
  })

  it('manual_mode: клапан 2 в ручном режиме, в журнале schedule.skipped', async () => {
    applyScenario('manual_mode')
    const acts = await get<Array<{ id: number; mode: string }>>('/actuators')
    expect(acts.find((a) => a.id === 3)?.mode).toBe('manual')
    const audit = await get<Array<{ event: string; actor: string }>>('/audit?entity=schedule')
    expect(audit.some((e) => e.event === 'schedule.skipped')).toBe(true)
  })

  it('onboarding: у нового модема 4 неназначенных канала (всего 6 с базовыми)', async () => {
    applyScenario('onboarding')
    const chans = await get<Array<{ status: string; dev_eui: string }>>(
      '/channels?status=unassigned',
    )
    expect(chans).toHaveLength(6)
    expect(chans.filter((c) => c.dev_eui === '70B3D58FF0031A10')).toHaveLength(4)
    const modems = await get<unknown[]>('/modems')
    expect(modems).toHaveLength(16)
  })

  it('empty: объектов нет', async () => {
    applyScenario('empty')
    expect(await get<unknown[]>('/objects')).toEqual([])
    expect(await get<unknown[]>('/alarms')).toEqual([])
  })

  it('каждый сценарий возвращает store к согласованному состоянию', () => {
    for (const name of SCENARIOS) {
      applyScenario(name)
      expect(store.scenario, name).toBe(name)
      expect(store.journal.length, name).toBeGreaterThanOrEqual(0)
    }
    applyScenario('normal')
    expect(store.seed.objects).toHaveLength(2)
  })
})
