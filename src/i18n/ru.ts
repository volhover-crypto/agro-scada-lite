// Все тексты интерфейса — на русском (01_README_AGENT §4.7).
// Словарь пополняется по задачам; ключи — по смыслу, не по экранам.
export const ru = {
  appTitle: 'Agro-SCADA Lite',
  t01ScaffoldNote: 'Каркас приложения (задача T01). Экраны появятся в следующих задачах.',
} as const

export type Dict = typeof ru
