// Справочник параметров param_dict v1 (08_BACKEND_HANDOFF §1.2)
export interface ParamDef {
  code: number
  name: string
  unit: string
  kind: 'analog' | 'counter' | 'discrete'
}

export const PARAM_DICT: ParamDef[] = [
  { code: 0x01, name: 'Температура воздуха', unit: '°C', kind: 'analog' },
  { code: 0x02, name: 'Влажность воздуха', unit: '%', kind: 'analog' },
  { code: 0x03, name: 'Влажность грунта', unit: '%', kind: 'analog' },
  { code: 0x04, name: 'Температура грунта', unit: '°C', kind: 'analog' },
  { code: 0x05, name: 'EC', unit: 'мСм/см', kind: 'analog' },
  { code: 0x06, name: 'Давление системы', unit: 'бар', kind: 'analog' },
  { code: 0x07, name: 'Давление воздуха', unit: 'гПа', kind: 'analog' },
  { code: 0x08, name: 'Влажность листа', unit: '%', kind: 'analog' },
  { code: 0x09, name: 'Осадки', unit: 'мм', kind: 'counter' },
  { code: 0x0a, name: 'Ветер', unit: 'м/с', kind: 'analog' },
  { code: 0x0b, name: 'Радиация', unit: 'Вт/м²', kind: 'analog' },
  { code: 0x0c, name: 'Расход', unit: 'м³/ч', kind: 'counter' },
  { code: 0x0d, name: 'Объём', unit: 'м³', kind: 'counter' },
  { code: 0x0e, name: 'Уровень', unit: 'см', kind: 'analog' },
  { code: 0x0f, name: 'Дискретный вход', unit: '', kind: 'discrete' },
]

export function paramByCode(code: number): ParamDef | undefined {
  return PARAM_DICT.find((p) => p.code === code)
}
