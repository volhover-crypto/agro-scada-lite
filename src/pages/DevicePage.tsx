import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { components } from '@/api/types.gen'
import { api } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { useActuators, useSetMode } from '@/api/endpoints/actuators'
import { useCommands } from '@/api/endpoints/commands'
import { ru } from '@/i18n/ru'
import { formatTimeRu } from '@/lib/time'
import { useUiStore } from '@/state/ui'
import { ConfirmHoldDialog } from './ConfirmHoldDialog'
import {
  DURATION_PRESETS_MIN,
  actionLabel,
  durationLabel,
  durationOverMax,
  factStateLabel,
  historyRow,
  isActiveStatus,
  isDone,
  maxDurationHint,
  needsDuration,
  remainingText,
  trailView,
} from './device-helpers'
import { useCommandActions } from './useCommandActions'
import s from './device.module.css'

/*
 * Страница устройства (05 §5): режим Авто/Ручной, факт с «подтверждено HH:MM»
 * и «до HH:MM (осталось)», длительность (пресеты + свой ввод, максимум —
 * неактивная кнопка), ВКЛЮЧИТЬ→ПРОДЛИТЬ / ВЫКЛЮЧИТЬ (без диалога) / ОТКРЫТЬ /
 * ЗАКРЫТЬ, диалог удержания 1,5 с, StatusTrail («Выполнено» только на
 * acked/completed), MODEM_OFFLINE, история 10 последних, пометка симулятора.
 * Мутационная логика — в useCommandActions, вид — в подкомпонентах (crapper).
 */

type ActuatorT = components['schemas']['Actuator']
type CommandDefT = components['schemas']['CommandDef']
type CommandT = components['schemas']['Command']
type PostT = components['schemas']['Post']

const OTHER = 'other'

function useAllPosts() {
  return useQuery({
    queryKey: ['posts', 'all'],
    queryFn: () => api.get<PostT[]>('/posts'),
  })
}

export function DevicePage() {
  const { actuatorId } = useParams()
  const id = Number(actuatorId)
  const valid = Number.isFinite(id)

  const commands = useCommands(valid ? id : null, 10)
  const history = (commands.data ?? []) as CommandT[]

  const { data: actuators, refetch: refetchActuators } = useActuators(
    undefined,
    // факт должен догонять ack: поллер /updates мержит в плоский ключ — поллим сами
    history.some((c) => isActiveStatus(c.status)) ? 3_000 : 15_000,
  )
  const { data: posts } = useAllPosts()
  const actuator = actuators?.find((a) => a.id === id)
  const post = posts?.find((p) => p.id === actuator?.post_id)
  const simMode = useUiStore((st) => st.simMode)
  const setMode = useSetMode()

  // подтверждено HH:MM — время ack последней выполненной команды (05 §5 «Факт»)
  const lastAckTime = useMemo(() => {
    for (const cmd of history) {
      if (!isDone(cmd.status)) continue
      const ack = (cmd.status_history ?? []).find((h) => h.status === 'acked')
      if (ack?.ts) return formatTimeRu(ack.ts)
    }
    return null
  }, [history])

  if (!actuator) {
    return (
      <main className={s.page}>
        <p>{actuators ? ru.device.notFound : ru.widgets.noData}</p>
      </main>
    )
  }

  return (
    <main className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>
            {actuator.name}
            {post ? ` · ${post.name} · ${post.plot_name}` : ''}
          </h1>
        </div>
        <Link className={s.back} to={post ? `/o/${post.object_id}` : '/'}>
          ← {ru.postPage.back}
        </Link>
      </div>

      <ModeCard
        actuator={actuator}
        simMode={simMode}
        lastAckTime={lastAckTime}
        onSetMode={(mode) => setMode.mutate({ id: actuator.id!, mode })}
      />
      <CommandCard
        actuator={actuator}
        simMode={simMode}
        current={history[0]}
        onRefetch={() => void refetchActuators()}
      />
      <HistoryCard history={history} defs={actuator.commands ?? []} simMode={simMode} />
    </main>
  )
}

/** Режим + факт (05 §5, верх страницы) */
function ModeCard({
  actuator,
  simMode,
  lastAckTime,
  onSetMode,
}: {
  actuator: ActuatorT
  simMode: boolean
  lastAckTime: string | null
  onSetMode: (mode: 'auto' | 'manual') => void
}) {
  return (
    <div className={s.card}>
      <div className={s.head}>
        <span className={s.blockTitle}>{ru.device.mode}</span>
        <div className={s.modeGroup} role="group" aria-label={ru.device.mode}>
          <button
            type="button"
            className={actuator.mode !== 'manual' ? s.modeBtnActive : s.modeBtn}
            disabled={actuator.mode !== 'manual'}
            onClick={() => onSetMode('auto')}
          >
            {ru.device.modeAuto}
          </button>
          <button
            type="button"
            className={actuator.mode === 'manual' ? s.modeBtnActive : s.modeBtn}
            disabled={actuator.mode === 'manual'}
            onClick={() => onSetMode('manual')}
          >
            {ru.device.modeManual}
          </button>
        </div>
      </div>
      <p className={s.factRow}>
        <span className={s.blockTitle}>{ru.device.fact}:</span>
        <span className={`${s.factState} ${factClass(actuator.fact_state)}`}>
          ● {factStateLabel(actuator.fact_state)}
        </span>
        {lastAckTime && (
          <span className={s.factAck}>{ru.device.ackedAt.replace('{time}', lastAckTime)}</span>
        )}
        {remainingText(actuator.fact_until, Date.now()) && (
          <span className={s.factAck}>{remainingText(actuator.fact_until, Date.now())}</span>
        )}
      </p>
      {actuator.mode === 'manual' && <p className={s.hint}>{ru.device.manualHint}</p>}
      {simMode && <p className={s.hint}>{ru.device.simNote}</p>}
    </div>
  )
}

function factClass(factState: string | null | undefined): string {
  // css-модуль под noUncheckedIndexedAccess даёт string | undefined
  if (factState === 'on' || factState === 'open') return s.factOn ?? ''
  if (factState === 'pending') return s.factPending ?? ''
  if (factState === 'fault') return s.factFault ?? ''
  return s.factOff ?? ''
}

/** Секунды из пресета/своего ввода; null — не задано */
function presetSeconds(preset: number | typeof OTHER, customMin: string): number | null {
  if (preset === OTHER) {
    const n = Number(customMin)
    return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null
  }
  return Math.round(preset * 60)
}

/** Длительность: пресеты + свой ввод, максимум (05 §5) */
function DurationRow({
  actuator,
  preset,
  onPreset,
  customMin,
  onCustomMin,
}: {
  actuator: ActuatorT
  preset: number | typeof OTHER
  onPreset: (v: number | typeof OTHER) => void
  customMin: string
  onCustomMin: (v: string) => void
}) {
  const overMax = durationOverMax(presetSeconds(preset, customMin), actuator.max_duration_s)
  return (
    <div className={s.durationRow}>
      <span>{ru.device.duration}:</span>
      <select
        className={s.select}
        aria-label={ru.device.duration}
        data-testid="duration-select"
        value={preset === OTHER ? OTHER : String(preset)}
        onChange={(e) => onPreset(e.target.value === OTHER ? OTHER : Number(e.target.value))}
      >
        {DURATION_PRESETS_MIN.map((m) => (
          <option key={m} value={m}>
            {durationLabel(m * 60)}
          </option>
        ))}
        <option value={OTHER}>{ru.device.presetOther}</option>
      </select>
      {preset === OTHER && (
        <input
          type="number"
          className={s.input}
          min={1}
          value={customMin}
          placeholder="мин"
          aria-label={ru.device.duration}
          onChange={(e) => onCustomMin(e.target.value)}
        />
      )}
      {overMax && <span className={s.outcomeFail}>{maxDurationHint(actuator.max_duration_s)}</span>}
    </div>
  )
}

/** Действия + цепочка статусов (05 §5, середина страницы) */
function CommandCard({
  actuator,
  simMode,
  current,
  onRefetch,
}: {
  actuator: ActuatorT
  simMode: boolean
  current: CommandT | undefined
  onRefetch: () => void
}) {
  const defs = actuator.commands ?? []
  const onDef = defs.find((d) => d.action === 'on' || d.action === 'open')
  const offDef = defs.find((d) => d.action === 'off' || d.action === 'close')
  const withDuration = onDef != null && needsDuration(onDef.action!)

  const [preset, setPreset] = useState<number | typeof OTHER>(
    (actuator.default_duration_s ?? 1800) / 60,
  )
  const [customMin, setCustomMin] = useState('')

  // длительность по умолчанию — от устройства, при смене устройства
  useEffect(() => {
    setPreset((actuator.default_duration_s ?? 1800) / 60)
    setCustomMin('')
  }, [actuator.id, actuator.default_duration_s])

  const actions = useCommandActions(onRefetch)
  const seconds = withDuration ? presetSeconds(preset, customMin) : null
  const overMax = durationOverMax(seconds, actuator.max_duration_s)

  return (
    <div className={s.card}>
      <h2 className={s.blockTitle}>{ru.device.trail}</h2>
      {current && (
        <StatusTrail
          command={current}
          onRetry={() => actions.issue(lastDef(defs, current), undefined, actuator.name ?? '')}
        />
      )}

      {actions.error && <p className={s.outcomeFail}>{actions.error}</p>}

      {withDuration && (
        <DurationRow
          actuator={actuator}
          preset={preset}
          onPreset={setPreset}
          customMin={customMin}
          onCustomMin={setCustomMin}
        />
      )}

      <ActionButtons
        onDef={onDef}
        offDef={offDef}
        factState={actuator.fact_state}
        deviceName={actuator.name ?? ''}
        durationS={withDuration ? (seconds ?? undefined) : undefined}
        busy={actions.busy}
        disabled={overMax || (withDuration && seconds == null)}
        simMode={simMode}
        onIssue={actions.issue}
      />

      <ConfirmHoldDialog
        open={actions.pendingUuid != null}
        title={actions.pendingTitle}
        onConfirm={actions.confirmPending}
        onCancel={actions.cancelPending}
      />
    </div>
  )
}

/** Кнопки действий (ВКЛЮЧИТЬ/ПРОДЛИТЬ, ВЫКЛЮЧИТЬ/ЗАКРЫТЬ) + пометка симулятора */
function ActionButtons({
  onDef,
  offDef,
  factState,
  deviceName,
  durationS,
  busy,
  disabled,
  simMode,
  onIssue,
}: {
  onDef: CommandDefT | undefined
  offDef: CommandDefT | undefined
  factState: string | null | undefined
  deviceName: string
  durationS: number | undefined
  busy: boolean
  disabled: boolean
  simMode: boolean
  onIssue: (def: CommandDefT, durationS: number | undefined, deviceName: string) => void
}) {
  return (
    <div className={s.actions}>
      {onDef && (
        <button
          type="button"
          className={s.primaryBtn}
          disabled={busy || disabled}
          data-testid="primary-action"
          onClick={() => onIssue(onDef, durationS, deviceName)}
        >
          {actionLabel(onDef.action!, factState)}
        </button>
      )}
      {offDef && (
        <button
          type="button"
          className={s.secondaryBtn}
          disabled={busy}
          data-testid="secondary-action"
          onClick={() => onIssue(offDef, undefined, deviceName)}
        >
          {actionLabel(offDef.action!, factState)}
        </button>
      )}
      {simMode && <span className={s.simNote}>{ru.device.simNote}</span>}
    </div>
  )
}

function lastDef(defs: CommandDefT[], cmd: CommandT): CommandDefT {
  const def = defs.find((d) => d.id === cmd.command_def_id)
  if (!def) throw new Error('def not found')
  return def
}

/** Цепочка статусов + исход; «Выполнено» — только acked/completed */
function StatusTrail({ command, onRetry }: { command: CommandT; onRetry: () => void }) {
  const view = trailView(command)
  return (
    <div data-testid="status-trail">
      <ul className={s.trail}>
        {view.steps.map((step, i) => (
          <li key={`${step.label}-${i}`} className={s.trailStep}>
            {i > 0 && <span className={s.trailArrow}>→</span>}
            <span
              className={[
                i === view.steps.length - 1 ? s.trailStepCurrent : '',
                step.done ? s.trailStepDone : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {step.done ? `✓ ${step.label}` : step.label}
            </span>
          </li>
        ))}
        {view.outcome && (
          <li className={s.trailStep}>
            {view.steps.length > 0 && <span className={s.trailArrow}>→</span>}
            <span className={view.outcome.kind === 'fail' ? s.outcomeFail : s.outcomeNeutral}>
              {view.outcome.text}
            </span>
            {view.isTimeout && (
              <button type="button" className={s.retryBtn} onClick={onRetry}>
                {ru.device.retry}
              </button>
            )}
          </li>
        )}
      </ul>
      {view.offlineWarning && (
        <p className={s.warnBanner} data-testid="modem-offline-warning">
          {ru.device.modemOfflineWarning.replace('{time}', formatTimeRu(command.expires_at ?? ''))}
        </p>
      )}
    </div>
  )
}

/** История команд (05 §5: 10 последних) */
function HistoryCard({
  history,
  defs,
  simMode,
}: {
  history: CommandT[]
  defs: CommandDefT[]
  simMode: boolean
}) {
  return (
    <div className={s.card}>
      <h2 className={s.blockTitle}>{ru.device.history}</h2>
      {simMode && <p className={s.hint}>{ru.device.simNote}</p>}
      {history.length === 0 ? (
        <p className={s.hint}>{ru.device.historyEmpty}</p>
      ) : (
        <ul className={s.historyList}>
          {history.map((cmd) => {
            const row = historyRow(cmd, defs)
            return (
              <li key={cmd.uuid} className={s.historyRow}>
                <span className={s.historyTime}>
                  {cmd.created_at ? formatTimeRu(cmd.created_at) : ''}
                </span>
                <span className={s.historyAction}>{row.action}</span>
                <span className={s.historyDuration}>{row.duration}</span>
                <span className={`${s.historyStatus} ${s[KIND_CLASS[row.kind] ?? '']}`}>
                  {row.label}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const KIND_CLASS: Record<string, string> = {
  done: 'statusDone',
  fail: 'statusFail',
  active: 'statusActive',
  neutral: 'statusNeutral',
}
