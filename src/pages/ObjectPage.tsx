import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import type { components } from '@/api/types.gen'
import { api } from '@/api/client'
import { useCreateDashboard, useDashboards, useUpdateDashboard } from '@/api/endpoints/dashboard'
import { useModems } from '@/api/endpoints/modems'
import { useObjects } from '@/api/endpoints/objects'
import { useTagValues } from '@/api/endpoints/tags'
import { ru } from '@/i18n/ru'
import { DashboardView } from './ObjectDashboard'
import { ObjectMap } from './ObjectMap'
import { objectTypeLabel } from './overview-helpers'
import type { WidgetConfig } from '@/widgets/types'
import s from './object.module.css'

/*
 * Страница объекта (05 §3): переключатель вида [3D-сцена][Дашборд][Карта]
 * (по умолчанию 3D при WebGL, иначе дашборд; 3D реализуется в T10),
 * полоса статуса связи, дашборд с конструктором, карта.
 */

type PostT = components['schemas']['Post']
type ChannelT = components['schemas']['Channel']
type TagValueT = components['schemas']['TagValue']

type ViewMode = '3d' | 'dashboard' | 'map'

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function useQueryPosts(objectId: number) {
  return useQuery({
    queryKey: ['posts', objectId],
    queryFn: () => api.get<PostT[]>(`/posts?object_id=${objectId}`),
    enabled: Number.isFinite(objectId),
  })
}

/** Текст и «плохость» полосы связи объекта (D-19, агрегат по модемам) */
export function linkStatusOf(total: number, online: number): { text: string; ok: boolean } {
  if (total === 0) return { text: ru.objectPage.linkNone, ok: false }
  if (online === total) return { text: ru.objectPage.linkOk, ok: true }
  return {
    text: ru.objectPage.linkPartial
      .replace('{online}', String(online))
      .replace('{total}', String(total)),
    ok: false,
  }
}

function LinkBadge({ ok, text }: { ok: boolean; text: string }) {
  return <p className={ok ? `${s.link} ${s.linkOk}` : `${s.link} ${s.linkBad}`}>● {text}</p>
}

const VIEWS: Array<[ViewMode, string]> = [
  ['3d', ru.objectPage.view3d],
  ['dashboard', ru.objectPage.viewDashboard],
  ['map', ru.objectPage.viewMap],
]

function ViewSwitch({ current, onSelect }: { current: ViewMode; onSelect: (v: ViewMode) => void }) {
  return (
    <div className={s.viewSwitch} role="tablist" aria-label="Вид">
      {VIEWS.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={current === mode}
          className={current === mode ? `${s.viewBtn} ${s.viewBtnActive}` : s.viewBtn}
          onClick={() => onSelect(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function ObjectHeader({
  name,
  type,
  current,
  onSelect,
}: {
  name: string
  type?: string
  current: ViewMode
  onSelect: (v: ViewMode) => void
}) {
  return (
    <div className={s.head}>
      <h1 className={s.title}>
        {name}
        <span className={s.type}> · {objectTypeLabel(type)}</span>
      </h1>
      <ViewSwitch current={current} onSelect={onSelect} />
    </div>
  )
}

function useQueryChannels() {
  return useQuery({
    queryKey: ['channels', 'assigned'],
    queryFn: () => api.get<ChannelT[]>('/channels?status=assigned'),
  })
}

/** Каталог тегов для конструктора: пост и имя из /tags/current, параметр из канала */
function buildCatalog(
  channels: ChannelT[],
  current: TagValueT[],
): Array<{ tagId: string; label: string }> {
  return channels
    .map((ch) => {
      const tv = current.find((v) => v.tag_id === ch.tag_id)
      if (tv?.post_id == null) return null
      const level = ch.level_cm ? ` ${ch.level_cm} см` : ''
      return {
        tagId: ch.tag_id ?? '',
        label: `Пост ${tv.post_id} · ${tv.name ?? `${ch.param_name}${level}`}`,
      }
    })
    .filter((x): x is { tagId: string; label: string } => x != null && x.tagId !== '')
}

export function ObjectPage() {
  const { objectId } = useParams()
  const id = Number(objectId)
  const validId = Number.isFinite(id)
  const { data: objects } = useObjects()
  const object = objects?.find((o) => o.id === id)

  const { data: posts } = useQueryPosts(validId ? id : -1)
  const { data: modems } = useModems()
  const { data: dashboards } = useDashboards(validId ? id : null)
  const { data: channels } = useQueryChannels()
  const { data: current } = useTagValues(
    (channels ?? []).map((c) => c.tag_id ?? '').filter(Boolean),
    60_000,
  )

  const [view, setView] = useState<ViewMode | null>(null)
  useEffect(() => {
    if (view === null) setView(hasWebGL() ? '3d' : 'dashboard')
  }, [view])

  const dashboard = dashboards?.find((d) => d.object_id === id)
  const create = useCreateDashboard()
  const update = useUpdateDashboard()

  function saveLayout(draft: WidgetConfig[]) {
    if (dashboard?.id != null) {
      update.mutate({ id: dashboard.id, body: { layout: draft } })
    } else {
      create.mutate({ object_id: id, name: 'Основной', layout: draft })
    }
  }

  const catalog = useMemo(
    () => buildCatalog(channels ?? [], (current ?? []) as TagValueT[]),
    [channels, current],
  )

  if (!object) {
    return (
      <main>
        <p>{ru.widgets.noData}</p>
      </main>
    )
  }

  const objectModems = (modems ?? []).filter((m) => m.object_id === id)
  const link = linkStatusOf(
    objectModems.length,
    objectModems.filter((m) => m.link_status === 'online').length,
  )

  const currentView = view ?? 'dashboard'

  return (
    <main className={s.page}>
      <ObjectHeader
        name={object.name ?? ""}
        type={object.object_type}
        current={currentView}
        onSelect={setView}
      />

      <LinkBadge ok={link.ok} text={link.text} />

      {currentView === '3d' && (
        <div className={s.tbd}>
          <p>{ru.objectPage.tbd3d}</p>
          <button type="button" className={s.viewBtn} onClick={() => setView('dashboard')}>
            {ru.objectPage.viewDashboard}
          </button>
        </div>
      )}

      {currentView === 'map' && <ObjectMap posts={(posts ?? []) as PostT[]} objectId={id} />}

      {currentView === 'dashboard' && (
        <DashboardView
          layout={(dashboard?.layout ?? []) as unknown as WidgetConfig[]}
          tagCatalog={catalog}
          onSave={saveLayout}
          saving={update.isPending || create.isPending}
        />
      )}
    </main>
  )
}
