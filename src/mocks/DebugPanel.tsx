import { useState } from 'react'
import { mockRu as ru } from './mock-ru'
import { applyScenario, SCENARIOS } from './scenarios'
import { store } from './store'
import s from './debug.module.css'

/*
 * Плавающая панель отладки мока (04_MOCK_SPEC §5). Монтируется только в dev
 * (VITE_USE_MOCK=true) прямо в DOM, вне дерева приложения.
 */

const SCENARIO_TITLES: Record<string, string> = {
  normal: 'Обычная работа',
  quality: 'Качество данных',
  pressure_drop: 'Падение давления (P1)',
  link_loss: 'Потеря связи (БС-1)',
  cmd_fail: 'Команды падают (timeout)',
  manual_mode: 'Ручной режим',
  onboarding: 'Новый модем',
  empty: 'Пусто (первичная настройка)',
}

export function DebugPanel() {
  const [open, setOpen] = useState(false)
  const [scenario, setScenario] = useState(store.scenario)
  const [speed, setSpeed] = useState(store.speed)
  const [loseAck, setLoseAck] = useState(store.fail.loseAck)
  const [rejectResult, setRejectResult] = useState(store.fail.rejectResult)
  const [modeFail, setModeFail] = useState(store.fail.modeFail)

  return (
    <div className={s.root}>
      {open && (
        <div className={s.panel} role="dialog" aria-label={ru.panelTitle}>
          <h2 className={s.title}>{ru.panelTitle}</h2>

          <label className={s.field}>
            {ru.scenario}
            <select
              value={scenario}
              onChange={(e) => {
                setScenario(e.target.value)
                applyScenario(e.target.value as (typeof SCENARIOS)[number])
              }}
            >
              {SCENARIOS.map((name) => (
                <option key={name} value={name}>
                  {SCENARIO_TITLES[name]}
                </option>
              ))}
            </select>
          </label>

          <label className={s.field}>
            {ru.speed}
            <select
              value={speed}
              onChange={(e) => {
                const v = Number(e.target.value) as 1 | 60
                setSpeed(v)
                store.speed = v
              }}
            >
              <option value={60}>×60</option>
              <option value={1}>×1</option>
            </select>
          </label>

          <label className={s.check}>
            <input
              type="checkbox"
              checked={loseAck}
              onChange={(e) => {
                setLoseAck(e.target.checked)
                store.fail.loseAck = e.target.checked
              }}
            />
            {ru.loseAck}
          </label>

          <label className={s.check}>
            <input
              type="checkbox"
              checked={rejectResult}
              onChange={(e) => {
                setRejectResult(e.target.checked)
                store.fail.rejectResult = e.target.checked
              }}
            />
            {ru.rejectResult}
          </label>

          <label className={s.check}>
            <input
              type="checkbox"
              checked={modeFail}
              onChange={(e) => {
                setModeFail(e.target.checked)
                store.fail.modeFail = e.target.checked
              }}
            />
            {ru.modeFail}
          </label>

          <button
            type="button"
            className={s.reset}
            onClick={() => {
              applyScenario(scenario as (typeof SCENARIOS)[number])
            }}
          >
            {ru.reset}
          </button>
        </div>
      )}
      <button type="button" className={s.fab} onClick={() => setOpen(!open)} aria-expanded={open}>
        ⚙ {ru.fab}
      </button>
    </div>
  )
}
