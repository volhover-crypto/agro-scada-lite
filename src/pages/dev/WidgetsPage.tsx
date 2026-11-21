import { BarWidget } from '@/widgets/Bar'
import { CardWidget } from '@/widgets/Card'
import { GaugeWidget } from '@/widgets/Gauge'
import { LampWidget } from '@/widgets/Lamp'
import { TableWidget } from '@/widgets/Table'
import { ru } from '@/i18n/ru'
import s from '@/widgets/widgets.module.css'

/*
 * Витрина виджетов /dev/widgets (T07): Card, Lamp, Gauge на представителях
 * статусов качества сценария quality (04 §4). Tag_id привязаны к seed мока —
 * страница существует только в dev (как /dev/tokens); в прод не попадает
 * смысловой нагрузки, дашборды появятся в T09.
 */

// post1 good · post2 stale · post3 offline · post4 out_of_range ·
// post5 sensor_error · post6 sim · post13 давление (good, реалистичный диапазон)
const DEMO_TAGS = [
  '70B3D58FF0031A01/1/150/1',
  '70B3D58FF0031A02/1/150/1',
  '70B3D58FF0031A03/1/150/1',
  '70B3D58FF0031A04/3/-10/1',
  '70B3D58FF0031A05/3/-30/1',
  '70B3D58FF0031A06/1/150/1',
  '70B3D58FF0031A0D/6/0/1',
] as const

/** Диапазон шкалы по коду параметра из tag_id */
function gaugeRange(tagId: string): { min: number; max: number } {
  const code = Number(tagId.split('/')[1])
  if (code === 1) return { min: -10, max: 40 }
  if (code === 6) return { min: 0, max: 6 }
  return { min: 0, max: 100 }
}

/** Порог лампы по коду: t воздуха ≥10 «Тепло», RH ≥70 «Влажно», влажность ≥25 «Влажно» */
function lampSetup(tagId: string): { threshold: number; labels: { on: string; off: string } } {
  const code = Number(tagId.split('/')[1])
  if (code === 1) return { threshold: 10, labels: { on: 'Тепло', off: 'Холодно' } }
  if (code === 2) return { threshold: 70, labels: { on: 'Влажно', off: 'Сухо' } }
  if (code === 3) return { threshold: 25, labels: { on: 'Влажно', off: 'Сухо' } }
  return { threshold: 1, labels: { on: ru.widgets.lampOn, off: ru.widgets.lampOff } }
}

function titleFor(tagId: string): string {
  const parts = tagId.split('/')
  const levelPart = Number(parts[2]) !== 0 ? ` ${Number(parts[2])} см` : ''
  return `Тег ${(parts[0] ?? '').slice(-2)}/${parts[1]}${levelPart}`
}

export function WidgetsPage() {
  const tags = [...DEMO_TAGS]
  return (
    <div className={s.devPage}>
      <h1>{ru.devWidgets.title}</h1>
      <p style={{ color: 'var(--text-secondary)' }}>{ru.devWidgets.subtitle}</p>

      <section>
        <h2 className={s.devSectionTitle}>{ru.devWidgets.sectionCard}</h2>
        <div className={s.devGrid}>
          {tags.map((t) => (
            <CardWidget key={`card-${t}`} title={titleFor(t)} tags={[t]} />
          ))}
        </div>
      </section>

      <section>
        <h2 className={s.devSectionTitle}>{ru.devWidgets.sectionGauge}</h2>
        <div className={s.devGrid}>
          {tags.map((t) => (
            <GaugeWidget
              key={`gauge-${t}`}
              title={titleFor(t)}
              tags={[t]}
              options={gaugeRange(t)}
              thresholds={Number(t.split('/')[1]) === 3 ? [{ value: 25, color: 'warn' }] : []}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className={s.devSectionTitle}>{ru.devWidgets.sectionLamp}</h2>
        <div className={s.devGrid}>
          {tags.map((t) => {
            const setup = lampSetup(t)
            return (
              <LampWidget
                key={`lamp-${t}`}
                title={titleFor(t)}
                tags={[t]}
                options={{ mode: 'threshold', threshold: setup.threshold, labels: setup.labels }}
              />
            )
          })}
        </div>
      </section>

      <section>
        <h2 className={s.devSectionTitle}>Bar — осадки по дням</h2>
        <BarWidget
          title="Осадки, пост 1 (сумма за сутки)"
          tags={['70B3D58FF0031A01/9/150/1']}
          period="7d"
        />
      </section>

      <section>
        <h2 className={s.devSectionTitle}>Table — телеметрия</h2>
        <TableWidget
          title="Пост 1 · все параметры"
          tags={[
            '70B3D58FF0031A01/1/150/1',
            '70B3D58FF0031A01/2/150/1',
            '70B3D58FF0031A01/3/-10/1',
            '70B3D58FF0031A01/9/150/1',
          ]}
        />
      </section>
    </div>
  )
}
