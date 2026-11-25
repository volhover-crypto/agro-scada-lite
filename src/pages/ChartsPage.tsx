import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { components } from '@/api/types.gen'
import { api } from '@/api/client'
import { useObjects } from '@/api/endpoints/objects'
import { useTagValues } from '@/api/endpoints/tags'
import { ru } from '@/i18n/ru'
import {
  buildTree,
  canAddTag,
  filterTree,
  MAX_SERIES,
  type Agg,
  type Period,
} from '@/widgets/chart-helpers'
import { ChartWidget } from '@/widgets/Chart'
import { TableWidget } from '@/widgets/Table'
import s from '@/widgets/widgets.module.css'

/*
 * Графики (05 §7): выбор тегов (дерево Объект → Пост → Параметр, поиск), до 8;
 * календарь выбора периода + компактные пресеты 24 ч / 7 дн / 30 дн сбоку;
 * агрегация; «Сохранить вид» — в dashboards выбранного объекта ([ASSUMPTION] В6);
 * режим модального окна для графика (перетаскивание, масштабирование за угол,
 * кнопки в стиле Проводника Windows: свернуть / развернуть / закрыть).
 */

type ChannelT = components['schemas']['Channel']
type WindowMode = 'inline' | 'modal' | 'maximized'

const PERIODS: Array<[Period, string, number]> = [
  ['24h', '24 ч', 1],
  ['7d', '7 дн', 7],
  ['30d', '30 дн', 30],
]

function toDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function presetDates(days: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86_400_000)
  return { from: toDateInput(from), to: toDateInput(to) }
}

function defaultModalBox() {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const w = Math.min(Math.round(vw * 0.78), 1120)
  const h = Math.min(Math.round(vh * 0.72), 680)
  return {
    x: Math.max(16, Math.round((vw - w) / 2)),
    y: Math.max(16, Math.round((vh - h) / 2)),
    w,
    h,
  }
}

export function ChartsPage() {
  const [selected, setSelected] = useState<string[]>([])
  const [period, setPeriod] = useState<Period | null>('24h')
  const [dateRange, setDateRange] = useState(() => presetDates(1))
  const [agg, setAgg] = useState<Agg>('avg')
  const [search, setSearch] = useState('')
  const [limitHit, setLimitHit] = useState(false)
  const [saved, setSaved] = useState(false)

  const [windowMode, setWindowMode] = useState<WindowMode>('inline')
  const [modalBox, setModalBox] = useState(defaultModalBox)
  const dragRef = useRef<{
    kind: 'move' | 'resize'
    startX: number
    startY: number
    box: { x: number; y: number; w: number; h: number }
  } | null>(null)

  const { data: objects } = useObjects()
  const { data: channels } = useQueryChannels()
  const { data: current } = useTagValues(allAssignedIds(channels ?? []), 60_000)

  const tree = useMemo(
    () => buildTree(channels ?? [], current ?? [], objects ?? []),
    [channels, current, objects],
  )
  const filtered = useMemo(() => filterTree(tree, search), [tree, search])

  const customRange = useMemo(() => {
    if (period != null) return undefined
    const fromIso = new Date(`${dateRange.from}T00:00:00`).toISOString()
    const toIso = new Date(`${dateRange.to}T23:59:59`).toISOString()
    return { from: fromIso, to: toIso }
  }, [period, dateRange])

  useEffect(() => {
    if (windowMode === 'inline') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWindowMode('inline')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [windowMode])

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      if (d.kind === 'move') {
        const maxX = Math.max(0, window.innerWidth - 120)
        const maxY = Math.max(0, window.innerHeight - 60)
        setModalBox({
          ...d.box,
          x: Math.min(maxX, Math.max(0, d.box.x + dx)),
          y: Math.min(maxY, Math.max(0, d.box.y + dy)),
        })
      } else {
        const maxW = window.innerWidth - d.box.x - 8
        const maxH = window.innerHeight - d.box.y - 8
        setModalBox({
          ...d.box,
          w: Math.min(maxW, Math.max(460, d.box.w + dx)),
          h: Math.min(maxH, Math.max(300, d.box.h + dy)),
        })
      }
    }
    function onUp() {
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  function startDrag(kind: 'move' | 'resize', e: ReactPointerEvent) {
    if (windowMode !== 'modal') return
    e.preventDefault()
    dragRef.current = { kind, startX: e.clientX, startY: e.clientY, box: modalBox }
  }

  function openModal() {
    setModalBox(defaultModalBox())
    setWindowMode('modal')
  }

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
            options: { period: period ?? '7d', agg },
            grid: { x: 0, y: 0, w: 12, h: 4 },
          },
        ],
      }),
    onSuccess: () => setSaved(true),
  })

  function selectPreset(p: Period, days: number) {
    setPeriod(p)
    setDateRange(presetDates(days))
  }

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

  const chartElement = (
    <ChartWidget
      tags={selected}
      period={period ?? '7d'}
      customRange={customRange}
      agg={agg}
      title={selected.length ? undefined : ru.charts.emptyHint}
    />
  )

  return (
    <main className={s.chartsPage}>
      <h1>{ru.shell.navCharts}</h1>

      <div className={s.chartsControls}>
        <div className={s.dateGroup}>
          <span className={s.controlLabel}>Период:</span>
          <input
            type="date"
            className={s.dateInput}
            aria-label="Дата начала"
            value={dateRange.from}
            max={dateRange.to}
            onChange={(e) => {
              if (!e.target.value) return
              setPeriod(null)
              setDateRange((r) => ({ ...r, from: e.target.value }))
            }}
          />
          <span className={s.controlLabel}>—</span>
          <input
            type="date"
            className={s.dateInput}
            aria-label="Дата окончания"
            value={dateRange.to}
            min={dateRange.from}
            onChange={(e) => {
              if (!e.target.value) return
              setPeriod(null)
              setDateRange((r) => ({ ...r, to: e.target.value }))
            }}
          />
        </div>

        <div className={s.presetGroup} role="group" aria-label="Быстрый выбор периода">
          {PERIODS.map(([p, label, days]) => (
            <button
              key={p}
              type="button"
              className={p === period ? `${s.presetBtn} ${s.presetBtnActive}` : s.presetBtn}
              aria-pressed={p === period}
              onClick={() => selectPreset(p, days)}
            >
              {label}
            </button>
          ))}
        </div>

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

        <button
          type="button"
          className={s.presetBtn}
          title="Открыть график в отдельном окне"
          onClick={openModal}
        >
          ❐ В окне
        </button>

        {saved && <span className={s.savedNote}>Вид сохранён</span>}
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
          {windowMode === 'inline' && chartElement}
          {selected.length > 0 && <TableWidget tags={selected} onRemove={toggle} />}
        </div>
      </div>

      {windowMode !== 'inline' && (
        <div
          className={s.chartModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Окно графиков"
        >
          <div
            className={
              windowMode === 'maximized'
                ? `${s.chartModalWindow} ${s.chartModalMaximized}`
                : s.chartModalWindow
            }
            style={
              windowMode === 'modal'
                ? {
                    left: `${modalBox.x}px`,
                    top: `${modalBox.y}px`,
                    width: `${modalBox.w}px`,
                    height: `${modalBox.h}px`,
                  }
                : undefined
            }
          >
            <div
              className={s.winTitleBar}
              onPointerDown={(e) => startDrag('move', e)}
              onDoubleClick={() =>
                setWindowMode((m) => (m === 'maximized' ? 'modal' : 'maximized'))
              }
            >
              <span className={s.winTitle}>
                {ru.shell.navCharts}
                {selected.length > 0 ? ` (${selected.length})` : ''}
              </span>
              <div className={s.winControls} onPointerDown={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={s.winBtn}
                  title="Свернуть"
                  aria-label="Свернуть окно"
                  onClick={() => setWindowMode('inline')}
                >
                  —
                </button>
                <button
                  type="button"
                  className={s.winBtn}
                  title={
                    windowMode === 'maximized' ? 'Восстановить размер' : 'Развернуть на весь экран'
                  }
                  aria-label={
                    windowMode === 'maximized' ? 'Восстановить размер' : 'Развернуть на весь экран'
                  }
                  onClick={() => setWindowMode((m) => (m === 'maximized' ? 'modal' : 'maximized'))}
                >
                  {windowMode === 'maximized' ? '❐' : '☐'}
                </button>
                <button
                  type="button"
                  className={`${s.winBtn} ${s.winBtnClose}`}
                  title="Закрыть"
                  aria-label="Закрыть окно"
                  onClick={() => setWindowMode('inline')}
                >
                  ×
                </button>
              </div>
            </div>

            <div className={s.chartModalBody}>{chartElement}</div>

            {windowMode === 'modal' && (
              <div
                className={s.winResizeHandle}
                title="Изменить размер"
                onPointerDown={(e) => startDrag('resize', e)}
              />
            )}
          </div>
        </div>
      )}
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
