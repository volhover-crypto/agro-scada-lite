import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '@/api/client'
import { useObjects } from '@/api/endpoints/objects'
import { useTagValues } from '@/api/endpoints/tags'
import { ru } from '@/i18n/ru'
import { canAddTag, MAX_SERIES, type Agg, type Period } from '@/widgets/chart-helpers'
import { ChartWidget } from '@/widgets/Chart'
import { TableWidget } from '@/widgets/Table'
import s from '@/widgets/widgets.module.css'

/*
 * Графики (05 §7): выбор тегов (дерево Объект → Пост → Параметр, поиск), до 8;
 * период 24 ч / 7 д / 30 д / свой; агрегация; «Сохранить вид» — в dashboards
 * выбранного объекта ([ASSUMPTION] В6). 9-й тег — «Не более 8 рядов».
 */

type ChannelT = components['schemas']['Channel']
type TagValueT = components['schemas']['TagValue']

const PERIODS: Array<[Period, string]> = [
  ['24h', '24 часа'],
  ['7d', '7 дней'],
  ['30d', '30 дней'],
]

export function ChartsPage() {
  const [selected, setSelected] = useState<string[]>([])
  const [period, setPeriod] = useState<Period>('24h')
  const [agg, setAgg] = useState<Agg>('avg')
  const [search, setSearch] = useState('')
  const [limitHit, setLimitHit] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data: objects } = useObjects()
  const { data: channels } = useQueryChannels()
  const { data: current } = useTagValues(allAssignedIds(channels ?? []), 60_000)

  const tree = useMemo(
    () => buildTree(channels ?? [], current ?? [], objects ?? []),
    [channels, current, objects],
  )
  const filtered = useMemo(() => filterTree(tree, search), [tree, search])

  const save = useMutation({
    mutationFn: () =>
      api.post('/dashboards', {
        object_id: 1,
        name: `Графики (${selected.length})`,
        layout: [
          {
            id: 'chart-main',
            kind: 'chart',
            tags: selected,
            options: { period, agg },
            grid: { x: 0, y: 0, w: 12, h: 4 },
          },
        ],
      }),
    onSuccess: () => setSaved(true),
  })

  function toggle(tagId: string) {
    setSaved(false)
    if (selected.includes(tagId)) {
      setSelected(selected.filter((t) => t !== tagId))
      setLimitHit(false)
      return
    }
    if (canAddTag(selected, tagId)) {
      setSelected([...selected, tagId])
      setLimitHit(false)
    } else {
      setLimitHit(true)
    }
  }

  return (
    <main className={s.chartsPage}>
      <h1>{ru.shell.navCharts}</h1>

      <div className={s.chartsControls}>
        <span className={s.controlLabel}>Период:</span>
        {PERIODS.map(([p, label]) => (
          <button
            key={p}
            type="button"
            className={p === period ? `${s.treeItem} ${s.treeGroup}` : s.treeItem}
            aria-pressed={p === period}
            onClick={() => setPeriod(p)}
          >
            {label}
          </button>
        ))}
        <span className={s.controlLabel}>Агрегация:</span>
        <select
          className={s.controlSelect}
          aria-label="Агрегация"
          value={agg}
          onChange={(e) => setAgg(e.target.value as Agg)}
        >
          <option value="avg">среднее</option>
          <option value="min">минимум</option>
          <option value="max">максимум</option>
        </select>
        <button
          type="button"
          className={s.saveBtn}
          disabled={selected.length === 0 || save.isPending}
          onClick={() => save.mutate()}
        >
          Сохранить вид
        </button>
        {saved && <span className={s.savedNote}>Вид сохранён</span>}
      </div>

      <div className={s.chips}>
        {selected.map((t) => (
          <span key={t} className={s.chip}>
            {nameOf(current ?? [], t)}
            <button
              type="button"
              className={s.chipBtn}
              aria-label={`Убрать ${t}`}
              onClick={() => toggle(t)}
            >
              ×
            </button>
          </span>
        ))}
        {selected.length > 0 && (
          <span className={s.chipsLimit}>
            {selected.length}/{MAX_SERIES}
          </span>
        )}
        {limitHit && (
          <span className={s.chipsLimit}>
            {ru.charts.maxSeries.replace('{max}', String(MAX_SERIES))}
          </span>
        )}
      </div>

      <div className={s.chartsRow}>
        <div className={s.pickerCard}>
          <input
            className={s.pickerSearch}
            type="search"
            placeholder="Поиск параметра…"
            aria-label="Поиск параметра"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {filtered.map((group) => (
            <div key={group.postKey}>
              <button type="button" className={`${s.treeItem} ${s.treeGroup}`} disabled>
                {group.postLabel}
              </button>
              {group.params.map((p) => (
                <button
                  key={p.tagId}
                  type="button"
                  className={`${s.treeItem} ${s.treeChild}`}
                  aria-pressed={selected.includes(p.tagId)}
                  onClick={() => toggle(p.tagId)}
                >
                  {selected.includes(p.tagId) ? '✓ ' : ''}
                  {p.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <ChartWidget
            tags={selected}
            period={period}
            agg={agg}
            title={selected.length ? undefined : ru.charts.emptyHint}
          />
          {selected.length > 0 && <TableWidget tags={selected} />}
        </div>
      </div>
    </main>
  )
}

// ── сборка дерева из каналов и текущих значений ──────────────────────────────

/** Каналы со статусом assigned (источник каталога тегов) */
function useQueryChannels() {
  return useQuery({
    queryKey: ['channels', 'assigned'],
    queryFn: () => api.get<ChannelT[]>('/channels?status=assigned'),
  })
}

function allAssignedIds(channels: ChannelT[]): string[] {
  return channels.map((c) => c.tag_id ?? '').filter(Boolean)
}

export interface TreeGroup {
  postKey: string
  postLabel: string
  params: Array<{ tagId: string; label: string }>
}

/** Дерево Объект → Пост → Параметр: канал даёт имя параметра, /tags/current — пост */
export function buildTree(
  channels: ChannelT[],
  current: TagValueT[],
  objects: components['schemas']['Object'][],
): TreeGroup[] {
  const byPost = new Map<string, { postLabel: string; params: Map<string, string> }>()
  const objName = (objects ?? []).find((o) => o.id === 1)?.name ?? ''

  for (const ch of channels) {
    const tagId = ch.tag_id ?? ''
    if (!tagId) continue
    const tv = current.find((v) => v.tag_id === tagId)
    const postId = tv?.post_id
    if (postId == null) continue
    const key = String(postId)
    const label = `Пост ${postId} · ${objName}`
    if (!byPost.has(key)) byPost.set(key, { postLabel: label, params: new Map() })
    byPost
      .get(key)!
      .params.set(tagId, tv?.name ?? `${ch.param_name} ${ch.level_cm} см №${ch.sensor_no}`)
  }
  return [...byPost.entries()]
    .sort((a, b) => a[1].postLabel.localeCompare(b[1].postLabel, 'ru'))
    .map(([postKey, g]) => ({
      postKey,
      postLabel: g.postLabel,
      params: [...g.params.entries()].map(([tagId, label]) => ({ tagId, label })),
    }))
}

export function filterTree(tree: TreeGroup[], search: string): TreeGroup[] {
  const q = search.trim().toLowerCase()
  if (!q) return tree
  return tree
    .map((g) => ({
      ...g,
      params: g.params.filter(
        (p) => p.label.toLowerCase().includes(q) || g.postLabel.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.params.length > 0)
}

function nameOf(current: TagValueT[], tagId: string): string {
  return current.find((v) => v.tag_id === tagId)?.name ?? tagId
}
