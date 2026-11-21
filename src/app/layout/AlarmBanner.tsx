import { useNavigate } from 'react-router'
import { useAckAlarm, useAlarms } from '@/api/endpoints/alarms'
import { useObjects } from '@/api/endpoints/objects'
import { ru } from '@/i18n/ru'
import { formatTimeRu } from '@/lib/time'
import s from './shell.module.css'

/** Баннер P1 active_unacked на всех экранах (05 §0):
 *  «⚠ {сообщение} · {объект} · {время} [Подтвердить] [Открыть]» */
export function AlarmBanner() {
  const navigate = useNavigate()
  const { data: alarms } = useAlarms()
  const { data: objects } = useObjects()
  const ack = useAckAlarm()

  const p1 = (alarms ?? [])
    .filter((a) => a.priority === 1 && a.state === 'active_unacked')
    .sort((a, b) => (a.raised_at ?? '').localeCompare(b.raised_at ?? ''))
    .at(-1)

  if (!p1) return null

  const object = objects?.find((o) => o.id === p1.object_id)
  const time = p1.raised_at ? formatTimeRu(p1.raised_at, object?.tz) : ''

  return (
    <div className={s.alarmBanner} role="alert">
      <span className={s.alarmBannerText}>
        ⚠ {p1.message} · {object?.name ?? ''}{' '}
        {time && <span className={`${s.alarmBannerTime} tabular`}>· {time}</span>}
      </span>
      <button
        type="button"
        className={`${s.alarmBannerBtn} ${s.alarmBannerBtnPrimary}`}
        disabled={ack.isPending}
        onClick={() => ack.mutate(p1.id!)}
      >
        {ru.shell.alarmConfirm}
      </button>
      <button
        type="button"
        className={s.alarmBannerBtn}
        onClick={() => navigate(`/o/${p1.object_id}`)}
      >
        {ru.shell.alarmOpen}
      </button>
    </div>
  )
}
