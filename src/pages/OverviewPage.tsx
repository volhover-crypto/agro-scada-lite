import { Link } from 'react-router'
import type { components } from '@/api/types.gen'
import { useObjects } from '@/api/endpoints/objects'
import { ru } from '@/i18n/ru'
import { objectTypeLabel, objectStats } from './overview-helpers'
import s from './overview.module.css'

/*
 * Обзор (05 §2): карточки объектов — тип (иконка), постов онлайн N/M,
 * активные тревоги по приоритетам, работающие устройства.
 */

type PostT = components['schemas']['Post']
type ModemT = components['schemas']['Modem']
type AlarmT = components['schemas']['Alarm']
type ActuatorT = components['schemas']['Actuator']

const TYPE_ICON: Record<string, string> = {
  vineyard: '🍇',
  orchard: '🍎',
  greenhouse: '🌱',
  pump_station: '⚙',
  field: '🌾',
  other: '📍',
}

export function OverviewPage({
  posts,
  modems,
  alarms,
  actuators,
}: {
  posts: PostT[]
  modems: ModemT[]
  alarms: AlarmT[]
  actuators: ActuatorT[]
}) {
  const { data: objects } = useObjects()

  if (objects?.length === 0) {
    return (
      <main className={s.page}>
        <h1>{ru.shell.navOverview}</h1>
        <p className={s.empty}>{ru.overview.empty}</p>
        <button
          type="button"
          className={s.addBtn}
          disabled
          title="Появится в T16 (Настройки → Объекты)"
        >
          {ru.overview.addObject}
        </button>
      </main>
    )
  }

  return (
    <main className={s.page}>
      <h1>{ru.shell.navOverview}</h1>
      <div className={s.grid}>
        {(objects ?? []).map((o) => {
          const st = objectStats(o, posts, modems, alarms, actuators)
          const alarmsTotal = st.alarms.p1 + st.alarms.p2 + st.alarms.p3 + st.alarms.p4
          return (
            <Link
              key={o.id}
              to={`/o/${o.id}`}
              className={s.card}
              data-testid={`object-card-${o.id}`}
            >
              <h2 className={s.cardTitle}>
                <span className={s.icon} aria-hidden>
                  {TYPE_ICON[o.object_type ?? 'other']}
                </span>
                {o.name}
              </h2>
              <p className={s.type}>{objectTypeLabel(o.object_type)}</p>
              <ul className={s.stats}>
                <li className={st.postsOnline === st.postsTotal ? s.ok : s.warn}>
                  {ru.overview.postsOnline
                    .replace('{online}', String(st.postsOnline))
                    .replace('{total}', String(st.postsTotal))}
                </li>
                <li className={alarmsTotal > 0 ? s.alarm : s.ok}>
                  {alarmsTotal > 0
                    ? ['p1', 'p2', 'p3', 'p4']
                        .filter((k) => st.alarms[k as keyof typeof st.alarms] > 0)
                        .map((k) =>
                          ru.overview.alarmsP
                            .replace('{p}', k.slice(1))
                            .replace('{n}', String(st.alarms[k as keyof typeof st.alarms])),
                        )
                        .join(' · ')
                    : ru.overview.alarms.replace('{n}', '0')}
                </li>
                <li>{ru.overview.running.replace('{n}', String(st.runningActuators))}</li>
              </ul>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
