import { useState } from 'react'
import type { components } from '@/api/types.gen'
import { useAudit } from '@/api/endpoints/audit'
import { ru } from '@/i18n/ru'
import { formatDateTimeRu } from '@/lib/time'
import {
  AUDIT_ENTITIES,
  entityText,
  eventText,
  hasNextPage,
  periodBounds,
  wasNowText,
} from './audit-helpers'
import s from './audit.module.css'

/*
 * Журнал (05 §9): лента — время, кто, событие (человекочитаемо), объект;
 * раскрытие строки — было/стало; фильтры по периоду (даты), сущности, автору;
 * пагинация по 100 записей (серверные offset/limit).
 */

type AuditEntryT = components['schemas']['AuditEntry']

const PAGE_SIZE = 100

export function AuditPage() {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [entity, setEntity] = useState('')
  const [actor, setActor] = useState('')
  const [offset, setOffset] = useState(0)

  const bounds = periodBounds(fromDate || null, toDate || null)
  const { data, isFetching } = useAudit({
    from: bounds.from,
    to: bounds.to,
    entity: entity || null,
    actor: actor || null,
    limit: PAGE_SIZE,
    offset,
  })

  const list = (data ?? []) as AuditEntryT[]
  const pageFrom = offset + 1
  const pageTo = offset + list.length
  const reset = () => setOffset(0)

  return (
    <main className={s.page}>
      <h1 className={s.title}>{ru.audit.title}</h1>

      <div className={s.filters}>
        <span className={s.filterLabel}>{ru.audit.filterPeriod}</span>
        <label className={s.filterField}>
          <span>{ru.audit.filterPeriodFrom}</span>
          <input
            type="date"
            className={s.input}
            aria-label={ru.audit.filterPeriodFrom}
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value)
              reset()
            }}
          />
        </label>
        <label className={s.filterField}>
          <span>{ru.audit.filterPeriodTo}</span>
          <input
            type="date"
            className={s.input}
            aria-label={ru.audit.filterPeriodTo}
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value)
              reset()
            }}
          />
        </label>
        <label className={s.filterField}>
          <span>{ru.audit.filterEntity}</span>
          <select
            className={s.input}
            aria-label={ru.audit.filterEntity}
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value)
              reset()
            }}
          >
            <option value="">{ru.audit.filterEntityAll}</option>
            {AUDIT_ENTITIES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={s.filterField}>
          <span>{ru.audit.filterActor}</span>
          <input
            className={s.input}
            aria-label={ru.audit.filterActor}
            placeholder={ru.audit.filterActorPlaceholder}
            value={actor}
            onChange={(e) => {
              setActor(e.target.value)
              reset()
            }}
          />
        </label>
      </div>

      {list.length === 0 ? (
        <p className={s.empty}>{isFetching ? ru.widgets.noData : ru.audit.empty}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{ru.audit.colTime}</th>
              <th>{ru.audit.colActor}</th>
              <th>{ru.audit.colEvent}</th>
              <th>{ru.audit.colEntity}</th>
              <th aria-label={ru.audit.expand} />
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <AuditRow key={e.id} entry={e} />
            ))}
          </tbody>
        </table>
      )}

      <div className={s.pager}>
        <button
          type="button"
          className={s.btn}
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          {ru.audit.pagePrev}
        </button>
        {list.length > 0 && (
          <span className={s.pageInfo}>
            {ru.audit.pageInfo.replace('{from}', String(pageFrom)).replace('{to}', String(pageTo))}
          </span>
        )}
        <button
          type="button"
          className={s.btn}
          disabled={!hasNextPage(list.length, PAGE_SIZE)}
          onClick={() => setOffset(offset + PAGE_SIZE)}
        >
          {ru.audit.pageNext}
        </button>
      </div>
    </main>
  )
}

/** Строка ленты; клик по строке с was/now — раскрытие «было/стало» */
function AuditRow({ entry }: { entry: AuditEntryT }) {
  const [open, setOpen] = useState(false)
  const wasNow = wasNowText(entry)
  return (
    <>
      <tr
        className={wasNow ? s.rowExpandable : undefined}
        data-testid="audit-row"
        onClick={wasNow ? () => setOpen((v) => !v) : undefined}
      >
        <td className={s.time}>{entry.ts ? formatDateTimeRu(entry.ts) : '—'}</td>
        <td>{entry.actor}</td>
        <td>{eventText(entry.event)}</td>
        <td>{entityText(entry.entity, entry.entity_id)}</td>
        <td className={s.expandCell}>
          {wasNow && (
            <button
              type="button"
              className={s.expandBtn}
              aria-expanded={open}
              onClick={(e) => {
                e.stopPropagation()
                setOpen((v) => !v)
              }}
            >
              {ru.audit.expand}
            </button>
          )}
        </td>
      </tr>
      {open && wasNow && (
        <tr className={s.diffRow} data-testid="audit-diff">
          <td />
          <td colSpan={4}>
            <div>
              <b>{ru.audit.was}:</b> {wasNow.was}
            </div>
            <div>
              <b>{ru.audit.now}:</b> {wasNow.now}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
