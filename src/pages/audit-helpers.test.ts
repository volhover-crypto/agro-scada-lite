import { describe, expect, it } from 'vitest'
import type { components } from '@/api/types.gen'
import {
  diffText,
  entityText,
  eventText,
  hasNextPage,
  periodBounds,
  wasNowText,
} from './audit-helpers'

type AuditEntryT = components['schemas']['AuditEntry']

function entry(over: Partial<AuditEntryT>): AuditEntryT {
  return {
    id: 1,
    ts: '2026-11-22T09:20:00+03:00',
    actor: 'demo',
    event: 'command.status_changed',
    entity: 'command',
    entity_id: 'u-1',
    before: null,
    after: { status: 'acked' },
    ...over,
  } as AuditEntryT
}

describe('eventText / entityText — человекочитаемо', () => {
  it('известные события → текст, неизвестные → код', () => {
    expect(eventText('command.status_changed')).toBe('Статус команды изменён')
    expect(eventText('alarm.acked')).toBe('Тревога подтверждена')
    expect(eventText('custom.event')).toBe('custom.event')
    expect(eventText(null)).toBe('')
  })

  it('сущность + id, неизвестная сущность — код', () => {
    expect(entityText('command', '40211')).toBe('Команда 40211')
    expect(entityText('alarm', '2')).toBe('Тревога 2')
    expect(entityText('custom', '5')).toBe('custom 5')
    expect(entityText(null, null)).toBe('—')
  })
})

describe('diffText / wasNowText — было/стало', () => {
  it('объект → «ключ: значение; …», скаляр → строка, null → прочерк', () => {
    expect(diffText({ status: 'acked' })).toBe('status: acked')
    expect(diffText({ a: 1, b: 'x' })).toBe('a: 1; b: x')
    expect(diffText({ nested: { v: 2 } })).toBe('nested: {"v":2}')
    expect(diffText('plain')).toBe('plain')
    expect(diffText(null)).toBe('—')
  })

  it('wasNowText: пара или null, когда оба пусты', () => {
    expect(
      wasNowText(
        entry({ before: { status: 'queued' } as never, after: { status: 'sent_gw' } as never }),
      ),
    ).toEqual({
      was: 'status: queued',
      now: 'status: sent_gw',
    })
    expect(wasNowText(entry({ before: null, after: null }))).toBe(null)
    expect(wasNowText(entry({ before: null, after: { status: 'acked' } as never }))).toEqual({
      was: '—',
      now: 'status: acked',
    })
  })
})

describe('periodBounds / hasNextPage — фильтры и пагинация', () => {
  it('даты → начало/конец дня; пустые → null', () => {
    expect(periodBounds('2026-11-22', '2026-11-23')).toEqual({
      from: '2026-11-22T00:00:00',
      to: '2026-11-23T23:59:59',
    })
    expect(periodBounds(null, null)).toEqual({ from: null, to: null })
  })

  it('следующая страница есть, если вернули ровно limit', () => {
    expect(hasNextPage(100, 100)).toBe(true)
    expect(hasNextPage(99, 100)).toBe(false)
  })
})
