import { useMemo, useState } from 'react'
import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'
import {
  RULE_OPS,
  ruleSummary,
  wizardStepValid,
  type RuleAction,
  type RuleCondition,
} from './rules-helpers'
import s from './rules.module.css'

/*
 * Мастер правила, 4 шага (05 §8): 1) условие — тег/оператор/значение;
 * 2) действие — команда/длительность; 3) гистерезис, пауза, «при отсутствии
 * данных»; 4) сводка человеческим языком + [Утвердить и включить] /
 * [Сохранить черновик]. Правка утверждённого — предупреждение (после
 * сохранения сервер сбрасывает approval_status в pending).
 */

type RuleT = components['schemas']['Rule']
type CommandDefT = components['schemas']['CommandDef']

export interface RuleDraft {
  name: string
  condition: RuleCondition
  action: RuleAction
  hysteresis: number
  minPauseS: number
  onNoData: 'skip' | 'fallback_schedule'
  fallbackScheduleId: number | null
}

export interface TagOption {
  tagId: string
  label: string
}

const EMPTY_DRAFT: RuleDraft = {
  name: '',
  condition: { tag_id: '', op: '<', value: 0 },
  action: { command_def_id: 0, duration_s: 1800 },
  hysteresis: 1,
  minPauseS: 3600,
  onNoData: 'skip',
  fallbackScheduleId: null,
}

export function draftFromRule(rule: RuleT): RuleDraft {
  const c = (rule.condition ?? {}) as Partial<RuleCondition>
  const a = (rule.action ?? {}) as Partial<RuleAction>
  return {
    name: rule.name ?? '',
    condition: {
      tag_id: c.tag_id ?? '',
      op: c.op ?? '<',
      value: c.value ?? 0,
    },
    action: {
      command_def_id: a.command_def_id ?? 0,
      duration_s: a.duration_s ?? 1800,
    },
    hysteresis: rule.hysteresis ?? 1,
    minPauseS: rule.min_pause_s ?? 3600,
    onNoData: rule.on_no_data === 'fallback_schedule' ? 'fallback_schedule' : 'skip',
    fallbackScheduleId: rule.fallback_schedule_id ?? null,
  }
}

export interface RuleWizardProps {
  /** Правило на правку (undefined — создание) */
  initial?: RuleT
  defs: CommandDefT[]
  /** имена исполнителей: id → имя (для подписи команд в шаге 2) */
  actuatorNames: Record<number, string>
  tags: TagOption[]
  schedules: Array<{ id: number; label: string }>
  saving: boolean
  onSave: (draft: RuleDraft, approveAndEnable: boolean) => void
  onCancel: () => void
}

const STEP_TITLES = [ru.rules.step1, ru.rules.step2, ru.rules.step3, ru.rules.step4]

export function RuleWizard({
  initial,
  defs,
  actuatorNames,
  tags,
  schedules,
  saving,
  onSave,
  onCancel,
}: RuleWizardProps) {
  const editing = initial != null
  // правка утверждённого → предупреждение (05 §8)
  const wasApproved = editing && initial.approval_status === 'approved'
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<RuleDraft>(() =>
    initial ? draftFromRule(initial) : EMPTY_DRAFT,
  )

  const summary = useMemo(
    () =>
      ruleSummary(
        draft.condition,
        draft.action,
        {
          hysteresis: draft.hysteresis,
          minPauseS: draft.minPauseS,
          onNoData: draft.onNoData,
          tagName: tags.find((t) => t.tagId === draft.condition.tag_id)?.label ?? '',
        },
        defs,
      ),
    [draft, tags, defs],
  )

  function patch(part: Partial<RuleDraft>): void {
    setDraft((d) => ({ ...d, ...part }))
  }

  function next(): void {
    if (wizardStepValid(step, draft.condition, draft.action)) setStep((v) => Math.min(v + 1, 3))
  }

  return (
    <div className={s.wizard} data-testid="rule-wizard">
      <div className={s.wizardHead}>
        <h2 className={s.stepTitle}>
          {editing ? ru.rules.edit : ru.rules.create} · {STEP_TITLES[step]}
        </h2>
        <span className={s.stepBadge}>{ru.rules.step.replace('{n}', String(step + 1))}</span>
      </div>

      {wasApproved && (
        <p className={s.warnBanner} data-testid="edit-warning">
          {ru.rules.editWarning}
        </p>
      )}

      {step === 0 && <StepCondition draft={draft} tags={tags} onPatch={patch} />}
      {step === 1 && (
        <StepAction draft={draft} defs={defs} actuatorNames={actuatorNames} onPatch={patch} />
      )}
      {step === 2 && <StepLimits draft={draft} schedules={schedules} onPatch={patch} />}
      {step === 3 && (
        <StepSummary
          summary={summary}
          name={draft.name}
          nameRequired={!editing && draft.name.trim() === ''}
          onName={(name) => patch({ name })}
        />
      )}

      <div className={s.wizardNav}>
        {step > 0 && (
          <button type="button" className={s.btn} onClick={() => setStep((v) => v - 1)}>
            {ru.rules.back}
          </button>
        )}
        {step < 3 && (
          <button
            type="button"
            className={s.btnPrimary}
            disabled={!wizardStepValid(step, draft.condition, draft.action)}
            onClick={next}
          >
            {ru.rules.next}
          </button>
        )}
        {step === 3 && !editing && (
          <>
            <button
              type="button"
              className={s.btnPrimary}
              disabled={saving || draft.name.trim() === ''}
              onClick={() => onSave(draft, true)}
            >
              {ru.rules.approveAndEnable}
            </button>
            <button
              type="button"
              className={s.btn}
              disabled={saving || draft.name.trim() === ''}
              onClick={() => onSave(draft, false)}
            >
              {ru.rules.saveDraft}
            </button>
          </>
        )}
        {step === 3 && editing && (
          <button
            type="button"
            className={s.btnPrimary}
            disabled={saving || draft.name.trim() === ''}
            onClick={() => onSave(draft, false)}
          >
            {ru.rules.save}
          </button>
        )}
        <button type="button" className={s.btn} onClick={onCancel}>
          {ru.rules.cancel}
        </button>
      </div>
    </div>
  )
}

/** Шаг 1: тег, оператор, значение */
function StepCondition({
  draft,
  tags,
  onPatch,
}: {
  draft: RuleDraft
  tags: TagOption[]
  onPatch: (p: Partial<RuleDraft>) => void
}) {
  return (
    <div className={s.fieldRow}>
      <label className={s.field}>
        {ru.rules.conditionTag}
        <select
          className={s.select}
          aria-label={ru.rules.conditionTag}
          value={draft.condition.tag_id}
          onChange={(e) => onPatch({ condition: { ...draft.condition, tag_id: e.target.value } })}
        >
          <option value="">—</option>
          {tags.map((t) => (
            <option key={t.tagId} value={t.tagId}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className={s.field}>
        {ru.rules.conditionOp}
        <select
          className={s.select}
          aria-label={ru.rules.conditionOp}
          value={draft.condition.op}
          onChange={(e) => onPatch({ condition: { ...draft.condition, op: e.target.value } })}
        >
          {RULE_OPS.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={s.field}>
        {ru.rules.conditionValue}
        <input
          type="number"
          className={s.input}
          aria-label={ru.rules.conditionValue}
          value={draft.condition.value}
          onChange={(e) =>
            onPatch({ condition: { ...draft.condition, value: Number(e.target.value) } })
          }
        />
      </label>
    </div>
  )
}

/** Шаг 2: команда и длительность */
function StepAction({
  draft,
  defs,
  actuatorNames,
  onPatch,
}: {
  draft: RuleDraft
  defs: CommandDefT[]
  actuatorNames: Record<number, string>
  onPatch: (p: Partial<RuleDraft>) => void
}) {
  return (
    <div className={s.fieldRow}>
      <label className={s.field}>
        {ru.rules.actionCommand}
        <select
          className={s.select}
          aria-label={ru.rules.actionCommand}
          value={draft.action.command_def_id}
          onChange={(e) =>
            onPatch({ action: { ...draft.action, command_def_id: Number(e.target.value) } })
          }
        >
          <option value={0}>—</option>
          {defs.map((d) => (
            <option key={d.id} value={d.id}>
              {defLabel(d, actuatorNames)}
            </option>
          ))}
        </select>
      </label>
      <label className={s.field}>
        {ru.rules.actionDuration}
        <input
          type="number"
          className={s.input}
          min={0}
          step={60}
          aria-label={ru.rules.actionDuration}
          value={draft.action.duration_s ?? 0}
          onChange={(e) =>
            onPatch({ action: { ...draft.action, duration_s: Number(e.target.value) } })
          }
        />
      </label>
    </div>
  )
}

/** Шаг 3: гистерезис, пауза, поведение при отсутствии данных */
function StepLimits({
  draft,
  schedules,
  onPatch,
}: {
  draft: RuleDraft
  schedules: Array<{ id: number; label: string }>
  onPatch: (p: Partial<RuleDraft>) => void
}) {
  return (
    <div className={s.fieldRow}>
      <label className={s.field}>
        {ru.rules.hysteresis}
        <input
          type="number"
          className={s.input}
          min={0}
          step={0.5}
          aria-label={ru.rules.hysteresis}
          value={draft.hysteresis}
          onChange={(e) => onPatch({ hysteresis: Number(e.target.value) })}
        />
      </label>
      <label className={s.field}>
        {ru.rules.minPause}
        <input
          type="number"
          className={s.input}
          min={0}
          step={60}
          aria-label={ru.rules.minPause}
          value={draft.minPauseS}
          onChange={(e) => onPatch({ minPauseS: Number(e.target.value) })}
        />
      </label>
      <label className={s.field}>
        {ru.rules.onNoData}
        <select
          className={s.select}
          aria-label={ru.rules.onNoData}
          value={draft.onNoData}
          onChange={(e) =>
            onPatch({
              onNoData: e.target.value as RuleDraft['onNoData'],
              fallbackScheduleId: null,
            })
          }
        >
          <option value="skip">{ru.rules.noDataSkip}</option>
          <option value="fallback_schedule">{ru.rules.noDataFallback}</option>
        </select>
      </label>
      {draft.onNoData === 'fallback_schedule' && (
        <label className={s.field}>
          {ru.rules.fallbackSchedule}
          <select
            className={s.select}
            aria-label={ru.rules.fallbackSchedule}
            value={draft.fallbackScheduleId ?? ''}
            onChange={(e) =>
              onPatch({
                fallbackScheduleId: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          >
            <option value="">—</option>
            {schedules.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

/** Шаг 4: название + сводка человеческим языком */
function StepSummary({
  summary,
  name,
  nameRequired,
  onName,
}: {
  summary: string
  name: string
  nameRequired: boolean
  onName: (name: string) => void
}) {
  return (
    <>
      <label className={s.field}>
        {ru.rules.name}
        <input
          className={s.input}
          placeholder={ru.rules.namePlaceholder}
          value={name}
          aria-label={ru.rules.name}
          onChange={(e) => onName(e.target.value)}
        />
      </label>
      <div className={s.summary} data-testid="rule-summary">
        {summary}
      </div>
      {nameRequired && <p className={s.warnBanner}>{ru.rules.nameRequired}</p>}
    </>
  )
}

/** Подпись команды в шаге 2: «Клапан 1 · ВКЛЮЧИТЬ» */
export function defLabel(d: CommandDefT, actuatorNames: Record<number, string>): string {
  const action =
    d.action === 'on'
      ? ru.device.turnOn
      : d.action === 'off'
        ? ru.device.turnOff
        : d.action === 'open'
          ? ru.device.open
          : ru.device.close
  const name = actuatorNames[d.actuator_id ?? 0] ?? `${ru.rules.defPrefix} ${d.actuator_id ?? '—'}`
  return `${name} · ${action}`
}
