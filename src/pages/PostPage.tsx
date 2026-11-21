import { lazy, Suspense, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import type { components } from '@/api/types.gen'
import { api } from '@/api/client'
import { useActuators } from '@/api/endpoints/actuators'
import { useAlarms } from '@/api/endpoints/alarms'
import { useModems } from '@/api/endpoints/modems'
import { useTagValues } from '@/api/endpoints/tags'
import { ru } from '@/i18n/ru'
import { formatDateTimeRu } from '@/lib/time'
import { CardWidget } from '@/widgets/Card'
import { ChartWidget } from '@/widgets/Chart'
import { formatNumber } from '@/widgets/quality'
import type { SoilDepthTag } from './Soil3D'
import s from './post.module.css'

/*
 * Страница поста (05 §4): шапка — название, участок, модем (батарея В, запас
 * SNR дБ, RSSI по БС, последняя связь); текущие значения (карточки), soil3d
 * (если ≥ 2 глубины), график 24 ч, исполнители (мини-панели), тревоги поста.
 * Управление исполнителями — на страницах устройств (T12), ack тревог — T13.
 */

type PostT = components['schemas']['Post']
type ChannelT = components['schemas']['Channel']
type TagValueT = components['schemas']['TagValue']
type ModemT = components['schemas']['Modem']
type ActuatorT = components['schemas']['Actuator']

/** Цвет чипа приоритета тревоги (06: --alarm-p1..p4) */
const PRIORITY_CLASS: Record<number, string> = {
  1: 'alarmP1',
  2: 'alarmP2',
  3: 'alarmP3',
  4: 'alarmP4',
}

// Soil3D лениво: three.js в отдельный чанк (как Scene3D, 02 §7)
const Soil3DLazy = lazy(() => import('./Soil3D').then((m) => ({ default: m.Soil3D })))

const PARAM_SOIL_MOISTURE = 0x03
const PARAM_SOIL_TEMP = 0x04

function useQueryPosts(objectId: number) {
  return useQuery({
    queryKey: ['posts', objectId],
    queryFn: () => api.get<PostT[]>(`/posts?object_id=${objectId}`),
    enabled: Number.isFinite(objectId),
  })
}

function useQueryChannels() {
  return useQuery({
    queryKey: ['channels', 'assigned'],
    queryFn: () => api.get<ChannelT[]>('/channels?status=assigned'),
  })
}

/** soil3d: грунтовые каналы поста по видам (07 §3.2 — level_cm < 0) */
export function soilTagsOf(
  channels: ChannelT[],
  tagIds: Set<string>,
  code: number,
): SoilDepthTag[] {
  return channels
    .filter(
      (ch) =>
        ch.param_code === code && (ch.level_cm ?? 0) < 0 && ch.tag_id && tagIds.has(ch.tag_id),
    )
    .map((ch) => ({ tagId: ch.tag_id!, depthCm: -(ch.level_cm ?? 0), unit: ch.unit ?? '' }))
    .sort((a, b) => a.depthCm - b.depthCm)
}

/** Ключ базовой станции: 'bs1' → 'БС-1' (формат receptions мока; BR-FE-1) */
export function bsLabel(key: string): string {
  return key.replace(/^bs/i, 'БС-')
}

export function batteryText(batMv: number | null | undefined): string {
  return batMv == null ? '—' : `${formatNumber(batMv / 1000)} В`
}

/** Все данные страницы поста: запросы + производные списки (PostPage — только вид) */
function usePostPageData(objId: number, pId: number) {
  const valid = Number.isFinite(objId) && Number.isFinite(pId)
  const { data: posts, isError, refetch } = useQueryPosts(valid ? objId : -1)
  const { data: channels } = useQueryChannels()
  const { data: modems } = useModems()
  const { data: actuators } = useActuators()
  const { data: alarms } = useAlarms()
  const { data: current } = useTagValues(
    (channels ?? []).map((c) => c.tag_id ?? '').filter(Boolean),
    60_000,
  )

  const post = posts?.find((p) => p.id === pId)

  const postValues = useMemo(
    () => ((current ?? []) as TagValueT[]).filter((v) => v.post_id === pId),
    [current, pId],
  )

  const myChannels = useMemo(() => {
    const ids = new Set(postValues.map((v) => v.tag_id ?? ''))
    return (channels ?? []).filter((ch) => ch.tag_id && ids.has(ch.tag_id))
  }, [channels, postValues])

  const boundIds = useMemo(() => new Set(myChannels.map((c) => c.tag_id!)), [myChannels])
  const moisture = useMemo(
    () => soilTagsOf(myChannels, boundIds, PARAM_SOIL_MOISTURE),
    [myChannels, boundIds],
  )
  const temperature = useMemo(
    () => soilTagsOf(myChannels, boundIds, PARAM_SOIL_TEMP),
    [myChannels, boundIds],
  )

  const modem: ModemT | undefined = useMemo(() => {
    const eui = myChannels[0]?.dev_eui
    return eui ? (modems ?? []).find((m) => m.dev_eui === eui) : undefined
  }, [myChannels, modems])

  const myActuators = useMemo(
    () => (actuators ?? []).filter((a) => a.post_id === pId),
    [actuators, pId],
  )
  const myAlarms = useMemo(
    () => (alarms ?? []).filter((a) => a.post_id === pId && (a.state ?? '').startsWith('active')),
    [alarms, pId],
  )
  const chartTags = useMemo(
    () => postValues.map((v) => v.tag_id ?? '').filter(Boolean),
    [postValues],
  )

  return {
    posts,
    post,
    isError,
    refetch,
    postValues,
    moisture,
    temperature,
    modem,
    myActuators,
    myAlarms,
    chartTags,
  }
}

export function PostPage() {
  const { objectId, postId } = useParams()
  const objId = Number(objectId)
  const pId = Number(postId)
  const {
    posts,
    post,
    isError,
    refetch,
    postValues,
    moisture,
    temperature,
    modem,
    myActuators,
    myAlarms,
    chartTags,
  } = usePostPageData(objId, pId)

  if (isError) {
    return (
      <main className={s.page}>
        <div className={s.errorCard}>
          <p>{ru.widgets.loadError}</p>
          <button type="button" className={s.retry} onClick={() => void refetch()}>
            {ru.widgets.retry}
          </button>
        </div>
      </main>
    )
  }

  if (!post) {
    return (
      <main className={s.page}>
        <p>{posts ? ru.postPage.notFound : ru.widgets.noData}</p>
      </main>
    )
  }

  return (
    <main className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>{post.name}</h1>
          <p className={s.plot}>{post.plot_name}</p>
        </div>
        <Link className={s.back} to={`/o/${objId}`}>
          ← {ru.postPage.back}
        </Link>
      </div>

      <ModemCard modem={modem} />

      <section aria-label={ru.postPage.values}>
        <h2 className={s.blockTitle}>{ru.postPage.values}</h2>
        <div className={s.valueGrid}>
          {postValues.map((v) => (
            <CardWidget key={v.tag_id} title={v.name ?? undefined} tags={[v.tag_id ?? '']} />
          ))}
          {postValues.length === 0 && <p className={s.empty}>{ru.widgets.noData}</p>}
        </div>
      </section>

      <Suspense fallback={<p className={s.empty}>{ru.widgets.noData}</p>}>
        <Soil3DLazy moisture={moisture} temperature={temperature} />
      </Suspense>

      <section aria-label={ru.postPage.chart24h}>
        <h2 className={s.blockTitle}>{ru.postPage.chart24h}</h2>
        {chartTags.length > 0 ? (
          <ChartWidget title={ru.postPage.chart24h} tags={chartTags} period="24h" agg="avg" />
        ) : (
          <p className={s.empty}>{ru.widgets.noData}</p>
        )}
      </section>

      <section aria-label={ru.postPage.executors}>
        <h2 className={s.blockTitle}>{ru.postPage.executors}</h2>
        <div className={s.execGrid}>
          {myActuators.map((a) => (
            <ExecPanel key={a.id} actuator={a} />
          ))}
          {myActuators.length === 0 && <p className={s.empty}>{ru.postPage.noExecutors}</p>}
        </div>
      </section>

      <section aria-label={ru.postPage.alarms}>
        <h2 className={s.blockTitle}>{ru.postPage.alarms}</h2>
        {myAlarms.length === 0 ? (
          <p className={s.empty}>{ru.postPage.noAlarms}</p>
        ) : (
          <ul className={s.alarmList}>
            {myAlarms.map((al) => {
              const pc = al.priority != null ? PRIORITY_CLASS[al.priority] : undefined
              return (
                <li key={al.id} className={s.alarmRow}>
                  <span className={pc ? `${s.alarmP} ${s[pc]}` : s.alarmP}>
                    P{al.priority ?? '—'}
                  </span>
                  <span className={s.alarmMsg}>{al.message}</span>
                  <span className={s.alarmTime}>
                    {al.raised_at ? formatDateTimeRu(al.raised_at) : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

/** Шапка модема (05 §4): батарея В, запас SNR дБ, RSSI по БС, последняя связь */
function ModemCard({ modem }: { modem: ModemT | undefined }) {
  if (!modem) return <p className={s.empty}>{ru.postPage.noModem}</p>
  const receptions = Object.entries(modem.receptions ?? {}).sort(([a], [b]) => a.localeCompare(b))
  return (
    <div className={s.modemCard} data-testid="modem-card">
      <div className={s.modemName}>
        {ru.postPage.modem}: {modem.dev_name || modem.dev_eui}
      </div>
      <dl className={s.modemFacts}>
        <div>
          <dt>{ru.postPage.battery}</dt>
          <dd>{batteryText(modem.bat_mv)}</dd>
        </div>
        <div>
          <dt>{ru.postPage.snr}</dt>
          <dd>{modem.margin_db == null ? '—' : `${formatNumber(modem.margin_db)} дБ`}</dd>
        </div>
        <div>
          <dt>{ru.postPage.rssi}</dt>
          <dd>
            {receptions.length === 0
              ? '—'
              : receptions.map(([k, v]) => `${bsLabel(k)}: ${v.rssi} дБм`).join(', ')}
          </dd>
        </div>
        <div>
          <dt>{ru.postPage.lastSeen}</dt>
          <dd>{modem.last_seen ? formatDateTimeRu(modem.last_seen) : '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

/** Мини-панель исполнителя: состояние + режим + ссылка на устройство (T12) */
function ExecPanel({ actuator: a }: { actuator: ActuatorT }) {
  const on = a.fact_state === 'on' || a.fact_state === 'open'
  const stateText =
    a.fact_state === 'fault'
      ? ru.scene3d.panelFault
      : a.fact_state === 'unknown' || a.fact_state === 'pending'
        ? ru.widgets.lampUnknown
        : on
          ? ru.scene3d.panelOn
          : ru.scene3d.panelOff
  const stateClass = a.fact_state === 'fault' ? s.execFault : on ? s.execOn : s.execOff
  return (
    <div className={s.execCard}>
      <Link to={`/a/${a.id}`} className={s.execName}>
        {a.name}
      </Link>
      <span className={`${s.execState} ${stateClass}`}>{stateText}</span>
      <span className={s.execMode}>
        {a.mode === 'manual' ? ru.postPage.modeManual : ru.postPage.modeAuto}
      </span>
      <Link to={`/a/${a.id}`} className={s.execLink}>
        {ru.postPage.openDevice}
      </Link>
    </div>
  )
}
