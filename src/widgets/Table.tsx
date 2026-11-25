import { useMemo, useState } from 'react'
import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'
import { formatDateTimeRu } from '@/lib/time'
import { WidgetFrame } from './WidgetFrame'
import { isBadQuality, isDimQuality } from './quality'
import { sortRows, type SortKey } from './table-helpers'
import s from './widgets.module.css'

/*
 * Table — таблица телеметрии (07 §2): колонки пост/параметр/значение/качество/
 * время; сортировка, фильтр по посту и поиск; экспорт CSV (should) — ссылкой
 * на /export за период 7 дней.
 */

type TagValueT = components['schemas']['TagValue']

export function TableWidget({
  title,
  tags,
  onRemove,
}: {
  title?: string
  tags: string[]
  onRemove?: (tagId: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('time')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [postFilter, setPostFilter] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')

  return (
    <WidgetFrame title={title} tagIds={tags}>
      {(values) => (
        <TableBody
          values={values}
          sortKey={sortKey}
          dir={dir}
          postFilter={postFilter}
          search={search}
          onSort={(k) => {
            if (k === sortKey) setDir(dir === 'asc' ? 'desc' : 'asc')
            else {
              setSortKey(k)
              setDir('asc')
            }
          }}
          onPostFilter={setPostFilter}
          onSearch={setSearch}
          onRemove={onRemove}
        />
      )}
    </WidgetFrame>
  )
}

function TableBody({
  values,
  sortKey,
  dir,
  postFilter,
  search,
  onSort,
  onPostFilter,
  onSearch,
  onRemove,
}: {
  values: TagValueT[]
  sortKey: SortKey
  dir: 'asc' | 'desc'
  postFilter: number | 'all'
  search: string
  onSort: (k: SortKey) => void
  onPostFilter: (v: number | 'all') => void
  onSearch: (v: string) => void
  onRemove?: (tagId: string) => void
}) {
  const posts = useMemo(() => {
    const m = new Map<number, string>()
    for (const v of values)
      if (v.post_id != null && !m.has(v.post_id)) m.set(v.post_id, `Пост ${v.post_id}`)
    return m
  }, [values])

  const rows = useMemo(() => {
    const filtered = values.filter((v) => {
      if (postFilter !== 'all' && v.post_id !== postFilter) return false
      if (search && !(v.name ?? '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    return sortRows(filtered, sortKey, dir, posts)
  }, [values, postFilter, search, sortKey, dir, posts])

  const from = new Date(Date.now() - 7 * 86_400_000 + 3 * 3_600_000)
    .toISOString()
    .replace('Z', '+03:00')
  const to = new Date(Date.now() + 3 * 3_600_000).toISOString().replace('Z', '+03:00')
  const csvHref = `/webhook/export?ids=${encodeURIComponent(values.map((v) => v.tag_id).join(','))}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`

  const head: Array<[SortKey, string]> = [
    ['post', 'Пост'],
    ['name', 'Параметр'],
    ['value', 'Значение'],
    ['quality', 'Качество'],
    ['time', 'Время'],
  ]

  return (
    <div className={s.tableWrap}>
      <div className={s.tableControls}>
        <select
          className={s.tableSelect}
          aria-label="Фильтр по посту"
          value={String(postFilter)}
          onChange={(e) => onPostFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">Все посты</option>
          {[...posts.entries()].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <input
          className={s.tableSearch}
          type="search"
          placeholder="Поиск параметра…"
          aria-label="Поиск параметра"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <a className={s.tableCsv} href={csvHref}>
          CSV
        </a>
      </div>
      <table className={s.table}>
        <thead>
          <tr>
            {onRemove && <th className={s.tableRemoveCol} aria-label="Убрать с графика" />}
            {head.map(([k, label]) => (
              <th key={k}>
                <button type="button" className={s.tableSort} onClick={() => onSort(k)}>
                  {label}
                  {sortKey === k ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.tag_id}>
              {onRemove && (
                <td className={s.tableRemoveCol}>
                  <button
                    type="button"
                    className={s.tableRemoveBtn}
                    aria-label={`Убрать ${v.name ?? v.tag_id}`}
                    title="Убрать с графика"
                    onClick={() => v.tag_id && onRemove(v.tag_id)}
                  >
                    ×
                  </button>
                </td>
              )}
              <td>{v.post_id != null ? (posts.get(v.post_id) ?? `Пост ${v.post_id}`) : '—'}</td>
              <td>{v.name}</td>
              <td
                className={`${s.tableValue} ${isBadQuality(v.quality) ? s.valueBad : ''} ${isDimQuality(v.quality) ? s.valueDim : ''} tabular`}
              >
                {typeof v.value === 'number'
                  ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(v.value)
                  : '—'}
                {v.unit ? ` ${v.unit}` : ''}
              </td>
              <td>{qualityText(v.quality ?? 'good')}</td>
              <td className="tabular">{formatDateTimeRu(v.ts_measured ?? v.ts_received ?? '')}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={onRemove ? 6 : 5} className={s.tableEmpty}>
                {ru.widgets.noData}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function qualityText(q: string): string {
  const map: Record<string, string> = {
    good: 'норма',
    stale: 'устарело',
    offline: 'нет связи',
    out_of_range: 'вне диапазона',
    sensor_error: 'ошибка датчика',
    sim: 'ТЕСТ',
  }
  return map[q] ?? q
}
