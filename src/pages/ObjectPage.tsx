import { lazy, useEffect, useMemo, useState, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import type { components } from '@/api/types.gen'
import { api } from '@/api/client'
import { useActuators } from '@/api/endpoints/actuators'
import { useAlarms } from '@/api/endpoints/alarms'
import { useCreateDashboard, useDashboards, useUpdateDashboard } from '@/api/endpoints/dashboard'
import { useModems } from '@/api/endpoints/modems'
import { useObjects } from '@/api/endpoints/objects'
import { useTagValues } from '@/api/endpoints/tags'
import { ru } from '@/i18n/ru'
import { DashboardView } from './ObjectDashboard'
import { ObjectMap } from './ObjectMap'
import { buildCatalog, linkStatusOf, objectTypeLabel } from './overview-helpers'
import { ScenePostPanel } from './ScenePostPanel'
import type { WidgetConfig } from '@/widgets/types'
import s from './object.module.css'

// Scene3D лениво: three.js в отдельный чанк (02 §7)
const Scene3DLazy = lazy(() =>
  import('./ObjectScene3D').then((m) => ({ default: m.ObjectScene3D })),
)

/*
 * Страница объекта (05 §3): переключатель вида [3D-сцена][Дашборд][Карта]
 * (по умолчанию 3D при WebGL, иначе дашборд; fallback без WebGL),
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

export function ObjectPage() {
  const { objectId } = useParams()
  const id = Number(objectId)
  const validId = Number.isFinite(id)
  const { data: objects } = useObjects()
  const object = objects?.find((o) => o.id === id)

  const { data: posts } = useQueryPosts(validId ? id : -1)
  const { data: modems } = useModems()
  const { data: alarms } = useAlarms()
  const { data: actuators } = useActuators()
  const { data: dashboards } = useDashboards(validId ? id : null)
  const { data: channels } = useQueryChannels()
  const { data: current } = useTagValues(
    (channels ?? []).map((c) => c.tag_id ?? '').filter(Boolean),
    60_000,
  )

  const [view, setView] = useState<ViewMode | null>(null)
  const webgl = useMemo(() => hasWebGL(), [])
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null)
  useEffect(() => {
    if (view === null) setView(webgl ? '3d' : 'dashboard')
  }, [view, webgl])

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
        name={object.name ?? ''}
        type={object.object_type}
        current={currentView}
        onSelect={setView}
      />

      <LinkBadge ok={link.ok} text={link.text} />

      {currentView === '3d' && !webgl && (
        <div className={s.tbd}>
          <p>{ru.scene3d.noWebgl}</p>
          <button type="button" className={s.viewBtn} onClick={() => setView('dashboard')}>
            {ru.objectPage.viewDashboard}
          </button>
        </div>
      )}

      {currentView === '3d' && webgl && (
        <Suspense fallback={<p>{ru.widgets.noData}</p>}>
          <Scene3DLazy
            posts={(posts ?? []) as PostT[]}
            objectType={object.object_type}
            current={(current ?? []) as TagValueT[]}
            actuators={actuators ?? []}
            alarms={alarms ?? []}
            selectedPostId={selectedPostId}
            onSelectPost={setSelectedPostId}
          >
            {(postId) => (
              <ScenePostPanel
                objectId={id}
                postId={postId}
                name={(posts ?? []).find((p) => p.id === postId)?.name ?? ''}
                plot={(posts ?? []).find((p) => p.id === postId)?.plot_name ?? ''}
                current={(current ?? []) as TagValueT[]}
                actuators={actuators ?? []}
              />
            )}
          </Scene3DLazy>
        </Suspense>
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
