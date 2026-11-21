import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { components } from '@/api/types.gen'
import { formatNumber, isBadQuality, minutesSince, QualityMark, ValueText } from './quality'
import { lampState, type LampOptions } from './Lamp'
import { trendDir } from './Card'

type TagValueT = components['schemas']['TagValue']

function tagValue(over: Partial<TagValueT>): TagValueT {
  return {
    tag_id: 'A/1/150/1',
    name: 't',
    post_id: 1,
    unit: '%',
    value: 27.4,
    quality: 'good',
    kind: 'fact',
    origin: 'live',
    ts_measured: '2026-11-21T12:00:00+03:00',
    ts_received: '2026-11-21T12:00:01+03:00',
    ...over,
  } as TagValueT
}

describe('minutesSince', () => {
  it('считает минуты назад; null/мусор → null', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(minutesSince(fiveMinAgo)).toBe(5)
    expect(minutesSince(null)).toBeNull()
    expect(minutesSince('мусор')).toBeNull()
  })
})

describe('QualityMark', () => {
  it('stale: «обновлено N мин назад», время не дублируется', () => {
    const ts = new Date(Date.now() - 42 * 60_000).toISOString()
    render(<QualityMark value={tagValue({ quality: 'stale', ts_measured: ts })} />)
    expect(screen.getByTestId('quality-mark')).toHaveTextContent('обновлено 42 мин назад')
    expect(screen.getByTestId('quality-mark')).not.toHaveTextContent('время приёма')
  })

  it('offline: значок с крестом и текстом (не только цвет)', () => {
    render(<QualityMark value={tagValue({ quality: 'offline' })} />)
    expect(screen.getByTestId('quality-mark')).toHaveTextContent('✕ нет связи')
  })

  it('sim: бейдж «ТЕСТ»', () => {
    render(<QualityMark value={tagValue({ quality: 'sim' })} />)
    expect(screen.getByTestId('quality-mark')).toHaveTextContent('ТЕСТ')
  })

  it('out_of_range и sensor_error: текст ошибки', () => {
    const first = render(<QualityMark value={tagValue({ quality: 'out_of_range' })} />)
    expect(first.getByTestId('quality-mark')).toHaveTextContent('вне диапазона')
    first.unmount()
    const second = render(<QualityMark value={tagValue({ quality: 'sensor_error' })} />)
    expect(second.getByTestId('quality-mark')).toHaveTextContent('ошибка датчика')
    second.unmount()
  })

  it('good без ts_measured: время с пометкой «время приёма»', () => {
    render(<QualityMark value={tagValue({ ts_measured: null })} />)
    expect(screen.getByTestId('quality-mark')).toHaveTextContent('время приёма')
  })

  it('forecast: «прогноз на …»', () => {
    render(<QualityMark value={tagValue({ kind: 'forecast', value: 1.8 })} />)
    expect(screen.getByTestId('quality-mark')).toHaveTextContent('прогноз на')
  })
})

describe('ValueText', () => {
  it('число в русской локали + единицы; ошибки перечёркнуты', () => {
    render(<ValueText value={tagValue({ value: 27.4 })} />)
    expect(screen.getByText('27,4 %')).toBeInTheDocument()
    const bad = render(
      <ValueText value={tagValue({ value: 147, quality: 'out_of_range' })} />,
    ).container
    expect(bad.textContent).toContain('147 %')
    expect(isBadQuality('out_of_range')).toBe(true)
    expect(isBadQuality('good')).toBe(false)
  })

  it('null → прочерк', () => {
    render(<ValueText value={tagValue({ value: null })} />)
    expect(screen.getByText('— %')).toBeInTheDocument()
  })

  it('formatNumber: запятая и точность', () => {
    expect(formatNumber(27.46, 1)).toBe('27,5')
    expect(formatNumber(147, 0)).toBe('147')
  })
})

describe('lampState', () => {
  const opts: LampOptions = { mode: 'threshold', threshold: 25 }
  it('порог: ≥ threshold → on, ниже → off', () => {
    expect(lampState(tagValue({ value: 30 }), opts)).toBe('on')
    expect(lampState(tagValue({ value: 24.9 }), opts)).toBe('off')
  })

  it('дискрет: 1 → on, 0 → off', () => {
    const d: LampOptions = { mode: 'discrete' }
    expect(lampState(tagValue({ value: 1 }), d)).toBe('on')
    expect(lampState(tagValue({ value: 0 }), d)).toBe('off')
  })

  it('null или ошибка/офлайн → unknown', () => {
    expect(lampState(tagValue({ value: null }), opts)).toBe('unknown')
    expect(lampState(tagValue({ value: 30, quality: 'sensor_error' }), opts)).toBe('unknown')
    expect(lampState(tagValue({ value: 30, quality: 'offline' }), opts)).toBe('unknown')
  })
})

describe('trendDir', () => {
  it('рост/падение/ровно; меньше двух точек — flat', () => {
    expect(
      trendDir([
        ['t1', 10, 'good'],
        ['t2', 12, 'good'],
      ]),
    ).toBe('up')
    expect(
      trendDir([
        ['t1', 12, 'good'],
        ['t2', 10, 'good'],
      ]),
    ).toBe('down')
    expect(
      trendDir([
        ['t1', 10, 'good'],
        ['t2', 10.1, 'good'],
      ]),
    ).toBe('flat')
    expect(trendDir([['t1', 10, 'good']])).toBe('flat')
  })
})
