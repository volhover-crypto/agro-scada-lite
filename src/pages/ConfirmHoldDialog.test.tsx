import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmHoldDialog } from './ConfirmHoldDialog'

// Диалог удержания 1,5 с (05 §5): раньше отпустил — сброс; досидел — подтверждение

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ConfirmHoldDialog', () => {
  it('отпустил раньше 1,5 с — прогресс сброшен, подтверждения нет', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmHoldDialog
        open
        title="Включить Клапан 1 на 30 мин?"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    )
    const btn = screen.getByTestId('hold-button')
    fireEvent.pointerDown(btn)
    await vi.advanceTimersByTimeAsync(1000)
    fireEvent.pointerUp(btn)
    await vi.advanceTimersByTimeAsync(2000)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('удержал 1,5 с — onConfirm ровно один раз', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmHoldDialog open title="t" onConfirm={onConfirm} onCancel={() => {}} />)
    const btn = screen.getByTestId('hold-button')
    fireEvent.pointerDown(btn)
    await vi.advanceTimersByTimeAsync(1600)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('Esc — onCancel', () => {
    const onCancel = vi.fn()
    render(<ConfirmHoldDialog open title="t" onConfirm={() => {}} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('закрытый диалог ничего не рендерит', () => {
    render(<ConfirmHoldDialog open={false} title="t" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByTestId('hold-button')).not.toBeInTheDocument()
  })

  it('после подтверждения повторный pointerDown не срабатывает', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmHoldDialog open title="t" onConfirm={onConfirm} onCancel={() => {}} />)
    const btn = screen.getByTestId('hold-button')
    fireEvent.pointerDown(btn)
    await vi.advanceTimersByTimeAsync(1600)
    fireEvent.pointerDown(btn)
    await vi.advanceTimersByTimeAsync(1600)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('переоткрытие сбрасывает прогресс и повторное подтверждение снова возможно', async () => {
    const onConfirm = vi.fn()
    const { rerender } = render(
      <ConfirmHoldDialog open title="t" onConfirm={onConfirm} onCancel={() => {}} />,
    )
    const btn = screen.getByTestId('hold-button')
    fireEvent.pointerDown(btn)
    await vi.advanceTimersByTimeAsync(1600)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    // закрытие (родитель снимает open) и переоткрытие — подтверждение снова доступно
    rerender(<ConfirmHoldDialog open={false} title="t" onConfirm={onConfirm} onCancel={() => {}} />)
    rerender(<ConfirmHoldDialog open title="t" onConfirm={onConfirm} onCancel={() => {}} />)
    expect(screen.getByTestId('hold-progress')).toHaveAttribute('style', 'width: 0%;')
    fireEvent.pointerDown(screen.getByTestId('hold-button'))
    await vi.advanceTimersByTimeAsync(1600)
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })
})
