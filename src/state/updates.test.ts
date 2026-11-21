import { afterEach, describe, expect, it } from 'vitest'
import { queryClient } from '@/api/queryClient'
import {
  applyUpdates,
  pickInterval,
  trackCommands,
  UPDATES_INTERVAL_MS,
  FAST_INTERVAL_MS,
} from './updates'

// Приёмка T06: раскладка /updates в кэш и выбор интервала (02 §3)

afterEach(() => queryClient.clear())

describe('applyUpdates', () => {
  it('раскладывает теги, команды, тревоги, исполнителей и модемы в кэш', () => {
    applyUpdates({
      server_ts: '2026-11-21T12:00:00+03:00',
      tags: [{ tag_id: 'A/1/0/1', value: 5 } as never],
      commands: [{ uuid: 'u1', status: 'queued' } as never],
      alarms: [{ id: 1, state: 'active_unacked' } as never],
      actuators: [{ id: 1, fact_state: 'on' } as never],
      modems: [{ dev_eui: 'M1', link_status: 'online' } as never],
      client_flags: { sim_mode: true },
    })

    expect(queryClient.getQueryData(['tag', 'A/1/0/1'])).toMatchObject({ tag_id: 'A/1/0/1' })
    expect(queryClient.getQueryData(['commands'])).toMatchObject([{ uuid: 'u1' }])
    expect(queryClient.getQueryData(['alarms'])).toMatchObject([{ id: 1 }])
    expect(queryClient.getQueryData(['actuators'])).toMatchObject([{ id: 1 }])
    expect(queryClient.getQueryData(['modems'])).toMatchObject([{ dev_eui: 'M1' }])
  })

  it('повторные ответы сливаются по идентификатору, а не дублируются', () => {
    applyUpdates({ server_ts: 't1', alarms: [{ id: 1, state: 'active_unacked' } as never] })
    applyUpdates({
      server_ts: 't2',
      alarms: [{ id: 1, state: 'active_acked' } as never, { id: 2 } as never],
    })

    const alarms = queryClient.getQueryData<Array<{ id: number; state?: string }>>(['alarms'])!
    expect(alarms).toHaveLength(2)
    expect(alarms.find((a) => a.id === 1)?.state).toBe('active_acked')
  })
})

describe('интервал опроса', () => {
  it('без активных команд — 30 с, с активной — 5 с', () => {
    expect(pickInterval([])).toBe(UPDATES_INTERVAL_MS)
    expect(pickInterval(['completed'])).toBe(UPDATES_INTERVAL_MS)
    expect(pickInterval(['acked', 'queued'])).toBe(FAST_INTERVAL_MS)
  })

  it('trackCommands гасит команду при терминальном статусе', () => {
    const tracked = new Map<string, string>()
    trackCommands(tracked, [{ uuid: 'u1', status: 'queued' } as never])
    expect(tracked.get('u1')).toBe('queued')
    trackCommands(tracked, [{ uuid: 'u1', status: 'acked' } as never])
    expect(tracked.has('u1')).toBe(false)
  })
})
