import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { components } from '@/api/types.gen'
import { useAckAlarm, useAlarms } from '@/api/endpoints/alarms'
import { useObjects } from '@/api/endpoints/objects'
import { ru } from '@/i18n/ru'
import { formatDateTimeRu, formatTimeRu } from '@/lib/time'
import {
  DEFAULT_FILTERS,
  alarmTarget,
  escalationLabel,
  filterAlarms,
  isUnacked,
  priorityLabel,
  stateLabel,
  type AlarmStateFilter,
} from './alarms-helpers'
import s from './alarms.module.css'

/*
 * Страница тревог (05 §6): таблица — приоритет (цвет+текст), объект/пост,
 * сообщение, время, состояние, шаг эскалации, [Подтвердить], [К устройству];
 * фильтры активные/неподтверждённые/все × объект × приоритет; на телефоне —
 * карточки. Подтверждение без диалога, отметка «Подтвердил demo 09:20».
 */

type AlarmT = components['schemas']['Alarm']
type ObjectT = components['schemas']['Object']

const STATE_TABS: Array<[AlarmStateFilter, string]> = [
  ['active', ru.alarms.filterActive],
  ['unacked', ru.alarms.filterUnacked],
  ['all', ru.alarms.filterAll],
]

/** Приоритетные чипы для фильтра */
const PRIORITIES = [1, 2, 3, 4]

/** Телефон (< 1024 px) — карточки вместо таблицы (05 §6) */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => globalThis.matchMedia?.('(max-width: 1023px)').matches ?? false,
  )
  useEffect(() => {
    const mq = globalThis.matchMedia?.('(max-width: 1023px)')
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

export function AlarmsPage() {
  const { data: alarms } = useAlarms()
  const { data: objects } = useObjects()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const list = useMemo(() => filterAlarms((alarms ?? []) as AlarmT[], filters), [alarms, filters])
  const isMobile = useIsMobile()

  return (
    <main className={s.page}>
      <h1 className={s.title}>{ru.alarms.title}</h1>

      <div className={s.filters}>
        <div className={s.tabs} role="group" aria-label={ru.alarms.colState}>
          {STATE_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filters.state === value ? s.tabActive : s.tab}
              onClick={() => setFilters((f) => ({ ...f, state: value }))}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          className={s.select}
          aria-label={ru.alarms.filterObject}
          value={filters.objectId ?? ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              objectId: e.target.value === '' ? null : Number(e.target.value),
            }))
          }
        >
          <option value="">{ru.alarms.filterObject}: все</option>
          {(objects ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          className={s.select}
          aria-label={ru.alarms.filterPriority}
          value={filters.priority ?? ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              priority: e.target.value === '' ? null : Number(e.target.value),
            }))
          }
        >
          <option value="">{ru.alarms.priorityAll}</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {priorityLabel(p)}
            </option>
          ))}
        </select>
      </div>

      {list.length === 0 ? (
        <p className={s.empty}>{ru.alarms.empty}</p>
      ) : isMobile ? (
        /* Телефон: карточки */
        <div className={s.cards}>
          {list.map((a) => (
            <AlarmCard key={a.id} alarm={a} objects={objects ?? []} />
          ))}
        </div>
      ) : (
        /* Десктоп: таблица */
        <table className={s.table}>
          <thead>
            <tr>
              <th>{ru.alarms.colPriority}</th>
              <th>{ru.alarms.colPlace}</th>
              <th>{ru.alarms.colMessage}</th>
              <th>{ru.alarms.colTime}</th>
              <th>{ru.alarms.colState}</th>
              <th>{ru.alarms.colEscalation}</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <AlarmRow key={a.id} alarm={a} objects={objects ?? []} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}

function placeText(a: AlarmT, objects: ObjectT[]): string {
  const obj = objects.find((o) => o.id === a.object_id)
  const post = a.post_id != null ? ` · ${ru.alarms.postsSuffix} ${a.post_id}` : ''
  return `${obj?.name ?? '—'}${post}`
}

/** Кнопка ack + отметка «Подтвердил demo 09:20» (без диалога) */
function AckCell({ alarm }: { alarm: AlarmT }) {
  const ack = useAckAlarm()
  if (alarm.state === 'active_acked' && alarm.acked_at) {
    return (
      <span className={s.ackedMark}>
        {ru.alarms.ackedBy
          .replace('{who}', alarm.acked_by ?? 'demo')
          .replace('{time}', formatTimeRu(alarm.acked_at))}
      </span>
    )
  }
  if (!isUnacked(alarm)) return null
  return (
    <button
      type="button"
      className={s.ackBtn}
      disabled={ack.isPending}
      onClick={() => ack.mutate(alarm.id!)}
    >
      {ru.alarms.ack}
    </button>
  )
}

function AlarmRow({ alarm, objects }: { alarm: AlarmT; objects: ObjectT[] }) {
  const target = alarmTarget(alarm)
  return (
    <tr
      className={s[`prio${alarm.priority ?? 0}` as keyof typeof s] ?? undefined}
      data-testid="alarm-row"
    >
      <td>
        <span className={`${s.chip} ${s[`chip${alarm.priority ?? 0}` as keyof typeof s] ?? ''}`}>
          {priorityLabel(alarm.priority)}
        </span>
      </td>
      <td>{placeText(alarm, objects)}</td>
      <td className={s.message}>{alarm.message}</td>
      <td className={s.time}>{alarm.raised_at ? formatDateTimeRu(alarm.raised_at) : '—'}</td>
      <td>{stateLabel(alarm.state)}</td>
      <td>{escalationLabel(alarm.escalation_step)}</td>
      <td className={s.actionsCell}>
        <AckCell alarm={alarm} />
        {target && (
          <Link className={s.deviceLink} to={target.to}>
            {target.label}
          </Link>
        )}
      </td>
    </tr>
  )
}

function AlarmCard({ alarm, objects }: { alarm: AlarmT; objects: ObjectT[] }) {
  const target = alarmTarget(alarm)
  return (
    <div
      className={s.card}
      style={{ borderLeftColor: `var(--alarm-p${alarm.priority ?? 4})` }}
      data-testid="alarm-card"
    >
      <div className={s.cardHead}>
        <span className={`${s.chip} ${s[`chip${alarm.priority ?? 0}` as keyof typeof s] ?? ''}`}>
          {priorityLabel(alarm.priority)}
        </span>
        <span className={s.time}>{alarm.raised_at ? formatDateTimeRu(alarm.raised_at) : '—'}</span>
      </div>
      <p className={s.message}>{alarm.message}</p>
      <p className={s.cardMeta}>
        {placeText(alarm, objects)} · {stateLabel(alarm.state)} ·{' '}
        {escalationLabel(alarm.escalation_step)}
      </p>
      <div className={s.actionsCell}>
        <AckCell alarm={alarm} />
        {target && (
          <Link className={s.deviceLink} to={target.to}>
            {target.label}
          </Link>
        )}
      </div>
    </div>
  )
}
