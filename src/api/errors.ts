import { ru } from '@/i18n/ru'
import { ApiError } from './client'

/*
 * Единый обработчик ошибок API (02_ARCHITECTURE_FE §8):
 * известный код → текст из i18n/ru.ts; неизвестный код → message сервера.
 * Тексты с подстановками (например максимум длительности) показывает сам экран,
 * когда у него есть данные; здесь — базовые формулировки.
 */
export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const known = ru.apiErrors[err.code as keyof typeof ru.apiErrors]
    if (known) return known
    return err.message
  }
  return ru.common.unknownError
}
