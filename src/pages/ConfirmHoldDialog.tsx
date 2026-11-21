import { useEffect, useRef, useState } from 'react'
import { ru } from '@/i18n/ru'
import s from './device.module.css'

/*
 * Диалог подтверждения удержанием (05 §5): «Удерживайте 1,5 с для подтверждения».
 * Указатель ушёл раньше — прогресс сбрасывается; 1,5 с — onConfirm. Отмена/Esc —
 * onCancel (страница вызывает /cancel для созданной команды).
 */

const HOLD_MS = 1500
const TICK_MS = 50

export interface ConfirmHoldDialogProps {
  open: boolean
  title: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmHoldDialog({ open, title, onConfirm, onCancel }: ConfirmHoldDialogProps) {
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<number | null>(null)
  const startRef = useRef(0)
  // подтверждение за одно открытие — двойной tap после срабатывания не повторяет
  const doneRef = useRef(false)

  // Esc и сброс при закрытии
  useEffect(() => {
    if (!open) return
    doneRef.current = false
    setProgress(0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      stopHold()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCancel стабилен на время жизни диалога
  }, [open])

  function stopHold(): void {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setProgress(0)
  }

  function startHold(): void {
    if (timerRef.current != null || doneRef.current) return
    startRef.current = Date.now()
    timerRef.current = window.setInterval(() => {
      const done = Date.now() - startRef.current >= HOLD_MS
      if (done) {
        stopHold()
        doneRef.current = true
        onConfirm()
      } else {
        setProgress(Math.min(100, ((Date.now() - startRef.current) / HOLD_MS) * 100))
      }
    }, TICK_MS)
  }

  if (!open) return null

  return (
    <div className={s.overlay} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} className={s.dialog}>
        <p className={s.dialogTitle}>{title}</p>
        <button
          type="button"
          className={s.holdBtn}
          data-testid="hold-button"
          aria-description={ru.device.confirmHold}
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
        >
          <span
            className={s.holdFill}
            style={{ width: `${progress}%` }}
            data-testid="hold-progress"
          />
          <span className={s.holdText}>
            {progress > 0 ? ru.device.confirmHolding : ru.device.confirmHold}
          </span>
        </button>
        <button type="button" className={s.dialogCancel} onClick={onCancel}>
          {ru.device.confirmCancel}
        </button>
      </div>
    </div>
  )
}
