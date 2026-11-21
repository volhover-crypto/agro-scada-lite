import { NavLink } from 'react-router'
import { useAlarms } from '@/api/endpoints/alarms'
import { ru } from '@/i18n/ru'
import s from './shell.module.css'

/** Левое меню, десктоп ≥1024 (05 §0) */
export function SideNav() {
  const { data: alarms } = useAlarms()
  const active = (alarms ?? []).filter(
    (a) => a.state === 'active_unacked' || a.state === 'active_acked',
  ).length

  return (
    <nav className={s.sidenav} aria-label="Основное меню">
      <NavLink
        to="/"
        end
        className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}
      >
        {ru.shell.navOverview}
      </NavLink>
      <NavLink
        to="/o"
        className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}
      >
        {ru.shell.navObjects}
      </NavLink>
      <NavLink
        to="/alarms"
        className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}
      >
        {ru.shell.navAlarms}
        {active > 0 && <span className={s.navBadge}>{active}</span>}
      </NavLink>
      <NavLink
        to="/charts"
        className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}
      >
        {ru.shell.navCharts}
      </NavLink>
      <NavLink
        to="/rules"
        className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}
      >
        {ru.shell.navRules}
      </NavLink>
      <NavLink
        to="/schedules"
        className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}
      >
        {ru.shell.navSchedules}
      </NavLink>
      <NavLink
        to="/audit"
        className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}
      >
        {ru.shell.navAudit}
      </NavLink>
      <NavLink
        to="/settings/objects"
        className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}
      >
        {ru.shell.navSettings}
      </NavLink>
    </nav>
  )
}
