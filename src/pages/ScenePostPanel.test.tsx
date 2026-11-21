import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { components } from '@/api/types.gen'
import { ScenePostPanel } from './ScenePostPanel'

// Панель поста сцены: значения, исполнители со ссылкой на устройство (T12)

type TagValueT = components['schemas']['TagValue']
type ActuatorT = components['schemas']['Actuator']

describe('ScenePostPanel', () => {
  it('значения поста, исполнители со ссылкой на устройство', () => {
    const v = {
      tag_id: 'A/1/150/1',
      name: 'Температура воздуха',
      unit: '°C',
      value: 9.5,
      quality: 'good',
      kind: 'fact',
      origin: 'live',
      ts_measured: '2026-11-21T10:00:00+03:00',
      ts_received: '2026-11-21T10:00:01+03:00',
      post_id: 7,
    } as TagValueT
    const act = {
      id: 3,
      name: 'Клапан 2',
      fact_state: 'on',
      post_id: 7,
    } as ActuatorT

    render(
      <MemoryRouter>
        <ScenePostPanel
          objectId={1}
          postId={7}
          name="Пост 7"
          plot="Участок Б"
          current={[v]}
          actuators={[act]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /Пост 7/ })).toBeInTheDocument()
    expect(screen.getByText('9,5 °C')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Параметры' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Исполнители' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Клапан 2' })
    expect(link).toHaveAttribute('href', '/a/3')
    expect(screen.getByText('Включено')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Открыть пост' })).toHaveAttribute('href', '/o/1/p/7')
  })

  it('без значений и исполнителей — «Нет данных» в разделах', () => {
    render(
      <MemoryRouter>
        <ScenePostPanel
          objectId={1}
          postId={12}
          name="Пост 12"
          plot="Участок В"
          current={[]}
          actuators={[]}
        />
      </MemoryRouter>,
    )
    expect(screen.getAllByText('Нет данных')).toHaveLength(2)
  })
})
