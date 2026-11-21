import { Link } from 'react-router'
import { ru } from '@/i18n/ru'
import { useUiStore } from '@/state/ui'
import s from '@/app/layout/shell.module.css'

/** «Ещё» нижней панели телефона (05 §0): остальные разделы списком */
export function MorePage() {
  const selectedObjectId = useUiStore((st) => st.selectedObjectId)
  const links: Array<[string, string]> = [
    ['/o', ru.shell.navObjects],
    ['/charts', ru.shell.navCharts],
    ['/rules', ru.shell.navRules],
    ['/schedules', ru.shell.navSchedules],
    ['/audit', ru.shell.navAudit],
    ['/settings/objects', ru.shell.navSettings],
  ]
  if (selectedObjectId != null) links.unshift([`/o/${selectedObjectId}`, ru.shell.navControl])

  return (
    <main>
      <h1>{ru.shell.navMore}</h1>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {links.map(([to, label]) => (
          <Link key={to} to={to} className={s.navLink}>
            {label}
          </Link>
        ))}
      </nav>
    </main>
  )
}
