import { Link, useLocation, useNavigate } from 'react-router'
import { logout } from '@/api/endpoints/auth'
import { useAlarms } from '@/api/endpoints/alarms'
import { useModems } from '@/api/endpoints/modems'
import { useObjects } from '@/api/endpoints/objects'
import { queryClient } from '@/api/queryClient'
import { ru } from '@/i18n/ru'
import { getSessionUser } from '@/state/session'
import { useUiStore } from '@/state/ui'
import s from './shell.module.css'

/** Шапка (05 §0): выбор объекта, статус связи (агрегат по модемам до BR-FE-1),
 *  счётчик тревог, метка «ТЕСТ» (BR-FE-6), пользователь и выход */
export function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: objects } = useObjects()
  const { data: modems } = useModems()
  const { data: alarms } = useAlarms()
  const selectedObjectId = useUiStore((st) => st.selectedObjectId)
  const setSelectedObject = useUiStore((st) => st.setSelectedObject)
  const simMode = useUiStore((st) => st.simMode)

  const active = (alarms ?? []).filter(
    (a) => a.state === 'active_unacked' || a.state === 'active_acked',
  ).length

  const online = modems?.filter((m) => m.link_status === 'online').length ?? 0
  const total = modems?.length ?? 0
  const linkText =
    total === 0
      ? ru.shell.linkStatusNone
      : online === total
        ? ru.shell.linkStatusOk
        : ru.shell.linkStatusPartial
            .replace('{online}', String(online))
            .replace('{total}', String(total))

  function onLogout() {
    void logout().then(() => {
      // 02 §4: logout — очистка кэша и на экран входа
      queryClient.clear()
      useUiStore.getState().setSimMode(false)
      navigate('/login', { replace: true })
    })
  }

  return (
    <header className={s.topbar}>
      <select
        className={s.objectSelect}
        aria-label={ru.shell.navObjects}
        value={selectedObjectId ?? ''}
        onChange={(e) => {
          const id = Number(e.target.value)
          setSelectedObject(id)
          // если смотрим страницу объекта — переключаемся на выбранный
          if (location.pathname.startsWith('/o/')) navigate(`/o/${id}`)
        }}
      >
        <option value="" disabled>
          {ru.shell.objectSelectPlaceholder}
        </option>
        {(objects ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <span
        className={`${s.linkStatus} ${total > 0 && online < total ? s.linkBad : s.linkOk}`}
        title={ru.shell.bsStatusHint}
      >
        {total > 0 && online === total ? '● ' : total === 0 ? '' : '✕ '}
        {linkText}
      </span>

      <span className={s.topSpacer} />

      {simMode && (
        <span className={s.simBadge} title={ru.shell.simBadgeHint}>
          {ru.shell.simBadge}
        </span>
      )}

      {active > 0 && (
        <Link className={s.alarmChip} to="/alarms">
          {ru.shell.navAlarms}: {active}
        </Link>
      )}

      <span className={s.userBox}>
        {getSessionUser()}
        <button type="button" className={s.logoutBtn} onClick={onLogout}>
          {ru.shell.logout}
        </button>
      </span>
    </header>
  )
}
