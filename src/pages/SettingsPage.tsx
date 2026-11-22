import { useState } from 'react'
import { useParams } from 'react-router'
import type { components } from '@/api/types.gen'
import {
  useCreateBinding,
  useSettingsSection,
  useUnassignedChannels,
  useUpdateClientSettings,
  useUpdateObject,
} from '@/api/endpoints/settings'
import { useObjects, usePosts } from '@/api/endpoints/objects'
import { useModems } from '@/api/endpoints/modems'
import { ru } from '@/i18n/ru'
import { useUiStore } from '@/state/ui'
import {
  channelBindingInfo,
  channelLiveValue,
  objectTypeLabel,
  policyHint,
  policyLabel,
  OBJECT_TYPES,
} from './settings-helpers'
import s from './settings.module.css'

/*
 * Настройки (T16, 05 §10): объекты (PUT /objects/{id}), привязка/onboarding
 * (POST /bindings — приёмка: 4 канала привязаны, исчезают из неназначенных),
 * команды/тревоги/цепочки/оповещения — read-only (PUT в контракте — object
 * без деталей, BR-FE-7); симулятор — только чтение флага (BR-FE-6, D-18);
 * внешние источники — после обновления контракта (В3). Позиции постов
 * (scene_x/y) — read-only до появления PUT /posts (BR-FE-9).
 */

type ObjectT = components['schemas']['Object']
type ChannelT = components['schemas']['Channel']
type CommandDefT = components['schemas']['CommandDef']
type ActuatorT = components['schemas']['Actuator']
type AlarmDefT = Record<string, unknown>
type ChainT = Record<string, unknown>
type NotifyChannelT = { id: number; type?: string; address?: string; enabled?: boolean }

const TABS = [
  ['objects', ru.settings.tabObjects],
  ['binding', ru.settings.tabBinding],
  ['commands', ru.settings.tabCommands],
  ['alarms', ru.settings.tabAlarms],
  ['notify', ru.settings.tabNotify],
  ['simulator', ru.settings.tabSimulator],
] as const

type Tab = (typeof TABS)[number][0]

export function SettingsPage() {
  const { '*': section } = useParams()
  const [tab, setTab] = useState<Tab>(() => {
    const key = (section ?? 'objects') as Tab
    return TABS.some(([t]) => t === key) ? key : 'objects'
  })
  const simMode = useUiStore((st) => st.simMode)

  return (
    <main className={s.page}>
      <h1 className={s.title}>{ru.settings.title}</h1>

      <div className={s.tabs} role="tablist" aria-label={ru.settings.title}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? s.tabActive : s.tab}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'objects' && <ObjectsTab />}
      {tab === 'binding' && <BindingTab />}
      {tab === 'commands' && <CommandsTab />}
      {tab === 'alarms' && <AlarmsTab />}
      {tab === 'notify' && <NotifyTab />}
      {tab === 'simulator' && <SimulatorTab simMode={simMode} />}
    </main>
  )
}

/** Объекты и посты (05 §10): объекты редактируются, посты — read-only (BR-FE-9) */
function ObjectsTab() {
  const { data: objects } = useObjects()
  const { data: posts } = usePosts()
  const update = useUpdateObject()
  const [editing, setEditing] = useState<number | null>(null)
  const [saved, setSaved] = useState<number | null>(null)

  return (
    <div className={s.card}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>{ru.settings.colName}</th>
            <th>{ru.settings.colType}</th>
            <th>{ru.settings.colCoords}</th>
            <th aria-label="Действия" />
          </tr>
        </thead>
        <tbody>
          {(objects ?? []).map((o) =>
            editing === o.id ? (
              <ObjectEditRow
                key={o.id}
                object={o}
                saving={update.isPending}
                onSave={(body) =>
                  update.mutate(
                    { id: o.id!, body },
                    {
                      onSuccess: () => {
                        setEditing(null)
                        setSaved(o.id ?? null)
                      },
                    },
                  )
                }
                onCancel={() => setEditing(null)}
              />
            ) : (
              <tr key={o.id} data-testid="object-row">
                <td>
                  {o.name}
                  {saved === o.id && <span className={s.savedMark}> · {ru.settings.saved}</span>}
                </td>
                <td>{objectTypeLabel(o.object_type)}</td>
                <td className={s.hint}>
                  {o.lat?.toFixed(4)}, {o.lon?.toFixed(4)}
                </td>
                <td>
                  <button type="button" className={s.btn} onClick={() => setEditing(o.id ?? null)}>
                    {ru.settings.edit}
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <h2 className={s.stepTitle}>{ru.settings.colScene}</h2>
      <table className={s.table}>
        <thead>
          <tr>
            <th>{ru.settings.colName}</th>
            <th>{ru.settings.colScene}</th>
          </tr>
        </thead>
        <tbody>
          {(posts ?? []).map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td className={s.hint}>
                {p.scene_x ?? '—'}, {p.scene_y ?? '—'} · {ru.settings.sceneReadOnly}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ObjectEditRow({
  object: o,
  saving,
  onSave,
  onCancel,
}: {
  object: ObjectT
  saving: boolean
  onSave: (body: Partial<ObjectT>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(o.name ?? '')
  const [type, setType] = useState<NonNullable<ObjectT['object_type']>>(o.object_type ?? 'other')
  return (
    <tr data-testid="object-edit">
      <td>
        <input
          className={s.input}
          value={name}
          aria-label={ru.settings.colName}
          onChange={(e) => setName(e.target.value)}
        />
      </td>
      <td>
        <select
          className={s.select}
          aria-label={ru.settings.colType}
          value={type}
          onChange={(e) => setType(e.target.value as NonNullable<ObjectT['object_type']>)}
        >
          {OBJECT_TYPES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className={s.hint}>
        {o.lat?.toFixed(4)}, {o.lon?.toFixed(4)}
      </td>
      <td>
        <div className={s.fieldRow}>
          <button
            type="button"
            className={s.btnPrimary}
            disabled={saving || name.trim() === ''}
            onClick={() => onSave({ name, object_type: type })}
          >
            {ru.settings.save}
          </button>
          <button type="button" className={s.btn} onClick={onCancel}>
            {ru.settings.cancel}
          </button>
        </div>
      </td>
    </tr>
  )
}

/** Привязка каналов (onboarding, 05 §10) — приёмка T16 */
function BindingTab() {
  const { data: channels } = useUnassignedChannels()
  const { data: posts } = usePosts()
  const { data: modems } = useModems()
  const bind = useCreateBinding()
  const [postId, setPostId] = useState<Record<number, number>>({})
  const [range, setRange] = useState<Record<number, string>>({})
  const [bound, setBound] = useState<number[]>([])

  const unassigned = ((channels ?? []) as ChannelT[]).filter((c) => !bound.includes(c.id ?? 0))

  function bindChannel(ch: ChannelT): void {
    const pid = postId[ch.id ?? 0]
    if (!pid) return
    const [min, max] = (range[ch.id ?? 0] ?? '').split('-').map((v) => Number(v.trim()))
    bind.mutate(
      {
        channel_id: ch.id,
        post_id: pid,
        range_min: Number.isFinite(min) ? min : 0,
        range_max: Number.isFinite(max) ? max : 100,
      },
      {
        onSuccess: () => {
          setBound((b) => [...b, ch.id ?? 0])
        },
      },
    )
  }

  return (
    <div className={s.card}>
      <h2 className={s.stepTitle}>{ru.settings.bindingTitle}</h2>
      <p className={s.hint}>{ru.settings.bindingHint}</p>

      {unassigned.length === 0 ? (
        <p className={s.empty} data-testid="binding-empty">
          {ru.settings.bindingEmpty}
        </p>
      ) : (
        <div>
          {unassigned.map((ch) => {
            const modemName =
              (modems ?? []).find((m) => m.dev_eui === ch.dev_eui)?.dev_name ?? ch.dev_eui ?? '—'
            return (
              <BindingRow
                key={ch.id}
                channel={ch}
                modemName={modemName}
                posts={posts ?? []}
                post={postId[ch.id ?? 0]}
                range={range[ch.id ?? 0] ?? ''}
                busy={bind.isPending}
                onPost={(v) => setPostId((m) => ({ ...m, [ch.id ?? 0]: v }))}
                onRange={(v) => setRange((m) => ({ ...m, [ch.id ?? 0]: v }))}
                onBind={() => bindChannel(ch)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Строка неназначенного канала: подпись, живое значение, пост, диапазон */
function BindingRow({
  channel: ch,
  modemName,
  posts,
  post,
  range,
  busy,
  onPost,
  onRange,
  onBind,
}: {
  channel: ChannelT
  modemName: string
  posts: components['schemas']['Post'][]
  post: number | undefined
  range: string
  busy: boolean
  onPost: (v: number) => void
  onRange: (v: string) => void
  onBind: () => void
}) {
  const info = channelBindingInfo(ch)
  return (
    <div className={s.channelRow} data-testid="binding-row">
      <div className={s.channelHead}>
        <span className={info.unknown ? s.unknown : undefined}>
          {info.label} · {modemName}
        </span>
        <span className={s.liveValue}>
          {ru.settings.liveValue}: {channelLiveValue(ch)}
        </span>
      </div>
      <div className={s.bindingControls}>
        <label className={s.field}>
          {ru.settings.bindingPost}
          <select
            className={s.select}
            aria-label={`${ru.settings.bindingPost}: ${info.label}`}
            value={post ?? ''}
            disabled={!info.bindable}
            onChange={(e) => onPost(Number(e.target.value))}
          >
            <option value="">—</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field}>
          {ru.settings.bindingRange}
          <input
            className={s.input}
            placeholder="0-100"
            aria-label={`${ru.settings.bindingRange}: ${info.label}`}
            value={range}
            onChange={(e) => onRange(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={s.btnPrimary}
          disabled={!info.bindable || !post || busy}
          onClick={onBind}
        >
          {ru.settings.bindingBind}
        </button>
      </div>
    </div>
  )
}

/** Команды и политики — read-only (BR-FE-7) */
function CommandsTab() {
  const { data: defs } = useSettingsSection<CommandDefT[]>('command_defs')
  const { data: actuators } = useSettingsSection<ActuatorT[]>('actuators')
  return (
    <div className={s.card}>
      <p className={s.readonlyNote}>{ru.settings.readOnlyCommands}</p>
      <table className={s.table}>
        <thead>
          <tr>
            <th>{ru.settings.colName}</th>
            <th>{ru.settings.colPolicy}</th>
            <th>{ru.settings.colDefault}</th>
            <th>{ru.settings.colMax}</th>
          </tr>
        </thead>
        <tbody>
          {(defs ?? []).map((d) => {
            const act = (actuators ?? []).find((a) => a.id === d.actuator_id)
            return (
              <tr key={d.id} data-testid="command-def-row">
                <td>
                  {act?.name ?? '—'} · {policyLabel(d.action)}
                </td>
                <td>
                  {policyLabel(d.confirm_policy)}
                  <div className={s.policyHint}>{policyHint(d.confirm_policy)}</div>
                </td>
                <td>
                  {act?.default_duration_s ? `${Math.round(act.default_duration_s / 60)} мин` : '—'}
                </td>
                <td>{act?.max_duration_s ? `${Math.round(act.max_duration_s / 3600)} ч` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Определения тревог и цепочки — read-only (BR-FE-7) */
function AlarmsTab() {
  const { data: alarmDefs } = useSettingsSection<AlarmDefT[]>('alarm_defs')
  const { data: chains } = useSettingsSection<ChainT[]>('chains')
  return (
    <div className={s.card}>
      <p className={s.readonlyNote}>{ru.settings.readOnlyCommands}</p>
      <h2 className={s.stepTitle}>{ru.settings.tabAlarms}</h2>
      {(alarmDefs ?? []).length === 0 ? (
        <p className={s.empty}>{ru.settings.alarmDefsEmpty}</p>
      ) : (
        <ul>
          {(alarmDefs ?? []).map((d, i) => (
            <li key={i}>
              <code>{JSON.stringify(d)}</code>
            </li>
          ))}
        </ul>
      )}
      <h2 className={s.stepTitle}>{ru.settings.chainSteps}</h2>
      {(chains ?? []).length === 0 ? (
        <p className={s.empty}>{ru.settings.chainsEmpty}</p>
      ) : (
        <ul>
          {(chains ?? []).map((c, i) => (
            <li key={i}>
              <code>{JSON.stringify(c)}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Каналы оповещения — read-only */
function NotifyTab() {
  const { data: channels } = useSettingsSection<NotifyChannelT[]>('channels')
  return (
    <div className={s.card}>
      <p className={s.readonlyNote}>{ru.settings.readOnlyCommands}</p>
      <table className={s.table}>
        <thead>
          <tr>
            <th>{ru.settings.colChannel}</th>
            <th>{ru.settings.colName}</th>
          </tr>
        </thead>
        <tbody>
          {(channels ?? []).map((c) => (
            <tr key={c.id}>
              <td>{c.type ?? '—'}</td>
              <td>{c.address ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Симулятор: флаг только для чтения (BR-FE-6/D-18) + флаги клиента (PUT) */
function SimulatorTab({ simMode }: { simMode: boolean }) {
  const { data: client } = useSettingsSection<{
    internet_allowed?: boolean
    external_sources_allowed?: boolean
    allowed_channels?: string[]
  }>('client')
  const update = useUpdateClientSettings()
  const [saved, setSaved] = useState(false)

  return (
    <div className={s.card}>
      <p className={s.readonlyNote}>{ru.settings.simReadonly}</p>
      <p data-testid="sim-state">
        {ru.settings.tabSimulator}: {simMode ? ru.settings.simOn : ru.settings.simOff}
      </p>

      <h2 className={s.stepTitle}>{ru.settings.clientFlags}</h2>
      <label className={s.checkRow}>
        <input
          type="checkbox"
          checked={client?.internet_allowed ?? false}
          onChange={(e) =>
            update.mutate(
              { internet_allowed: e.target.checked },
              { onSuccess: () => setSaved(true) },
            )
          }
        />
        {ru.settings.internetAllowed}
      </label>
      <label className={s.checkRow}>
        <input
          type="checkbox"
          checked={client?.external_sources_allowed ?? false}
          onChange={(e) =>
            update.mutate(
              { external_sources_allowed: e.target.checked },
              { onSuccess: () => setSaved(true) },
            )
          }
        />
        {ru.settings.externalAllowed}
      </label>
      {saved && <span className={s.savedMark}>{ru.settings.saved}</span>}
      <p className={s.hint}>{ru.settings.noExternalSources}</p>
    </div>
  )
}
