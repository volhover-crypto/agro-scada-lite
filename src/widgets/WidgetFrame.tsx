import type { ReactNode } from 'react'
import { useTagValues } from '@/api/endpoints/tags'
import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'
import { QualityMark } from './quality'
import s from './widgets.module.css'

/*
 * Рамка виджета (07 §1): заголовок + качество/время первого тега,
 * состояния загрузка (скелетон) / ошибка API ([Повторить]) / нет данных.
 * Тело рисует конкретный виджет через render-prop с упорядоченными значениями.
 */

type TagValueT = components['schemas']['TagValue']

export interface WidgetFrameProps {
  title?: string
  tagIds: string[]
  children: (values: TagValueT[]) => ReactNode
}

export function WidgetFrame({ title, tagIds, children }: WidgetFrameProps) {
  const query = useTagValues(tagIds)

  let body: ReactNode
  let primary: TagValueT | undefined

  if (query.isPending && !query.data) {
    body = (
      <div className={s.skeleton} data-testid="widget-skeleton" aria-hidden>
        <div className={s.skeletonBlock} />
        <div className={`${s.skeletonBlock} ${s.skeletonBlockBig}`} />
      </div>
    )
  } else if (query.isError) {
    body = (
      <div className={s.stateBox} data-testid="widget-error">
        <span>{ru.widgets.loadError}</span>
        <button type="button" className={s.retryBtn} onClick={() => void query.refetch()}>
          {ru.widgets.retry}
        </button>
      </div>
    )
  } else {
    const data = query.data ?? []
    const ordered = tagIds
      .map((id) => data.find((v) => v?.tag_id === id))
      .filter((v): v is TagValueT => v != null)
    primary = ordered[0]
    if (ordered.length === 0) {
      body = (
        <div className={s.stateBox} data-testid="widget-empty">
          <span>{ru.widgets.noData}</span>
        </div>
      )
    } else {
      body = children(ordered)
    }
  }

  return (
    <section className={s.frame}>
      <header className={s.frameHead}>
        {title && <h3 className={s.frameTitle}>{title}</h3>}
        {primary && <QualityMark value={primary} />}
      </header>
      {body}
    </section>
  )
}
