import { useMemo, useState } from 'react'
import type { components } from '@/api/types.gen'
import { useActuators } from '@/api/endpoints/actuators'
import {
  useApproveSchedule,
  useCreateSchedule,
  useSchedules,
  type CreateScheduleResult,
} from '@/api/endpoints/schedules'
import { ru } from '@/i18n/ru'
import { defLabel } from './RuleWizard'
import { daysLabel, durationShort, isApprovedRule, ruleStatusLabel } from './rules-helpers'
import s from './rules.module.css'

/*
 * Расписания (05 §8): список — время, дни, команда, длительность, статус,
 * [Утвердить]. Создание — форма; при пересечении на одном выходе сервер
 * возвращает warnings: [OVERLAP] — жёлтое предупреждение после сохранения.
 * Изменение/удаление контрактом не предусмотрены.
 */

type ScheduleT = components['schemas']['Schedule']
type CommandDefT = components['schemas']['CommandDef']

const DAY_CHIPS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function SchedulesPage() {
  const { data: schedules } = useSchedules()
  const { data: actuators } = useActuators()
  const approve = useApproveSchedule()
  const create = useCreateSchedule()

  const [form, setForm] = useState<{
    time: string
    days: number[]
    defId: number
    durationS: number
    enableNow: boolean
  } | null>(null)
  const [overlap, setOverlap] = useState(false)

  const defs = useMemo(() => (actuators ?? []).flatMap((a) => a.commands ?? []), [actuators])
  const actuatorNames = useMemo(
    () => Object.fromEntries((actuators ?? []).map((a) => [a.id ?? 0, a.name ?? ''])),
    [actuators],
  )

  function save(): void {
    if (!form) return
    create.mutate(
      {
        command_def_id: form.defId,
        time: form.time,
        days: form.days,
        duration_s: form.durationS,
        enabled: form.enableNow,
      },
      {
        onSuccess: (created: CreateScheduleResult) => {
          setOverlap((created.warnings ?? []).includes('OVERLAP'))
          setForm(null)
        },
      },
    )
  }

  return (
    <main className={s.page}>
      <div className={s.headRow}>
        <h1 className={s.title}>{ru.schedules.title}</h1>
        {form == null && (
          <button
            type="button"
            className={s.btnPrimary}
            onClick={() =>
              setForm({
                time: '06:00',
                days: [1, 2, 3, 4, 5, 6, 7],
                defId: defs[0]?.id ?? 0,
                durationS: 1800,
                enableNow: true,
              })
            }
          >
            {ru.schedules.create}
          </button>
        )}
      </div>

      {overlap && (
        <p className={s.overlap} data-testid="overlap-warning">
          {ru.schedules.overlapWarning}
        </p>
      )}

      {form != null && (
        <ScheduleForm
          form={form}
          defs={defs}
          actuatorNames={actuatorNames}
          saving={create.isPending}
          onChange={setForm}
          onSave={save}
          onCancel={() => setForm(null)}
        />
      )}
      {form == null && (
        <ScheduleList
          schedules={(schedules ?? []) as ScheduleT[]}
          defs={defs}
          actuatorNames={actuatorNames}
          approvePending={approve.isPending}
          onApprove={(id) => approve.mutate(id)}
        />
      )}
    </main>
  )
}

/** Список расписаний: время, дни, команда, длительность, статус */
function ScheduleList({
  schedules,
  defs,
  actuatorNames,
  approvePending,
  onApprove,
}: {
  schedules: ScheduleT[]
  defs: CommandDefT[]
  actuatorNames: Record<number, string>
  approvePending: boolean
  onApprove: (id: number) => void
}) {
  if (schedules.length === 0) return <p className={s.empty}>{ru.schedules.empty}</p>
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>{ru.schedules.colTime}</th>
          <th>{ru.schedules.colDays}</th>
          <th>{ru.schedules.colCommand}</th>
          <th>{ru.schedules.colDuration}</th>
          <th>{ru.schedules.colStatus}</th>
          <th aria-label="Действия" />
        </tr>
      </thead>
      <tbody>
        {schedules.map((sc) => {
          const def = defs.find((d) => d.id === sc.command_def_id)
          const status = ruleStatusLabel(sc.approval_status, sc.enabled)
          const chipClass = isApprovedRule(sc)
            ? sc.enabled
              ? s.chipApproved
              : s.chipDisabled
            : s.chipPending
          return (
            <tr key={sc.id} data-testid="schedule-row">
              <td className={s.time}>{sc.time}</td>
              <td>{scheduleDays(sc)}</td>
              <td>{def ? defLabel(def, actuatorNames) : '—'}</td>
              <td>{durationShort(sc.duration_s)}</td>
              <td>
                <span className={`${s.chip} ${chipClass}`}>{status}</span>
              </td>
              <td>
                {!isApprovedRule(sc) && (
                  <button
                    type="button"
                    className={s.btnPrimary}
                    disabled={approvePending}
                    onClick={() => sc.id != null && onApprove(sc.id)}
                  >
                    {ru.schedules.approve}
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function scheduleDays(sc: ScheduleT): string {
  return daysLabel(sc.days)
}

export interface ScheduleFormState {
  time: string
  days: number[]
  defId: number
  durationS: number
  enableNow: boolean
}

/** Форма создания расписания: время, дни-чипы, команда, длительность */
function ScheduleForm({
  form,
  defs,
  actuatorNames,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  form: ScheduleFormState
  defs: CommandDefT[]
  actuatorNames: Record<number, string>
  saving: boolean
  onChange: (f: ScheduleFormState) => void
  onSave: () => void
  onCancel: () => void
}) {
  const valid = form.time !== '' && form.days.length > 0 && form.defId !== 0 && form.durationS > 0
  return (
    <div className={s.wizard} data-testid="schedule-form">
      <div className={s.fieldRow}>
        <label className={s.field}>
          {ru.schedules.time}
          <input
            type="time"
            className={s.input}
            aria-label={ru.schedules.time}
            value={form.time}
            onChange={(e) => onChange({ ...form, time: e.target.value })}
          />
        </label>
        <label className={s.field}>
          {ru.schedules.command}
          <select
            className={s.select}
            aria-label={ru.schedules.command}
            value={form.defId}
            onChange={(e) => onChange({ ...form, defId: Number(e.target.value) })}
          >
            {defs.map((d) => (
              <option key={d.id} value={d.id}>
                {defLabel(d, actuatorNames)}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field}>
          {ru.schedules.duration}
          <input
            type="number"
            className={s.input}
            min={60}
            step={60}
            aria-label={ru.schedules.duration}
            value={form.durationS}
            onChange={(e) => onChange({ ...form, durationS: Number(e.target.value) })}
          />
        </label>
      </div>
      <div>
        <span className={s.stepTitle}>{ru.schedules.days}</span>
        <div className={s.daysRow}>
          {DAY_CHIPS.map((name, i) => {
            const day = i + 1
            const on = form.days.includes(day)
            return (
              <button
                key={day}
                type="button"
                className={on ? `${s.dayChip} ${s.dayChipOn}` : s.dayChip}
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    ...form,
                    days: on ? form.days.filter((d) => d !== day) : [...form.days, day],
                  })
                }
              >
                {name}
              </button>
            )
          })}
        </div>
      </div>
      <label className={s.checkRow}>
        <input
          type="checkbox"
          checked={form.enableNow}
          onChange={(e) => onChange({ ...form, enableNow: e.target.checked })}
        />
        {ru.schedules.enableNow}
      </label>
      <div className={s.wizardNav}>
        <button type="button" className={s.btnPrimary} disabled={saving || !valid} onClick={onSave}>
          {ru.schedules.save}
        </button>
        <button type="button" className={s.btn} onClick={onCancel}>
          {ru.schedules.cancel}
        </button>
      </div>
    </div>
  )
}
