import { Link } from 'react-router'
import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'
import { ValueText } from '@/widgets/quality'
import s from './scene.module.css'

/*
 * Панель поста в 3D-сцене (07 §3.1): текущие значения поста,
 * исполнители с состоянием, ссылки на пост и устройства.
 * Кнопки управления — на странице устройства (T12).
 */

type TagValueT = components['schemas']['TagValue']
type ActuatorT = components['schemas']['Actuator']

export function ScenePostPanel({
  objectId,
  postId,
  name,
  plot,
  current,
  actuators,
}: {
  objectId: number
  postId: number
  name: string
  plot: string
  current: TagValueT[]
  actuators: ActuatorT[]
}) {
  const values = current.filter((t) => t.post_id === postId)
  const mine = actuators.filter((a) => a.post_id === postId)

  return (
    <div>
      <h2 className={s.panelTitle}>
        {name} <span className={s.panelPlot}>· {plot}</span>
      </h2>

      <h3 className={s.panelSection}>{ru.scene3d.panelParams}</h3>
      <ul className={s.panelValues}>
        {values.map((v) => (
          <li key={v.tag_id}>
            <ValueText value={v} precision={1} /> <span className={s.panelValueName}>{v.name}</span>
          </li>
        ))}
        {values.length === 0 && <li className={s.panelEmpty}>{ru.widgets.noData}</li>}
      </ul>

      <h3 className={s.panelSection}>{ru.scene3d.panelActuators}</h3>
      <ul className={s.panelValues}>
        {mine.map((a) => (
          <li key={a.id}>
            <Link to={`/a/${a.id}`}>{a.name}</Link>{' '}
            <span
              className={a.fact_state === 'on' || a.fact_state === 'open' ? s.panelOn : s.panelOff}
            >
              {a.fact_state === 'on' || a.fact_state === 'open'
                ? ru.scene3d.panelOn
                : a.fact_state === 'fault'
                  ? ru.scene3d.panelFault
                  : ru.scene3d.panelOff}
            </span>
          </li>
        ))}
        {mine.length === 0 && <li className={s.panelEmpty}>{ru.widgets.noData}</li>}
      </ul>

      <Link className={s.panelLink} to={`/o/${objectId}/p/${postId}`}>
        {ru.scene3d.postLink}
      </Link>
    </div>
  )
}
