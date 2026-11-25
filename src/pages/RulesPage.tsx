import { useMemo, useState } from 'react'
import type { components } from '@/api/types.gen'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useActuators } from '@/api/endpoints/actuators'
import { useApproveRule, useCreateRule, useRules, useUpdateRule } from '@/api/endpoints/rules'
import { useSchedules } from '@/api/endpoints/schedules'
import { useTagValues } from '@/api/endpoints/tags'
import { ru } from '@/i18n/ru'
import { formatDateTimeRu } from '@/lib/time'
import { RuleWizard, type RuleDraft, type TagOption } from './RuleWizard'
import { buildCatalog } from './overview-helpers'
import { isApprovedRule, ruleStatusLabel, scheduleSummary } from './rules-helpers'
import s from './rules.module.css'

/*
 * Правила (05 §8): список — имя, устройство, статус (Утверждено / Ждёт
 * утверждения / Выключено), последний запуск, [Утвердить], [Изменить].
 * Мастер 4 шага; правка утверждённого — предупреждение (после сохранения
 * approval_status сбрасывается в pending — делает сервер).
 */

type RuleT = components['schemas']['Rule']
type ChannelT = components['schemas']['Channel']
type TagValueT = components['schemas']['TagValue']
type CommandDefT = components['schemas']['CommandDef']

function useQueryChannels() {
  return useQuery({
    queryKey: ['channels', 'assigned'],
    queryFn: () => api.get<ChannelT[]>('/channels?status=assigned'),
  })
}

export function RulesPage() {
  const { data: rules } = useRules()
  const { data: actuators } = useActuators()
  const { data: schedules } = useSchedules()
  const { data: channels } = useQueryChannels()
  const { data: current } = useTagValues(
    (channels ?? []).map((c) => c.tag_id ?? '').filter(Boolean),
    60_000,
  )
  const approve = useApproveRule()
  const create = useCreateRule()
  const update = useUpdateRule()

  const [wizard, setWizard] = useState<{ rule?: RuleT } | null>(null)

  const defs = useMemo(() => (actuators ?? []).flatMap((a) => a.commands ?? []), [actuators])
  const actuatorNames = useMemo(
    () => Object.fromEntries((actuators ?? []).map((a) => [a.id ?? 0, a.name ?? ''])),
    [actuators],
  )
  const tags = useMemo<TagOption[]>(
    () => buildCatalog(channels ?? [], (current ?? []) as TagValueT[]),
    [channels, current],
  )
  const scheduleOptions = useMemo(
    () =>
      (schedules ?? []).map((sc) => ({
        id: sc.id ?? 0,
        label: scheduleSummary(sc, defs),
      })),
    [schedules, defs],
  )

  function handleSave(draft: RuleDraft, approveAndEnable: boolean): void {
    // condition/action в схеме — произвольные object: каст к типам контракта
    const body = {
      name: draft.name,
      condition: draft.condition,
      action: draft.action,
      hysteresis: draft.hysteresis,
      min_pause_s: draft.minPauseS,
      on_no_data: draft.onNoData,
      fallback_schedule_id: draft.fallbackScheduleId,
      enabled: wizard?.rule ? wizard.rule.enabled : approveAndEnable,
    } as unknown as Partial<RuleT>
    if (wizard?.rule?.id != null) {
      update.mutate({ id: wizard.rule.id, body }, { onSuccess: () => setWizard(null) })
    } else {
      create.mutate(body, {
        onSuccess: (created) => {
          if (approveAndEnable && created.id != null) {
            approve.mutate(created.id, { onSettled: () => setWizard(null) })
          } else {
            setWizard(null)
          }
        },
      })
    }
  }

  const saving = create.isPending || update.isPending || approve.isPending

  return (
    <main className={s.page}>
      <div className={s.headRow}>
        <h1 className={s.title}>{ru.rules.title}</h1>
        {wizard == null && (
          <button type="button" className={s.btnPrimary} onClick={() => setWizard({})}>
            {ru.rules.create}
          </button>
        )}
      </div>

      {wizard != null && (
        <RuleWizard
          initial={wizard.rule}
          defs={defs}
          actuatorNames={actuatorNames}
          tags={tags}
          schedules={scheduleOptions}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setWizard(null)}
        />
      )}

      {wizard == null && (
        <RuleList
          rules={(rules ?? []) as RuleT[]}
          defs={defs}
          actuatorNames={actuatorNames}
          approvePending={approve.isPending}
          onApprove={(id) => approve.mutate(id)}
          onEdit={(rule) => setWizard({ rule })}
        />
      )}
    </main>
  )
}

/** Список правил: имя, устройство, статус, последний запуск, действия */
function RuleList({
  rules,
  defs,
  actuatorNames,
  approvePending,
  onApprove,
  onEdit,
}: {
  rules: RuleT[]
  defs: CommandDefT[]
  actuatorNames: Record<number, string>
  approvePending: boolean
  onApprove: (id: number) => void
  onEdit: (rule: RuleT) => void
}) {
  if (rules.length === 0) return <p className={s.empty}>{ru.rules.empty}</p>
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>{ru.rules.colName}</th>
          <th>{ru.rules.colDevice}</th>
          <th>{ru.rules.colStatus}</th>
          <th>{ru.rules.colLastFired}</th>
          <th aria-label="Действия" />
        </tr>
      </thead>
      <tbody>
        {rules.map((rule) => {
          const def = defs.find((d) => d.id === rule.action?.command_def_id)
          const status = ruleStatusLabel(rule.approval_status, rule.enabled)
          const chipClass = isApprovedRule(rule)
            ? rule.enabled
              ? s.chipApproved
              : s.chipDisabled
            : s.chipPending
          return (
            <tr key={rule.id} data-testid="rule-row">
              <td>{rule.name}</td>
              <td>{def ? (actuatorNames[def.actuator_id ?? 0] ?? '—') : '—'}</td>
              <td>
                <span className={`${s.chip} ${chipClass}`}>{status}</span>
              </td>
              <td className={s.time}>
                {rule.last_fired_at
                  ? formatDateTimeRu(rule.last_fired_at)
                  : ru.rules.lastFiredNever}
              </td>
              <td className={s.actionsRow}>
                {!isApprovedRule(rule) && (
                  <button
                    type="button"
                    className={s.btnPrimary}
                    disabled={approvePending}
                    onClick={() => rule.id != null && onApprove(rule.id)}
                  >
                    {ru.rules.approve}
                  </button>
                )}
                <button type="button" className={s.btn} onClick={() => onEdit(rule)}>
                  {ru.rules.edit}
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
