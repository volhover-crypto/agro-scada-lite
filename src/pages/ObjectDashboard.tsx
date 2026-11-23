import { useEffect, useState, type ReactNode } from 'react'
// legacy-обёртка RGL 2: официальный v1-пропсы API (WidthProvider, data-grid);
// миграция на v2-хуки — после стабилизации (D-29)
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import { ru } from '@/i18n/ru'
import { WidgetById } from '@/widgets/factory'
import type { WidgetConfig, WidgetKind } from '@/widgets/types'
import { addWidgetToLayout, removeWidgetFromLayout, stackLayout } from './dashboard-helpers'
import d from './dashboard.module.css'

/*
 * Дашборд объекта + конструктор (07 §4): сетка 12/6/1 колонок,
 * «добавить виджет → вид → теги → пороги», drag/resize на десктопе,
 * на телефоне только порядок (1 колонка, без resize).
 */

const ResponsiveGrid = WidthProvider(Responsive)

const KINDS: Array<[WidgetKind, string]> = [
  ['card', 'Карточка значения'],
  ['gauge', 'Индикатор'],
  ['lamp', 'Лампа'],
  ['chart', 'График'],
  ['bar', 'Столбцы'],
  ['table', 'Таблица'],
]

export interface DashboardViewProps {
  /** конфигурация виджетов из dashboards.layout */
  layout: WidgetConfig[]
  /** теги для конструктора: [{ tagId, label }] */
  tagCatalog: Array<{ tagId: string; label: string }>
  /** сохранить draft layout (вызывает PUT в родителе) */
  onSave: (draft: WidgetConfig[]) => void
  saving?: boolean
}

interface EditorBarProps {
  kind: WidgetKind
  setKind: (k: WidgetKind) => void
  tagCatalog: Array<{ tagId: string; label: string }>
  tagIds: string[]
  setTagIds: (ids: string[]) => void
  wTitle: string
  setWTitle: (v: string) => void
  threshold: string
  setThreshold: (v: string) => void
  canAdd: boolean
  onAdd: () => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}

/** Панель конструктора (07 §4): вид → теги → пороги → добавить; сохранить/отмена */
function EditorBar(p: EditorBarProps): ReactNode {
  return (
    <div className={d.editorBar}>
      <span className={d.controlLabel}>{ru.objectPage.widgetKind}</span>
      <select
        className={d.controlSelect}
        aria-label={ru.objectPage.widgetKind}
        value={p.kind}
        onChange={(e) => p.setKind(e.target.value as WidgetKind)}
      >
        {KINDS.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <span className={d.controlLabel}>{ru.objectPage.widgetTags}</span>
      <select
        className={d.controlSelect}
        aria-label={ru.objectPage.widgetTags}
        multiple
        size={4}
        value={p.tagIds}
        onChange={(e) => p.setTagIds([...e.target.selectedOptions].map((o) => o.value).slice(0, 8))}
      >
        {p.tagCatalog.map((t) => (
          <option key={t.tagId} value={t.tagId}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        className={d.controlSelect}
        type="text"
        placeholder={ru.objectPage.widgetTitle}
        aria-label={ru.objectPage.widgetTitle}
        value={p.wTitle}
        onChange={(e) => p.setWTitle(e.target.value)}
      />
      <input
        className={d.controlSelect}
        type="number"
        placeholder={ru.objectPage.widgetThreshold}
        aria-label={ru.objectPage.widgetThreshold}
        value={p.threshold}
        onChange={(e) => p.setThreshold(e.target.value)}
      />
      <button type="button" className={d.saveBtn} disabled={!p.canAdd} onClick={p.onAdd}>
        {ru.objectPage.addWidget}
      </button>
      <span className={d.spacer} />
      <button type="button" className={d.saveBtn} disabled={p.saving} onClick={p.onSave}>
        {ru.objectPage.save}
      </button>
      <button type="button" className={d.cancelBtn} onClick={p.onCancel}>
        {ru.objectPage.cancel}
      </button>
    </div>
  )
}

/** Мобильный режим: <768 px (06 §4, 1 колонка — только порядок) */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

function gridFrame(config: WidgetConfig, editing: boolean, onRemove: () => void): ReactNode {
  return (
    <div key={config.id} data-grid={config.grid} className={editing ? d.cellEditing : d.cell}>
      {editing && (
        <div className={d.cellHead}>
          <span className={d.cellTitle}>{config.title ?? config.kind}</span>
          <button
            type="button"
            className={d.cellRemove}
            aria-label={`Удалить ${config.title ?? config.id}`}
            onClick={onRemove}
          >
            ×
          </button>
        </div>
      )}
      <WidgetById config={config} />
    </div>
  )
}

export function DashboardView({ layout, tagCatalog, onSave, saving }: DashboardViewProps) {
  const mobile = useIsMobile()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<WidgetConfig[]>([])
  const [kind, setKind] = useState<WidgetKind>('card')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [wTitle, setWTitle] = useState('')
  const [threshold, setThreshold] = useState('')

  function startEditing() {
    setDraft(layout.map((w) => structuredClone(w)))
    setEditing(true)
  }

  function onLayoutChange(next: Layout) {
    if (!editing) return
    setDraft((prev) =>
      prev.map((w) => {
        const l = next.find((n) => n.i === w.id)
        return l ? { ...w, grid: { x: l.x, y: l.y, w: l.w, h: l.h } } : w
      }),
    )
  }

  function addWidget() {
    if (tagIds.length === 0) return
    const value = threshold.trim() === '' ? null : Number(threshold)
    setDraft(
      addWidgetToLayout(draft, kind, tagIds, wTitle, {
        thresholds: Number.isNaN(value)
          ? []
          : value == null
            ? []
            : [{ value: value as number, color: 'warn' }],
        options: kind === 'chart' ? { period: '24h', agg: 'avg' } : undefined,
      }),
    )
    setTagIds([])
    setWTitle('')
    setThreshold('')
  }

  if (editing) {
    const stacked = mobile ? stackLayout(draft) : draft
    return (
      <div className={d.editor}>
        <EditorBar
          kind={kind}
          setKind={setKind}
          tagCatalog={tagCatalog}
          tagIds={tagIds}
          setTagIds={setTagIds}
          wTitle={wTitle}
          setWTitle={setWTitle}
          threshold={threshold}
          setThreshold={setThreshold}
          canAdd={tagIds.length > 0}
          onAdd={addWidget}
          onSave={() => {
            onSave(draft)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
          saving={saving ?? false}
        />

        <ResponsiveGrid
          className={d.grid}
          breakpoints={{ lg: 1280, md: 768, sm: 0 }}
          cols={{ lg: 12, md: 6, sm: 1 }}
          rowHeight={76}
          margin={[12, 12]}
          layouts={{
            lg: stacked.map((w) => ({ ...w.grid, i: w.id })),
            md: stacked.map((w) => ({ ...w.grid, i: w.id })),
            sm: stacked.map((w) => ({ ...w.grid, i: w.id })),
          }}
          isResizable={!mobile}
          isDraggable={true}
          onLayoutChange={onLayoutChange}
        >
          {stacked.map((w) =>
            gridFrame(w, true, () => setDraft(removeWidgetFromLayout(draft, w.id))),
          )}
        </ResponsiveGrid>
      </div>
    )
  }

  if (layout.length === 0) {
    return (
      <div>
        <p className={d.empty}>{ru.objectPage.noDashboard}</p>
        <button type="button" className={d.saveBtn} onClick={startEditing}>
          {ru.objectPage.edit}
        </button>
      </div>
    )
  }

  const stacked = mobile ? stackLayout(layout) : layout
  return (
    <div>
      <div className={d.dashBar}>
        <button type="button" className={d.saveBtn} onClick={startEditing}>
          {ru.objectPage.edit}
        </button>
      </div>
      <ResponsiveGrid
        className={d.grid}
        breakpoints={{ lg: 1280, md: 768, sm: 0 }}
        cols={{ lg: 12, md: 6, sm: 1 }}
        rowHeight={76}
        margin={[12, 12]}
        layouts={{
          lg: stacked.map((w) => ({ ...w.grid, i: w.id })),
          md: stacked.map((w) => ({ ...w.grid, i: w.id })),
          sm: stacked.map((w) => ({ ...w.grid, i: w.id })),
        }}
        isDraggable={false}
        isResizable={false}
      >
        {stacked.map((w) => gridFrame(w, false, () => undefined))}
      </ResponsiveGrid>
    </div>
  )
}
