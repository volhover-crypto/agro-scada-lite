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
  mergeRegistryObjects,
  SYSTEM_TEMPLATES,
  useObjectCatalogStore,
  type ObjectTemplate,
  type ObjectTypeCode,
  type RegistryStatus,
  type TemplatePropertyDef,
} from '@/state/objectCatalog'
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
 * Настройки (T16, 05 §10):
 * - Реестр объектов хозяйства (создание из шаблона, статус Черновик / В системе / Архив, редактирование);
 * - Справочник шаблонов объектов (универсальные системные + пользовательские с конструктором свойств);
 * - Привязка каналов (onboarding, POST /bindings);
 * - Команды / тревоги / оповещения (read-only, BR-FE-7);
 * - Симулятор и флаги клиента.
 */

type ObjectT = components['schemas']['Object']
type ChannelT = components['schemas']['Channel']
type CommandDefT = components['schemas']['CommandDef']
type ActuatorT = components['schemas']['Actuator']
type AlarmDefT = Record<string, unknown>
type ChainT = Record<string, unknown>
type NotifyChannelT = { id: number; type?: string; address?: string; enabled?: boolean }

const TABS = [
  ['objects', 'Реестр объектов'],
  ['templates', 'Справочник шаблонов'],
  ['binding', ru.settings.tabBinding],
  ['commands', ru.settings.tabCommands],
  ['alarms', ru.settings.tabAlarms],
  ['notify', ru.settings.tabNotify],
  ['simulator', ru.settings.tabSimulator],
] as const

type Tab = (typeof TABS)[number][0]

const STATUS_LABELS: Record<RegistryStatus, string> = {
  active: 'В системе',
  draft: 'Черновик',
  archived: 'В архиве',
}

export function SettingsPage() {
  const { '*': section } = useParams()
  const [tab, setTab] = useState<Tab>(() => {
    const key = (section ?? 'objects') as Tab
    return TABS.some(([t]) => t === key) ? key : 'objects'
  })
  const [preselectTemplateId, setPreselectTemplateId] = useState<string | null>(null)
  const simMode = useUiStore((st) => st.simMode)

  function handleUseTemplate(templateId: string) {
    setPreselectTemplateId(templateId)
    setTab('objects')
  }

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

      {tab === 'objects' && (
        <ObjectsTab
          preselectTemplateId={preselectTemplateId}
          onClearPreselect={() => setPreselectTemplateId(null)}
        />
      )}
      {tab === 'templates' && <TemplatesTab onUseTemplate={handleUseTemplate} />}
      {tab === 'binding' && <BindingTab />}
      {tab === 'commands' && <CommandsTab />}
      {tab === 'alarms' && <AlarmsTab />}
      {tab === 'notify' && <NotifyTab />}
      {tab === 'simulator' && <SimulatorTab simMode={simMode} />}
    </main>
  )
}

/** Справочник шаблонов объектов: универсальные системные + пользовательские */
function TemplatesTab({ onUseTemplate }: { onUseTemplate: (templateId: string) => void }) {
  const customTemplates = useObjectCatalogStore((st) => st.customTemplates)
  const addTemplate = useObjectCatalogStore((st) => st.addTemplate)
  const deleteTemplate = useObjectCatalogStore((st) => st.deleteTemplate)
  const allTemplates = [...SYSTEM_TEMPLATES, ...customTemplates]

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [objectType, setObjectType] = useState<ObjectTypeCode>('other')
  const [description, setDescription] = useState('')
  const [props, setProps] = useState<TemplatePropertyDef[]>([
    { key: 'prop_1', label: 'Площадь', unit: 'га' },
  ])

  function addPropRow() {
    setProps((p) => [...p, { key: `prop_${Date.now()}`, label: '', unit: '' }])
  }

  function updateProp(idx: number, patch: Partial<TemplatePropertyDef>) {
    setProps((p) => p.map((item, i) => (i === idx ? { ...item, ...patch } : item)))
  }

  function removeProp(idx: number) {
    setProps((p) => p.filter((_, i) => i !== idx))
  }

  function saveTemplate() {
    if (!name.trim()) return
    const cleanProps = props
      .filter((p) => p.label.trim() !== '')
      .map((p, idx) => ({
        key: p.key || `prop_${idx}`,
        label: p.label.trim(),
        unit: p.unit?.trim() || undefined,
      }))
    addTemplate({
      name: name.trim(),
      object_type: objectType,
      description: description.trim(),
      properties: cleanProps,
    })
    setName('')
    setDescription('')
    setObjectType('other')
    setProps([{ key: 'prop_1', label: '', unit: '' }])
    setCreating(false)
  }

  return (
    <div className={s.card}>
      <div className={s.toolbar}>
        <div>
          <h2 className={s.stepTitle}>Универсальный справочник шаблонов</h2>
          <p className={s.hint}>
            Базовые шаблоны доступны для любого хозяйства. При необходимости добавьте свой тип объекта с нужными свойствами.
          </p>
        </div>
        <button type="button" className={s.btnPrimary} onClick={() => setCreating((v) => !v)}>
          {creating ? 'Скрыть форму' : '+ Новый шаблон'}
        </button>
      </div>

      {creating && (
        <div className={s.formBox}>
          <div className={s.formGrid}>
            <label className={s.field}>
              Название шаблона
              <input
                className={s.input}
                placeholder="Например: Холодильная камера"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className={s.field}>
              Базовый тип (для 3D/2D и иконок)
              <select
                className={s.select}
                value={objectType}
                onChange={(e) => setObjectType(e.target.value as ObjectTypeCode)}
              >
                {OBJECT_TYPES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={s.field}>
            Описание
            <input
              className={s.input}
              placeholder="Краткое назначение типового объекта"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className={s.field}>
            <span>Свойства шаблона (заполняются при добавлении объекта в реестр):</span>
            {props.map((p, idx) => (
              <div key={p.key} className={s.fieldRow}>
                <input
                  className={s.input}
                  placeholder="Название свойства (напр. Объём)"
                  value={p.label}
                  onChange={(e) => updateProp(idx, { label: e.target.value })}
                />
                <input
                  className={s.input}
                  placeholder="Ед. изм. (напр. м³)"
                  value={p.unit ?? ''}
                  onChange={(e) => updateProp(idx, { unit: e.target.value })}
                />
                <button type="button" className={s.btn} onClick={() => removeProp(idx)}>
                  ×
                </button>
              </div>
            ))}
            <div>
              <button type="button" className={s.btn} onClick={addPropRow}>
                + Добавить свойство
              </button>
            </div>
          </div>

          <div className={s.fieldRow}>
            <button
              type="button"
              className={s.btnPrimary}
              disabled={!name.trim()}
              onClick={saveTemplate}
            >
              Сохранить в справочник
            </button>
            <button type="button" className={s.btn} onClick={() => setCreating(false)}>
              {ru.settings.cancel}
            </button>
          </div>
        </div>
      )}

      <div className={s.templateGrid}>
        {allTemplates.map((tpl) => (
          <div key={tpl.id} className={s.templateCard}>
            <div className={s.templateHead}>
              <strong>{tpl.name}</strong>
              <span className={tpl.scope === 'system' ? s.badgeSystem : s.badgeCustom}>
                {tpl.scope === 'system' ? 'Системный' : 'Свой'}
              </span>
            </div>
            <p className={s.hint}>{tpl.description || objectTypeLabel(tpl.object_type)}</p>
            <div className={s.propTags}>
              {tpl.properties.map((p) => (
                <span key={p.key} className={s.propTag}>
                  {p.label}
                  {p.unit ? `, ${p.unit}` : ''}
                </span>
              ))}
            </div>
            <div className={s.fieldRow}>
              <button
                type="button"
                className={s.btnPrimary}
                onClick={() => onUseTemplate(tpl.id)}
              >
                Добавить в реестр →
              </button>
              {tpl.scope === 'custom' && (
                <button type="button" className={s.btn} onClick={() => deleteTemplate(tpl.id)}>
                  Удалить
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Реестр объектов хозяйства: добавление из шаблона + управление активацией */
function ObjectsTab({
  preselectTemplateId,
  onClearPreselect,
}: {
  preselectTemplateId: string | null
  onClearPreselect: () => void
}) {
  const { data: apiObjects } = useObjects()
  const { data: posts } = usePosts()
  const update = useUpdateObject()

  const customTemplates = useObjectCatalogStore((st) => st.customTemplates)
  const customObjects = useObjectCatalogStore((st) => st.customObjects)
  const registryMeta = useObjectCatalogStore((st) => st.registryMeta)
  const addRegistryObject = useObjectCatalogStore((st) => st.addRegistryObject)
  const setObjectStatus = useObjectCatalogStore((st) => st.setObjectStatus)

  const allTemplates = [...SYSTEM_TEMPLATES, ...customTemplates]
  const allObjects = mergeRegistryObjects(apiObjects ?? [], customObjects)

  const [editing, setEditing] = useState<number | null>(null)
  const [saved, setSaved] = useState<number | null>(null)
  const [adding, setAdding] = useState(Boolean(preselectTemplateId))
  const [selectedTplId, setSelectedTplId] = useState(preselectTemplateId ?? allTemplates[0]!.id)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newLat, setNewLat] = useState('44.5320')
  const [newLon, setNewLon] = useState('33.7010')
  const [newProps, setNewProps] = useState<Record<string, string>>({})

  const activeTemplate: ObjectTemplate | undefined =
    allTemplates.find((t) => t.id === (preselectTemplateId ?? selectedTplId)) ?? allTemplates[0]

  function handleCreate(initialStatus: RegistryStatus) {
    if (!newName.trim() || !activeTemplate) return
    const created = addRegistryObject(
      {
        name: newName.trim(),
        object_type: activeTemplate.object_type,
        lat: Number(newLat) || 44.532,
        lon: Number(newLon) || 33.701,
      },
      {
        templateId: activeTemplate.id,
        description: newDesc.trim() || activeTemplate.description,
        properties: { ...newProps },
        status: initialStatus,
      },
    )
    setNewName('')
    setNewDesc('')
    setNewProps({})
    setAdding(false)
    onClearPreselect()
    setSaved(created.id)
  }

  return (
    <div className={s.card}>
      <div className={s.toolbar}>
        <div>
          <h2 className={s.stepTitle}>Реестр объектов хозяйства</h2>
          <p className={s.hint}>
            Профиль вашего хозяйства: добавляйте объекты из справочника шаблонов и активируйте нужные для вывода в мониторинг.
          </p>
        </div>
        <button
          type="button"
          className={s.btnPrimary}
          onClick={() => {
            setAdding((v) => !v)
            onClearPreselect()
          }}
        >
          {adding ? 'Скрыть форму' : '+ Добавить из шаблона'}
        </button>
      </div>

      {(adding || preselectTemplateId) && activeTemplate && (
        <div className={s.formBox}>
          <div className={s.formGrid}>
            <label className={s.field}>
              Шаблон из справочника
              <select
                className={s.select}
                value={activeTemplate.id}
                onChange={(e) => {
                  onClearPreselect()
                  setSelectedTplId(e.target.value)
                  setNewProps({})
                }}
              >
                {allTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.scope === 'system' ? 'системный' : 'свой'})
                  </option>
                ))}
              </select>
            </label>
            <label className={s.field}>
              Название объекта в хозяйстве
              <input
                className={s.input}
                placeholder={`Например: ${activeTemplate.name} №2`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
          </div>

          <div className={s.formGrid}>
            <label className={s.field}>
              Описание
              <input
                className={s.input}
                placeholder={activeTemplate.description}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </label>
            <div className={s.fieldRow}>
              <label className={s.field}>
                Широта (lat)
                <input
                  className={s.input}
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                />
              </label>
              <label className={s.field}>
                Долгота (lon)
                <input
                  className={s.input}
                  value={newLon}
                  onChange={(e) => setNewLon(e.target.value)}
                />
              </label>
            </div>
          </div>

          {activeTemplate.properties.length > 0 && (
            <div className={s.formGrid}>
              {activeTemplate.properties.map((prop) => (
                <label key={prop.key} className={s.field}>
                  {prop.label}
                  {prop.unit ? ` (${prop.unit})` : ''}
                  <input
                    className={s.input}
                    value={newProps[prop.key] ?? ''}
                    onChange={(e) =>
                      setNewProps((prev) => ({ ...prev, [prop.key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
          )}

          <div className={s.fieldRow}>
            <button
              type="button"
              className={s.btnPrimary}
              disabled={!newName.trim()}
              onClick={() => handleCreate('active')}
            >
              Добавить и активировать
            </button>
            <button
              type="button"
              className={s.btn}
              disabled={!newName.trim()}
              onClick={() => handleCreate('draft')}
            >
              Сохранить как черновик
            </button>
            <button
              type="button"
              className={s.btn}
              onClick={() => {
                setAdding(false)
                onClearPreselect()
              }}
            >
              {ru.settings.cancel}
            </button>
          </div>
        </div>
      )}

      <table className={s.table}>
        <thead>
          <tr>
            <th>{ru.settings.colName}</th>
            <th>{ru.settings.colType}</th>
            <th>Статус</th>
            <th>{ru.settings.colCoords}</th>
            <th aria-label="Действия" />
          </tr>
        </thead>
        <tbody>
          {allObjects.map((o) => {
            const meta = o.id != null ? registryMeta[o.id] : undefined
            const status: RegistryStatus = meta?.status ?? 'active'
            const tpl = meta?.templateId
              ? allTemplates.find((t) => t.id === meta.templateId)
              : undefined
            const isCustom = customObjects.some((c) => c.id === o.id)

            return editing === o.id && !isCustom ? (
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
                  <strong>{o.name}</strong>
                  {saved === o.id && <span className={s.savedMark}> · {ru.settings.saved}</span>}
                  {meta?.description && <div className={s.policyHint}>{meta.description}</div>}
                  {meta?.properties && Object.keys(meta.properties).length > 0 && (
                    <div className={s.propTags}>
                      {Object.entries(meta.properties)
                        .filter(([, val]) => val.trim() !== '')
                        .map(([k, val]) => {
                          const def = tpl?.properties.find((p) => p.key === k)
                          return (
                            <span key={k} className={s.propTag}>
                              {def?.label ?? k}: {val}
                              {def?.unit ? ` ${def.unit}` : ''}
                            </span>
                          )
                        })}
                    </div>
                  )}
                </td>
                <td>{tpl?.name ?? objectTypeLabel(o.object_type)}</td>
                <td>
                  <span
                    className={
                      status === 'active'
                        ? s.statusActive
                        : status === 'draft'
                          ? s.statusDraft
                          : s.statusArchived
                    }
                  >
                    {STATUS_LABELS[status]}
                  </span>
                </td>
                <td className={s.hint}>
                  {o.lat?.toFixed(4)}, {o.lon?.toFixed(4)}
                </td>
                <td>
                  <div className={s.fieldRow}>
                    {status !== 'active' ? (
                      <button
                        type="button"
                        className={s.btnPrimary}
                        onClick={() => o.id != null && setObjectStatus(o.id, 'active')}
                      >
                        Активировать
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={s.btn}
                        onClick={() => o.id != null && setObjectStatus(o.id, 'draft')}
                      >
                        В черновик
                      </button>
                    )}
                    {status !== 'archived' && (
                      <button
                        type="button"
                        className={s.btn}
                        onClick={() => o.id != null && setObjectStatus(o.id, 'archived')}
                      >
                        В архив
                      </button>
                    )}
                    {!isCustom && (
                      <button
                        type="button"
                        className={s.btn}
                        onClick={() => setEditing(o.id ?? null)}
                      >
                        {ru.settings.edit}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
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
      <td />
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
