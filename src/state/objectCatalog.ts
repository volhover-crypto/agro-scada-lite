import { create } from 'zustand'
import type { components } from '@/api/types.gen'

export type ObjectTypeCode =
  | 'vineyard'
  | 'pump_station'
  | 'greenhouse'
  | 'orchard'
  | 'meteo'
  | 'other'

export type RegistryStatus = 'draft' | 'active' | 'archived'

export interface TemplatePropertyDef {
  key: string
  label: string
  unit?: string
}

export interface ObjectTemplate {
  id: string
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

export const SYSTEM_TEMPLATES: ObjectTemplate[] = [
  {
    id: 'tpl-vineyard',
    name: 'Виноградник',
    object_type: 'vineyard',
    description: 'Участок виноградника с контролем микроклимата, влажности почвы по горизонтам и полива.',
    scope: 'system',
    properties: [
      { key: 'area_ha', label: 'Площадь', unit: 'га' },
      { key: 'variety', label: 'Сорт' },
      { key: 'irrigation', label: 'Тип полива' },
    ],
  },
  {
    id: 'tpl-pump',
    name: 'Насосная станция',
    object_type: 'pump_station',
    description: 'Узел подачи воды с контролем давления, расхода и управлением насосами/клапанами.',
    scope: 'system',
    properties: [
      { key: 'power_kw', label: 'Мощность', unit: 'кВт' },
      { key: 'nom_pressure', label: 'Номинальное давление', unit: 'бар' },
      { key: 'pumps_count', label: 'Кол-во насосов', unit: 'шт.' },
    ],
  },
  {
    id: 'tpl-greenhouse',
    name: 'Теплица',
    object_type: 'greenhouse',
    description: 'Закрытый грунт: температура, влажность, проветривание (форточки/вентиляторы), полив.',
    scope: 'system',
    properties: [
      { key: 'area_m2', label: 'Площадь', unit: 'м²' },
      { key: 'crop', label: 'Культура' },
      { key: 'heating', label: 'Контур отопления' },
    ],
  },
  {
    id: 'tpl-orchard',
    name: 'Сад',
    object_type: 'orchard',
    description: 'Плодовый сад с мониторингом заморозков, влажности почвы и осадков.',
    scope: 'system',
    properties: [
      { key: 'area_ha', label: 'Площадь', unit: 'га' },
      { key: 'crop', label: 'Культура / сорт' },
      { key: 'irrigation', label: 'Тип полива' },
    ],
  },
  {
    id: 'tpl-meteo',
    name: 'Метеостанция',
    object_type: 'meteo',
    description: 'Пост метеонаблюдения: температура, влажность, осадки, ветер, солнечная радиация.',
    scope: 'system',
    properties: [
      { key: 'mast_m', label: 'Высота мачты', unit: 'м' },
      { key: 'sensors', label: 'Состав датчиков' },
    ],
  },
]

const STORAGE_KEY = 'agro-scada-object-catalog-v1'

interface PersistedData {
  customTemplates: ObjectTemplate[]
  customObjects: CustomObjectRecord[]
  registryMeta: Record<number, RegistryObjectMeta>
}

function loadPersisted(): PersistedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { customTemplates: [], customObjects: [], registryMeta: {} }
    const parsed = JSON.parse(raw) as Partial<PersistedData>
    return {
      customTemplates: Array.isArray(parsed.customTemplates) ? parsed.customTemplates : [],
      customObjects: Array.isArray(parsed.customObjects) ? parsed.customObjects : [],
      registryMeta: parsed.registryMeta && typeof parsed.registryMeta === 'object' ? parsed.registryMeta : {},
    }
  } catch {
    return { customTemplates: [], customObjects: [], registryMeta: {} }
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
  addTemplate: (tpl: Omit<ObjectTemplate, 'id' | 'scope'>) => ObjectTemplate
  deleteTemplate: (id: string) => void
  addRegistryObject: (
    obj: Omit<CustomObjectRecord, 'id' | 'farm_id' | 'tz'>,
    meta: RegistryObjectMeta,
  ) => CustomObjectRecord
  setObjectStatus: (id: number, status: RegistryStatus) => void
  updateObjectMeta: (id: number, patch: Partial<RegistryObjectMeta>) => void
}

const initial = loadPersisted()

export const useObjectCatalogStore = create<ObjectCatalogState>((set, get) => ({
  ...initial,

  addTemplate: (tpl) => {
    const created: ObjectTemplate = {
      ...tpl,
      id: `tpl-custom-${Date.now()}`,
      scope: 'custom',
    }
    const next = [...get().customTemplates, created]
    set({ customTemplates: next })
    savePersisted({
      customTemplates: next,
      customObjects: get().customObjects,
      registryMeta: get().registryMeta,
    })
    return created
  },

  deleteTemplate: (id) => {
    const next = get().customTemplates.filter((t) => t.id !== id)
    set({ customTemplates: next })
    savePersisted({
      customTemplates: next,
      customObjects: get().customObjects,
      registryMeta: get().registryMeta,
    })
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
    savePersisted({
      customTemplates: get().customTemplates,
      customObjects: nextObjects,
      registryMeta: nextMeta,
    })
    return created
  },

  setObjectStatus: (id, status) => {
    const prev = get().registryMeta[id] ?? { properties: {}, status: 'active' }
    const nextMeta = { ...get().registryMeta, [id]: { ...prev, status } }
    set({ registryMeta: nextMeta })
    savePersisted({
      customTemplates: get().customTemplates,
      customObjects: get().customObjects,
      registryMeta: nextMeta,
    })
  },

  updateObjectMeta: (id, patch) => {
    const prev = get().registryMeta[id] ?? { properties: {}, status: 'active' }
    const nextMeta = { ...get().registryMeta, [id]: { ...prev, ...patch } }
    set({ registryMeta: nextMeta })
    savePersisted({
      customTemplates: get().customTemplates,
      customObjects: get().customObjects,
      registryMeta: nextMeta,
    })
  },
}))

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
