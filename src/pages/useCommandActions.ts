import { useRef, useState } from 'react'
import type { components } from '@/api/types.gen'
import { ApiError } from '@/api/client'
import { useCancelCommand, useConfirmCommand, useCreateCommand } from '@/api/endpoints/commands'
import { ru } from '@/i18n/ru'
import { durationLabel } from './device-helpers'

/** Текст ошибки мутации: сообщение API или общий запасной */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : ru.common.unknownError
}

/*
 * Мутационная логика команд страницы устройства (05 §5): создание с
 * идемпотентностью (FIX-1: ключ живёт, пока исход попытки неизвестен —
 * при сетевой ошибке/таймауте/5xx он НЕ сбрасывается и повторное нажатие
 * уходит с тем же ключом; успех или бизнес-ошибка 4xx — исход известен,
 * ключ сбрасывается. «Повторить» после timeout — новая команда с новым
 * ключом, D-41), диалог подтверждения (created awaiting_confirm → hold →
 * /confirm; закрытие — /cancel). Вынесено из CommandCard (crapper CC).
 */

type CommandDefT = components['schemas']['CommandDef']
type CommandT = components['schemas']['Command']

export interface CommandActions {
  busy: boolean
  error: string | null
  /** uuid команды в ожидании подтверждения (диалог открыт) */
  pendingUuid: string | null
  pendingTitle: string
  /** def может отсутствовать в каталоге (FIX-2) — тогда показываем ошибку */
  issue: (def: CommandDefT | undefined, durationS: number | undefined, deviceName: string) => void
  confirmPending: () => void
  cancelPending: () => void
}

export function useCommandActions(onAfterChange: () => void): CommandActions {
  const create = useCreateCommand()
  const confirmCmd = useConfirmCommand()
  const cancelCmd = useCancelCommand()
  const keyRef = useRef<string | null>(null)
  const [pendingUuid, setPendingUuid] = useState<string | null>(null)
  const [pendingTitle, setPendingTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  function ensureKey(): string {
    if (!keyRef.current) keyRef.current = `ui-${crypto.randomUUID()}`
    return keyRef.current
  }

  function issue(
    def: CommandDefT | undefined,
    durationS: number | undefined,
    deviceName: string,
  ): void {
    if (create.isPending || confirmCmd.isPending) return // двойное нажатие — блок до ответа
    // FIX-2: определение не найдено — ошибка пользователю, не исключение
    if (!def) {
      setError(ru.device.defNotFound)
      return
    }
    setError(null)
    create.mutate(
      { command_def_id: def.id!, duration_s: durationS ?? undefined, idempotency_key: ensureKey() },
      {
        onSuccess: (cmd: CommandT) => {
          keyRef.current = null
          onAfterChange()
          if (cmd.status === 'awaiting_confirm') {
            setPendingUuid(cmd.uuid ?? null)
            setPendingTitle(
              ru.device.confirmTitle
                .replace('{name}', deviceName)
                .replace('{duration}', durationLabel(durationS ?? null)),
            )
          }
        },
        onError: (e) => {
          // FIX-1: исход попытки неизвестен (сеть/таймаут — status 0, сервер
          // не ответил — 5xx) → ключ сохраняется для повторного нажатия;
          // известный исход (успех выше, бизнес-ошибка 4xx) → ключ сбрасывается
          const outcomeKnown = e instanceof ApiError && e.status !== 0 && e.status < 500
          if (outcomeKnown) keyRef.current = null
          setError(errMsg(e))
        },
      },
    )
  }

  function confirmPending(): void {
    if (!pendingUuid) return
    confirmCmd.mutate(pendingUuid, {
      onSuccess: () => {
        setPendingUuid(null)
        onAfterChange()
      },
      onError: (e) => {
        setPendingUuid(null)
        setError(errMsg(e))
      },
    })
  }

  function cancelPending(): void {
    if (!pendingUuid) return
    cancelCmd.mutate(pendingUuid, { onSettled: () => setPendingUuid(null) })
  }

  return {
    busy: create.isPending || confirmCmd.isPending,
    error,
    pendingUuid,
    pendingTitle,
    issue,
    confirmPending,
    cancelPending,
  }
}
