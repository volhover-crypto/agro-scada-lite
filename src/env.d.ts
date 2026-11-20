/// <reference types="vite/client" />

// Переменные окружения (02_ARCHITECTURE_FE §6). Значения строковые:
// VITE_USE_MOCK сравнивается с 'true'.
interface ImportMetaEnv {
  readonly VITE_USE_MOCK: string
  readonly VITE_API_BASE: string
  readonly VITE_BASE_PATH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
