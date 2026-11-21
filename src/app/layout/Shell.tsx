import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useObjects } from '@/api/endpoints/objects'
import { ru } from '@/i18n/ru'
import { getSessionToken } from '@/state/session'
import { startUpdatesPolling } from '@/state/updates'
import { useUiStore } from '@/state/ui'
import { formatTimeRu } from '@/lib/time'
import { AlarmBanner } from './AlarmBanner'
import { BottomNav } from './BottomNav'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'
import s from './shell.module.css'

/*
 * Каркас приложения (05 §0): слева меню (десктоп) / снизу панель (телефон),
 * сверху шапка с выбором объекта, статусом связи, счётчиком тревог и выходом;
 * под шапкой — жёлтая полоса «нет связи» и красный баннер P1.
 * Здесь же стартует глобальный поллер /updates (02 §3).
 */
export function Shell() {
  const location = useLocation()
  const hasToken = getSessionToken() != null
  // enabled=false без токена: ни один запрос не должен уходить, иначе
  // серия 401 перезаписывает state.from и после входа уводит не туда
  const { data: objects } = useObjects(hasToken)
  const selectedObjectId = useUiStore((st) => st.selectedObjectId)
  const setSelectedObject = useUiStore((st) => st.setSelectedObject)
  const offlineSince = useUiStore((st) => st.offlineSince)
  const pollStop = useRef<(() => void) | null>(null)

  // Поллер живёт, пока смонтирован каркас
  useEffect(() => {
    if (!hasToken) return
    pollStop.current = startUpdatesPolling()
    return () => {
      pollStop.current?.()
      pollStop.current = null
    }
  }, [hasToken])

  // Гейт ПОСЛЕ хуков: без токена рендерим только редирект (детей нет —
  // их запросы тоже молчат)
  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Первый объект — по умолчанию (выбор в шапке хранится в ui-сторе)
  useEffect(() => {
    if (selectedObjectId == null && objects?.length) {
      setSelectedObject(objects[0]!.id ?? null)
    }
  }, [objects, selectedObjectId, setSelectedObject])

  return (
    <div className={s.app}>
      <SideNav />
      <div className={s.main}>
        <TopBar />
        {offlineSince && (
          <div className={s.offlineBanner} role="status">
            {ru.shell.offlineBanner.replace('{time}', formatTimeRu(offlineSince))}
          </div>
        )}
        <AlarmBanner />
        <div className={s.content}>
          <Outlet />
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
