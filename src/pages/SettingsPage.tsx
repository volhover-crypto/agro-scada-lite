import { useState, type ReactNode } from 'react'
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
  getAllGroups,
  getAllTemplates,
  mergeRegistryObjects,
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
 * Настройки (3 укрупнённые вкладки):
 * 1. «Справочник шаблонов» — строчный иерархический справочник в стиле 1С (папки + элементы + текстовые свойства);
 * 2. «Учёт объектов» — Реестр объектов хозяйства | Привязка каналов | Посты;
 * 3. «Работа объектов» — Команды | Тревоги | Оповещения | Симулятор.
 */

type ObjectT = components['schemas']['Object']
type ChannelT = components['schemas']['Channel']
type CommandDefT = components['schemas']['CommandDef']
type ActuatorT = components['schemas']['Actuator']
type AlarmDefT = Record<string, unknown>
type ChainT = Record<string, unknown>
type NotifyChannelT = { id: number; type?: string; address?: string; enabled?: boolean }

type MainTab = 'templates' | 'accounting' | 'operations'
type AccountingSubTab = 'objects' | 'binding' | 'posts'
type OperationsSubTab = 'commands' | 'alarms' | 'notify' | 'simulator'

const MAIN_TABS: readonly [MainTab, string][] = [
  ['templates', 'Справочник шаблонов'],
  ['accounting', 'Учёт объектов'],
  ['operations', 'Работа объектов'],
]

const ACCOUNTING_SUBTABS: readonly [AccountingSubTab, string][] = [
  ['objects', 'Реестр объектов'],
  ['binding', ru.settings.tabBinding],
  ['posts', 'Посты'],
]

const OPERATIONS_SUBTABS: readonly [OperationsSubTab, string][] = [
  ['commands', ru.settings.tabCommands],
  ['alarms', ru.settings.tabAlarms],
  ['notify', ru.settings.tabNotify],
  ['simulator', ru.settings.tabSimulator],
]

const STATUS_LABELS: Record<RegistryStatus, string> = {
  active: 'В системе',
  draft: 'Черновик',
  archived: 'В архиве',
}

function resolveInitialTabs(section?: string): {
  main: MainTab
  acc: AccountingSubTab
  ops: OperationsSubTab
} {
  if (section === 'templates') return { main: 'templates', acc: 'objects', ops: 'commands' }
  if (section === 'binding') return { main: 'accounting', acc: 'binding', ops: 'commands' }
  if (section === 'posts') return { main: 'accounting', acc: 'posts', ops: 'commands' }
  if (
    section === 'commands' ||
    section === 'alarms' ||
    section === 'notify' ||
    section === 'simulator'
  ) {
    return { main: 'operations', acc: 'objects', ops: section }
  }
  return { main: 'accounting', acc: 'objects', ops: 'commands' }
}

export function SettingsPage() {
  const { '*': section } = useParams()
  const init = resolveInitialTabs(section)
  const [mainTab, setMainTab] = useState<MainTab>(init.main)
  const [accTab, setAccTab] = useState<AccountingSubTab>(init.acc)
  const [opsTab, setOpsTab] = useState<OperationsSubTab>(init.ops)
  const [preselectTemplateId, setPreselectTemplateId] = useState<string | null>(null)
  const simMode = useUiStore((st) => st.simMode)

  function handleUseTemplate(templateId: string) {
    setPreselectTemplateId(templateId)
    setMainTab('accounting')
    setAccTab('objects')
  }

  return (
    <main className={s.page}>
      <h1 className={s.title}>{ru.settings.title}</h1>

      <div className={s.tabs} role="tablist" aria-label={ru.settings.title}>
        {MAIN_TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mainTab === key}
            className={mainTab === key ? s.tabActive : s.tab}
            onClick={() => setMainTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {mainTab === 'templates' && <TemplatesTreeTab onUseTemplate={handleUseTemplate} />}

      {mainTab === 'accounting' && (
        <>
          <div className={s.subtabs} role="tablist" aria-label="Учёт объектов">
            {ACCOUNTING_SUBTABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={accTab === key}
                className={accTab === key ? s.subtabActive : s.subtab}
                onClick={() => setAccTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {accTab === 'objects' && (
            <ObjectsTab
              preselectTemplateId={preselectTemplateId}
              onClearPreselect={() => setPreselectTemplateId(null)}
            />
          )}
          {accTab === 'binding' && <BindingTab />}
          {accTab === 'posts' && <PostsTab />}
        </>
      )}

      {mainTab === 'operations' && (
        <>
          <div className={s.subtabs} role="tablist" aria-label="Работа объектов">
            {OPERATIONS_SUBTABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={opsTab === key}
                className={opsTab === key ? s.subtabActive : s.subtab}
                onClick={() => setOpsTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {opsTab === 'commands' && <CommandsTab />}
          {opsTab === 'alarms' && <AlarmsTab />}
          {opsTab === 'notify' && <NotifyTab />}
          {opsTab === 'simulator' && <SimulatorTab simMode={simMode} />}
        </>
      )}
    </main>
  )
}

/** 1. Справочник шаблонов — строчный иерархический справочник в стиле 1С */
function TemplatesTreeTab({ onUseTemplate }: { onUseTemplate: (templateId: string) => void }) {
  const customGroups = useObjectCatalogStore((st) => st.customGroups)
  const customTemplates = useObjectCatalogStore((st) => st.customTemplates)
  const templateOverrides = useObjectCatalogStore((st) => st.templateOverrides)
  const addGroup = useObjectCatalogStore((st) => st.addGroup)
  const deleteGroup = useObjectCatalogStore((st) => st.deleteGroup)
  const addTemplate = useObjectCatalogStore((st) => st.addTemplate)
  const updateTemplate = useObjectCatalogStore((st) => st.updateTemplate)
  const deleteTemplate = useObjectCatalogStore((st) => st.deleteTemplate)

  const groups = getAllGroups(customGroups)
  const templates = getAllTemplates(customTemplates, templateOverrides)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'grp-agro': true,
    'grp-infra': true,
  })
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'none' | 'group' | 'item'>('none')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Форма группы
  const [grpName, setGrpName] = useState('')
  const [grpParentId, setGrpParentId] = useState<string>('')

  // Форма элемента (шаблона)
  const [itemName, setItemName] = useState('')
  const [itemGroupId, setItemGroupId] = useState<string>('grp-agro')
  const [itemType, setItemType] = useState<ObjectTypeCode>('other')
  const [itemDesc, setItemDesc] = useState('')
  const [itemProps, setItemProps] = useState<TemplatePropertyDef[]>([
    { key: 'prop_1', label: '', defaultValue: '' },
  ])

  const q = search.trim().toLowerCase()

  function toggleGroup(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))
  }

  function openNewGroup() {
    setEditingId(null)
    setGrpName('')
    setGrpParentId('')
    setMode('group')
  }

  function openNewItem(groupId?: string | null) {
    setEditingId(null)
    setItemName('')
    setItemGroupId(groupId ?? groups[0]?.id ?? '')
    setItemType('other')
    setItemDesc('')
    setItemProps([{ key: `prop_${Date.now()}`, label: '', defaultValue: '' }])
    setMode('item')
  }

  function openEditItem(tpl: ObjectTemplate) {
    setEditingId(tpl.id)
    setItemName(tpl.name)
    setItemGroupId(tpl.groupId ?? '')
    setItemType(tpl.object_type)
    setItemDesc(tpl.description)
    setItemProps(
      tpl.properties.length > 0
        ? tpl.properties.map((p) => ({ ...p }))
        : [{ key: `prop_${Date.now()}`, label: '', defaultValue: '' }],
    )
    setMode('item')
  }

  function saveGroup() {
    if (!grpName.trim()) return
    const created = addGroup(grpName.trim(), grpParentId || null)
    setExpanded((prev) => ({ ...prev, [created.id]: true }))
    setMode('none')
  }

  function saveItem() {
    if (!itemName.trim()) return
    const cleanProps = itemProps
      .filter((p) => p.label.trim() !== '')
      .map((p, idx) => ({
        key: p.key || `prop_${idx}`,
        label: p.label.trim(),
        defaultValue: p.defaultValue?.trim() ?? '',
      }))
    const payload = {
      name: itemName.trim(),
      groupId: itemGroupId || null,
      object_type: itemType,
      description: itemDesc.trim(),
      properties: cleanProps,
    }
    if (editingId) {
      updateTemplate(editingId, payload)
    } else {
      addTemplate(payload)
      if (payload.groupId) {
        setExpanded((prev) => ({ ...prev, [payload.groupId!]: true }))
      }
    }
    setMode('none')
    setEditingId(null)
  }

  function matchesSearch(tpl: ObjectTemplate): boolean {
    if (!q) return true
    return (
      tpl.name.toLowerCase().includes(q) ||
      tpl.description.toLowerCase().includes(q) ||
      tpl.properties.some(
        (p) =>
          p.label.toLowerCase().includes(q) || (p.defaultValue ?? '').toLowerCase().includes(q),
      )
    )
  }

  function renderTemplateRow(tpl: ObjectTemplate, depth: number) {
    return (
      <tr key={tpl.id}>
        <td style={{ paddingLeft: `${12 + depth * 22}px` }}>
          <span className={s.treeIcon} aria-hidden="true">
            📄
          </span>
          <strong>{tpl.name}</strong>
          <span className={tpl.scope === 'system' ? s.badgeSystem : s.badgeCustom}>
            {tpl.scope === 'system' ? 'Базовый' : 'Свой'}
          </span>
        </td>
        <td className={s.hint}>{tpl.description || objectTypeLabel(tpl.object_type)}</td>
        <td>
          <div className={s.propTags}>
            {tpl.properties.map((p) => (
              <span key={p.key} className={s.propTag}>
                {p.label}
                {p.defaultValue ? `: ${p.defaultValue}` : ''}
              </span>
            ))}
          </div>
        </td>
        <td className={s.actionCell}>
          <div className={s.fieldRow}>
            <button type="button" className={s.btnPrimary} onClick={() => onUseTemplate(tpl.id)}>
              В учёт →
            </button>
            <button type="button" className={s.btn} onClick={() => openEditItem(tpl)}>
              Изменить
            </button>
            {tpl.scope === 'custom' && (
              <button type="button" className={s.btn} onClick={() => deleteTemplate(tpl.id)}>
                Удалить
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  function renderGroupBranch(parentId: string | null, depth: number): ReactNode[] {
    const rows: ReactNode[] = []
    const childGroups = groups.filter((g) => g.parentId === parentId)

    for (const grp of childGroups) {
      const isOpen = q ? true : (expanded[grp.id] ?? true)
      const directItems = templates.filter((t) => t.groupId === grp.id && matchesSearch(t))
      const subRows = renderGroupBranch(grp.id, depth + 1)
      if (
        q &&
        directItems.length === 0 &&
        subRows.length === 0 &&
        !grp.name.toLowerCase().includes(q)
      ) {
        continue
      }

      rows.push(
        <tr key={grp.id} className={s.treeRowGroup}>
          <td colSpan={3} style={{ paddingLeft: `${10 + depth * 22}px` }}>
            <button
              type="button"
              className={s.treeToggle}
              onClick={() => toggleGroup(grp.id)}
              aria-expanded={isOpen}
            >
              {isOpen ? '▾' : '▸'} 📁 {grp.name}
            </button>
            <span className={s.policyHint}> ({directItems.length})</span>
          </td>
          <td className={s.actionCell}>
            <div className={s.fieldRow}>
              <button type="button" className={s.btn} onClick={() => openNewItem(grp.id)}>
                + Элемент
              </button>
              {grp.scope === 'custom' && (
                <button type="button" className={s.btn} onClick={() => deleteGroup(grp.id)}>
                  Удалить
                </button>
              )}
            </div>
          </td>
        </tr>,
      )

      if (isOpen) {
        rows.push(...subRows)
        for (const tpl of directItems) {
          rows.push(renderTemplateRow(tpl, depth + 1))
        }
      }
    }

    if (parentId === null) {
      const rootItems = templates.filter((t) => !t.groupId && matchesSearch(t))
      for (const tpl of rootItems) {
        rows.push(renderTemplateRow(tpl, 0))
      }
    }

    return rows
  }

  return (
    <div className={s.card}>
      <div className={s.toolbar}>
        <div className={s.fieldRow}>
          <button type="button" className={s.btnPrimary} onClick={() => openNewItem()}>
            + Элемент
          </button>
          <button type="button" className={s.btn} onClick={openNewGroup}>
            + Группа
          </button>
        </div>
        <input
          className={`${s.input} ${s.searchInput}`}
          placeholder="Поиск по справочнику..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {mode === 'group' && (
        <div className={s.formBox}>
          <strong>Новая группа (папка)</strong>
          <div className={s.formGrid}>
            <label className={s.field}>
              Наименование группы
              <input
                className={s.input}
                placeholder="Например: Склады и холодильники"
                value={grpName}
                onChange={(e) => setGrpName(e.target.value)}
              />
            </label>
            <label className={s.field}>
              Родительская группа
              <select
                className={s.select}
                value={grpParentId}
                onChange={(e) => setGrpParentId(e.target.value)}
              >
                <option value="">(В корне справочника)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={s.fieldRow}>
            <button
              type="button"
              className={s.btnPrimary}
              disabled={!grpName.trim()}
              onClick={saveGroup}
            >
              Создать группу
            </button>
            <button type="button" className={s.btn} onClick={() => setMode('none')}>
              {ru.settings.cancel}
            </button>
          </div>
        </div>
      )}

      {mode === 'item' && (
        <div className={s.formBox}>
          <strong>
            {editingId ? 'Редактирование элемента справочника' : 'Новый элемент справочника'}
          </strong>
          <div className={s.formGrid}>
            <label className={s.field}>
              Наименование
              <input
                className={s.input}
                placeholder="Например: Холодильная камера"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </label>
            <label className={s.field}>
              Группа (папка)
              <select
                className={s.select}
                value={itemGroupId}
                onChange={(e) => setItemGroupId(e.target.value)}
              >
                <option value="">(Без группы)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.field}>
              Базовый тип (для 3D/2D)
              <select
                className={s.select}
                value={itemType}
                onChange={(e) => setItemType(e.target.value as ObjectTypeCode)}
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
              placeholder="Текстовое описание типового объекта"
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
            />
          </label>

          <div className={s.field}>
            <span>Произвольные свойства (все значения — текст):</span>
            {itemProps.map((p, idx) => (
              <div key={p.key} className={s.fieldRow}>
                <input
                  className={s.input}
                  placeholder="Название свойства (напр. Мощность, кВт)"
                  value={p.label}
                  onChange={(e) =>
                    setItemProps((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)),
                    )
                  }
                />
                <input
                  className={s.input}
                  placeholder="Значение по умолчанию (текст)"
                  value={p.defaultValue ?? ''}
                  onChange={(e) =>
                    setItemProps((prev) =>
                      prev.map((it, i) =>
                        i === idx ? { ...it, defaultValue: e.target.value } : it,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className={s.btn}
                  onClick={() => setItemProps((prev) => prev.filter((_, i) => i !== idx))}
                >
                  ×
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className={s.btn}
                onClick={() =>
                  setItemProps((prev) => [
                    ...prev,
                    { key: `prop_${Date.now()}`, label: '', defaultValue: '' },
                  ])
                }
              >
                + Добавить свойство
              </button>
            </div>
          </div>

          <div className={s.fieldRow}>
            <button
              type="button"
              className={s.btnPrimary}
              disabled={!itemName.trim()}
              onClick={saveItem}
            >
              {ru.settings.save}
            </button>
            <button
              type="button"
              className={s.btn}
              onClick={() => {
                setMode('none')
                setEditingId(null)
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
            <th>Наименование</th>
            <th>Описание</th>
            <th>Свойства</th>
            <th aria-label="Действия" />
          </tr>
        </thead>
        <tbody>{renderGroupBranch(null, 0)}</tbody>
      </table>
    </div>
  )
}

/** 2.1. Учёт объектов → Реестр объектов хозяйства */
function ObjectsTab({
  preselectTemplateId,
  onClearPreselect,
}: {
  preselectTemplateId: string | null
  onClearPreselect: () => void
}) {
  const { data: apiObjects } = useObjects()
  const update = useUpdateObject()

  const customTemplates = useObjectCatalogStore((st) => st.customTemplates)
  const templateOverrides = useObjectCatalogStore((st) => st.templateOverrides)
  const customObjects = useObjectCatalogStore((st) => st.customObjects)
  const registryMeta = useObjectCatalogStore((st) => st.registryMeta)
  const addRegistryObject = useObjectCatalogStore((st) => st.addRegistryObject)
  const setObjectStatus = useObjectCatalogStore((st) => st.setObjectStatus)

  const allTemplates = getAllTemplates(customTemplates, templateOverrides)
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
    const mergedProps: Record<string, string> = {}
    for (const p of activeTemplate.properties) {
      mergedProps[p.key] = newProps[p.key] ?? p.defaultValue ?? ''
    }
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
        properties: mergedProps,
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
            Добавляйте объекты хозяйства из справочника шаблонов и управляйте их выводом в
            мониторинг.
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
                    {tpl.name}
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
                  <input
                    className={s.input}
                    placeholder={prop.defaultValue || 'Текстовое значение'}
                    value={newProps[prop.key] ?? prop.defaultValue ?? ''}
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
                <td className={s.actionCell}>
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
    </div>
  )
}

/** 2.3. Учёт объектов → Посты и координаты на сцене */
function PostsTab() {
  const { data: posts } = usePosts()
  return (
    <div className={s.card}>
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

/** 2.2. Учёт объектов → Привязка каналов (onboarding, 05 §10) */
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

/** 3.1. Работа объектов → Команды и политики (read-only) */
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

/** 3.2. Работа объектов → Тревоги и цепочки (read-only) */
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

/** 3.3. Работа объектов → Каналы оповещения (read-only) */
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

/** 3.4. Работа объектов → Симулятор и флаги клиента */
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
