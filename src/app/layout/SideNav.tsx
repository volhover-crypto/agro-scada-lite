import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { useAlarms } from '@/api/endpoints/alarms'
import { ru } from '@/i18n/ru'
import s from './shell.module.css'

type IconProps = { children: ReactNode }

function NavIcon({ children }: IconProps) {
  return (
    <svg
      className={s.navIcon}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const ICONS = {
  overview: (
    <NavIcon>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </NavIcon>
  ),
  objects: (
    <NavIcon>
      <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </NavIcon>
  ),
  charts: (
    <NavIcon>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 6-7" />
    </NavIcon>
  ),
  rules: (
    <NavIcon>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="10" cy="18" r="2" fill="currentColor" />
    </NavIcon>
  ),
  schedules: (
    <NavIcon>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M12 14v3l2 1" />
    </NavIcon>
  ),
  alarms: (
    <NavIcon>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </NavIcon>
  ),
  audit: (
    <NavIcon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </NavIcon>
  ),
  settings: (
    <NavIcon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </NavIcon>
  ),
}

/** Левое меню, десктоп ≥1024 (05 §0): три визуальных блока с иконками */
export function SideNav() {
  const { data: alarms } = useAlarms()
  const active = (alarms ?? []).filter(
    (a) => a.state === 'active_unacked' || a.state === 'active_acked',
  ).length

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `${s.navLink} ${isActive ? s.navLinkActive : ''}`

  return (
    <nav className={s.sidenav} aria-label="Основное меню">
      <div className={s.navGroup}>
        <NavLink to="/" end className={linkClass}>
          {ICONS.overview}
          <span>{ru.shell.navOverview}</span>
        </NavLink>
        <NavLink to="/o" className={linkClass}>
          {ICONS.objects}
          <span>{ru.shell.navObjects}</span>
        </NavLink>
        <NavLink to="/charts" className={linkClass}>
          {ICONS.charts}
          <span>{ru.shell.navCharts}</span>
        </NavLink>
      </div>

      <div className={s.navGroup}>
        <NavLink to="/rules" className={linkClass}>
          {ICONS.rules}
          <span>{ru.shell.navRules}</span>
        </NavLink>
        <NavLink to="/schedules" className={linkClass}>
          {ICONS.schedules}
          <span>{ru.shell.navSchedules}</span>
        </NavLink>
        <NavLink to="/alarms" className={linkClass}>
          {ICONS.alarms}
          <span>{ru.shell.navAlarms}</span>
          {active > 0 && <span className={s.navBadge}>{active}</span>}
        </NavLink>
      </div>

      <div className={s.navGroup}>
        <NavLink to="/audit" className={linkClass}>
          {ICONS.audit}
          <span>{ru.shell.navAudit}</span>
        </NavLink>
        <NavLink to="/settings/objects" className={linkClass}>
          {ICONS.settings}
          <span>{ru.shell.navSettings}</span>
        </NavLink>
      </div>
    </nav>
  )
}
