import { create } from 'zustand'

// Состояние UI (02 §1): выбранный объект, режим симулятора, связь с сервером
interface UiState {
  selectedObjectId: number | null
  /** client_flags.sim_mode из /updates (BR-FE-6): только чтение */
  simMode: boolean
  /** Время последнего успешного опроса, если связи нет (баннер 02 §3) */
  offlineSince: string | null
  setSelectedObject: (id: number | null) => void
  setSimMode: (v: boolean) => void
  setOfflineSince: (iso: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  selectedObjectId: null,
  simMode: false,
  offlineSince: null,
  setSelectedObject: (id) => set({ selectedObjectId: id }),
  setSimMode: (v) => set({ simMode: v }),
  setOfflineSince: (iso) => set({ offlineSince: iso }),
}))
