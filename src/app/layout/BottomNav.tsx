import { NavLink } from 'react-router'
import { useAlarms } from '@/api/endpoints/alarms'
import { ru } from '@/i18n/ru'
import { useUiStore } from '@/state/ui'
import s from './shell.module.css'

/** Нижняя панель телефона <1024 (05 §0): Обзор · Тревоги · Управление · Ещё.
 *  Управление — страница выбранного объекта (там исполнители, T09). */
export function BottomNav() {
  const { data: alarms } = useAlarms()
  const active = (alarms ?? []).filter(
    (a) => a.state === 'active_unacked' || a.state === 'active_acked',
  ).length
  const selectedObjectId = useUiStore((st) => st.selectedObjectId)

  const cls = ({ isActive }: { isActive: boolean }) =>
    `${s.bottomLink} ${isActive ? s.bottomLinkActive : ''}`

  return (
    <nav className={s.bottomnav} aria-label="Нижняя панель">
      <NavLink to="/" end className={cls}>
        {ru.shell.navOverview}
      </NavLink>
      <NavLink to="/alarms" className={cls}>
        {active > 0 && <span className={s.bottomBadge}>{active}</span>}
        {ru.shell.navAlarms}
      </NavLink>
      <NavLink to={selectedObjectId != null ? `/o/${selectedObjectId}` : '/o'} className={cls}>
        {ru.shell.navControl}
      </NavLink>
      <NavLink to="/more" className={cls}>
        {ru.shell.navMore}
      </NavLink>
    </nav>
  )
}
