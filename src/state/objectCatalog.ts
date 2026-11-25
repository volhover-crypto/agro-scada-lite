import { create } from 'zustand'
import type { components } from '@/api/types.gen'

export type ObjectTypeCode =
  | 'vineyard'
  | 'orchard'
  | 'greenhouse'
  | 'pump_station'
  | 'field'
  | 'meteo'
  | 'other'

export type RegistryStatus = 'draft' | 'active' | 'archived'

/** Произвольное текстовое свойство шаблона (в стиле 1С — всё хранится текстом) */
export interface TemplatePropertyDef {
  key: string
  label: string
  defaultValue?: string
}

/** Папка (группа) в иерархическом справочнике шаблонов */
export interface TemplateGroup {
  id: string
  parentId: string | null
  name: string
  scope: 'system' | 'custom'
}

export interface ObjectTemplate {
  id: string
  groupId: string | null
  name: string
  object_type: ObjectTypeCode
  description: string
  scope: 'system' | 'custom'
  properties: TemplatePropertyDef[]
}

export interface RegistryObjectMeta {
  templateId?: string
  description?: string
  properties: Record<string, string>
  status: RegistryStatus
}

export type ObjectT = components['schemas']['Object']

export interface CustomObjectRecord {
  id: number
  farm_id: number
  name: string
  object_type: ObjectTypeCode
  lat: number
  lon: number
  tz: string
}

export const SYSTEM_GROUPS: TemplateGroup[] = [
  { id: 'grp-agro', parentId: null, name: 'Агроучастки', scope: 'system' },
  { id: 'grp-infra', parentId: null, name: 'Инженерные узлы', scope: 'system' },
]

export const SYSTEM_TEMPLATES: ObjectTemplate[] = [
  {
    id: 'tpl-vineyard',
    groupId: 'grp-agro',
    name: 'Виноградник',
    object_type: 'vineyard',
    description: 'Участок виноградника с контролем микроклимата, влажности почвы и полива.',
    scope: 'system',
    properties: [
      { key: 'area_ha', label: 'Площадь (га)', defaultValue: '' },
      { key: 'variety', label: 'Сорт', defaultValue: '' },
      { key: 'irrigation', label: 'Тип полива', defaultValue: 'Капельный' },
    ],
  },
  {
    id: 'tpl-greenhouse',
    groupId: 'grp-agro',
    name: 'Теплица',
    object_type: 'greenhouse',
    description: 'Закрытый грунт: температура, влажность, проветривание и полив.',
    scope: 'system',
    properties: [
      { key: 'area_m2', label: 'Площадь (м²)', defaultValue: '' },
      { key: 'crop', label: 'Культура', defaultValue: '' },
      { key: 'heating', label: 'Контур отопления', defaultValue: '' },
    ],
  },
  {
    id: 'tpl-orchard',
    groupId: 'grp-agro',
    name: 'Сад',
    object_type: 'orchard',
    description: 'Плодовый сад с мониторингом заморозков, влажности почвы и осадков.',
    scope: 'system',
    properties: [
      { key: 'area_ha', label: 'Площадь (га)', defaultValue: '' },
      { key: 'crop', label: 'Культура / сорт', defaultValue: '' },
      { key: 'irrigation', label: 'Тип полива', defaultValue: '' },
    ],
  },
  {
    id: 'tpl-field',
    groupId: 'grp-agro',
    name: 'Поле',
    object_type: 'field',
    description: 'Открытый грунт: контроль влажности почвы, осадков и режимов полива.',
    scope: 'system',
    properties: [
      { key: 'area_ha', label: 'Площадь (га)', defaultValue: '' },
      { key: 'crop', label: 'Культура', defaultValue: '' },
      { key: 'irrigation', label: 'Тип полива', defaultValue: '' },
    ],
  },
  {
    id: 'tpl-pump',
    groupId: 'grp-infra',
    name: 'Насосная станция',
    object_type: 'pump_station',
    description: 'Узел подачи воды: давление, расход и управление насосами/клапанами.',
    scope: 'system',
    properties: [
      { key: 'power_kw', label: 'Мощность (кВт)', defaultValue: '' },
      { key: 'nom_pressure', label: 'Номинальное давление (бар)', defaultValue: '' },
      { key: 'pumps_count', label: 'Кол-во насосов', defaultValue: '' },
    ],
  },
  {
    id: 'tpl-meteo',
    groupId: 'grp-infra',
    name: 'Метеостанция',
    object_type: 'meteo',
    description: 'Пост метеонаблюдения: температура, влажность, осадки, ветер, радиация.',
    scope: 'system',
    properties: [
      { key: 'mast_m', label: 'Высота мачты (м)', defaultValue: '' },
      { key: 'sensors', label: 'Состав датчиков', defaultValue: '' },
    ],
  },
]

const STORAGE_KEY = 'agro-scada-object-catalog-v2'

interface PersistedData {
  customGroups: TemplateGroup[]
  customTemplates: ObjectTemplate[]
  templateOverrides: Record<string, Partial<ObjectTemplate>>
  customObjects: CustomObjectRecord[]
  registryMeta: Record<number, RegistryObjectMeta>
}

function loadPersisted(): PersistedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        customGroups: [],
        customTemplates: [],
        templateOverrides: {},
        customObjects: [],
        registryMeta: {},
      }
    }
    const parsed = JSON.parse(raw) as Partial<PersistedData>
    return {
      customGroups: Array.isArray(parsed.customGroups) ? parsed.customGroups : [],
      customTemplates: Array.isArray(parsed.customTemplates) ? parsed.customTemplates : [],
      templateOverrides:
        parsed.templateOverrides && typeof parsed.templateOverrides === 'object'
          ? parsed.templateOverrides
          : {},
      customObjects: Array.isArray(parsed.customObjects) ? parsed.customObjects : [],
      registryMeta:
        parsed.registryMeta && typeof parsed.registryMeta === 'object' ? parsed.registryMeta : {},
    }
  } catch {
    return {
      customGroups: [],
      customTemplates: [],
      templateOverrides: {},
      customObjects: [],
      registryMeta: {},
    }
  }
}

function savePersisted(data: PersistedData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // игнорируем переполнение/приватный режим
  }
}

interface ObjectCatalogState extends PersistedData {
  addGroup: (name: string, parentId: string | null) => TemplateGroup
  renameGroup: (id: string, name: string) => void
  deleteGroup: (id: string) => void
  addTemplate: (tpl: Omit<ObjectTemplate, 'id' | 'scope'>) => ObjectTemplate
  updateTemplate: (id: string, patch: Partial<Omit<ObjectTemplate, 'id' | 'scope'>>) => void
  deleteTemplate: (id: string) => void
  addRegistryObject: (
    obj: Omit<CustomObjectRecord, 'id' | 'farm_id' | 'tz'>,
    meta: RegistryObjectMeta,
  ) => CustomObjectRecord
  setObjectStatus: (id: number, status: RegistryStatus) => void
  updateObjectMeta: (id: number, patch: Partial<RegistryObjectMeta>) => void
}

const initial = loadPersisted()

function snapshot(s: ObjectCatalogState): PersistedData {
  return {
    customGroups: s.customGroups,
    customTemplates: s.customTemplates,
    templateOverrides: s.templateOverrides,
    customObjects: s.customObjects,
    registryMeta: s.registryMeta,
  }
}

export const useObjectCatalogStore = create<ObjectCatalogState>((set, get) => ({
  ...initial,

  addGroup: (name, parentId) => {
    const created: TemplateGroup = {
      id: `grp-custom-${Date.now()}`,
      parentId,
      name: name.trim(),
      scope: 'custom',
    }
    const next = [...get().customGroups, created]
    set({ customGroups: next })
    savePersisted({ ...snapshot(get()), customGroups: next })
    return created
  },

  renameGroup: (id, name) => {
    const next = get().customGroups.map((g) => (g.id === id ? { ...g, name: name.trim() } : g))
    set({ customGroups: next })
    savePersisted({ ...snapshot(get()), customGroups: next })
  },

  deleteGroup: (id) => {
    const nextGroups = get().customGroups.filter((g) => g.id !== id && g.parentId !== id)
    const nextTemplates = get().customTemplates.map((t) =>
      t.groupId === id ? { ...t, groupId: null } : t,
    )
    set({ customGroups: nextGroups, customTemplates: nextTemplates })
    savePersisted({ ...snapshot(get()), customGroups: nextGroups, customTemplates: nextTemplates })
  },

  addTemplate: (tpl) => {
    const created: ObjectTemplate = {
      ...tpl,
      id: `tpl-custom-${Date.now()}`,
      scope: 'custom',
    }
    const next = [...get().customTemplates, created]
    set({ customTemplates: next })
    savePersisted({ ...snapshot(get()), customTemplates: next })
    return created
  },

  updateTemplate: (id, patch) => {
    const isCustom = get().customTemplates.some((t) => t.id === id)
    if (isCustom) {
      const next = get().customTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t))
      set({ customTemplates: next })
      savePersisted({ ...snapshot(get()), customTemplates: next })
    } else {
      const prev = get().templateOverrides[id] ?? {}
      const nextOverrides = { ...get().templateOverrides, [id]: { ...prev, ...patch } }
      set({ templateOverrides: nextOverrides })
      savePersisted({ ...snapshot(get()), templateOverrides: nextOverrides })
    }
  },

  deleteTemplate: (id) => {
    const next = get().customTemplates.filter((t) => t.id !== id)
    set({ customTemplates: next })
    savePersisted({ ...snapshot(get()), customTemplates: next })
  },

  addRegistryObject: (obj, meta) => {
    const existingIds = get().customObjects.map((o) => o.id)
    const nextId = Math.max(100, ...existingIds) + 1
    const created: CustomObjectRecord = {
      ...obj,
      id: nextId,
      farm_id: 1,
      tz: 'Europe/Moscow',
    }
    const nextObjects = [...get().customObjects, created]
    const nextMeta = { ...get().registryMeta, [nextId]: meta }
    set({ customObjects: nextObjects, registryMeta: nextMeta })
    savePersisted({ ...snapshot(get()), customObjects: nextObjects, registryMeta: nextMeta })
    return created
  },

  setObjectStatus: (id, status) => {
    const prev = get().registryMeta[id] ?? { properties: {}, status: 'active' }
    const nextMeta = { ...get().registryMeta, [id]: { ...prev, status } }
    set({ registryMeta: nextMeta })
    savePersisted({ ...snapshot(get()), registryMeta: nextMeta })
  },

  updateObjectMeta: (id, patch) => {
    const prev = get().registryMeta[id] ?? { properties: {}, status: 'active' }
    const nextMeta = { ...get().registryMeta, [id]: { ...prev, ...patch } }
    set({ registryMeta: nextMeta })
    savePersisted({ ...snapshot(get()), registryMeta: nextMeta })
  },
}))

/** Возвращает все группы (системные + пользовательские) */
export function getAllGroups(customGroups: TemplateGroup[]): TemplateGroup[] {
  return [...SYSTEM_GROUPS, ...customGroups]
}

/** Возвращает все шаблоны с учётом пользовательских правок */
export function getAllTemplates(
  customTemplates: ObjectTemplate[],
  overrides: Record<string, Partial<ObjectTemplate>>,
): ObjectTemplate[] {
  const sys = SYSTEM_TEMPLATES.map((t) => ({ ...t, ...(overrides[t.id] ?? {}) }))
  return [...sys, ...customTemplates]
}

/** Объединяет объекты из API и созданные в реестре хозяйства */
export function mergeRegistryObjects(
  apiObjects: ObjectT[],
  customObjects: CustomObjectRecord[],
): ObjectT[] {
  return [...apiObjects, ...(customObjects as ObjectT[])]
}

/** Возвращает только активные («В системе») объекты для шапки и оперативного мониторинга */
export function filterActiveObjects(
  allObjects: ObjectT[],
  registryMeta: Record<number, RegistryObjectMeta>,
): ObjectT[] {
  return allObjects.filter((o) => {
    const status = o.id != null ? (registryMeta[o.id]?.status ?? 'active') : 'active'
    return status === 'active'
  })
}
