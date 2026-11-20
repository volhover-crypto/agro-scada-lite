import { ru } from '@/i18n/ru'
import logo from '@/assets/brand/logo.svg'
import s from './tokens.module.css'

// Витрина дизайн-токенов (T02, приёмка 08_TASKS_PLAN): цвета, статусы, приоритеты.
// Инструмент разработки: маршрут вне навигации (DECISIONS D-05).
export function TokensPage() {
  const t = ru.devTokens
  return (
    <div className={s.page}>
      <h1 className={s.title}>{t.title}</h1>
      <p className={s.subtitle}>{t.subtitle}</p>

      <section>
        <h2 className={s.sectionTitle}>{t.brand}</h2>
        <div className={`${s.card} ${s.grid}`}>
          <div className={s.swatch}>
            <div className={s.swatchColor} style={{ background: 'var(--brand-olive)' }} />
            <span className={s.swatchLabel}>{t.brandOlive}</span>
            <span className={s.swatchName}>--brand-olive #7A8B3A [approx]</span>
          </div>
          <div className={s.swatch}>
            <div className={s.swatchColor} style={{ background: 'var(--brand-olive-dark)' }} />
            <span className={s.swatchLabel}>{t.brandOliveDark}</span>
            <span className={s.swatchName}>--brand-olive-dark #5C6B2A [approx]</span>
          </div>
          <div className={s.swatch}>
            <div className={s.swatchColor} style={{ background: 'var(--brand-blue)' }} />
            <span className={s.swatchLabel}>{t.brandBlue}</span>
            <span className={s.swatchName}>--brand-blue #2F7FD8 [approx]</span>
          </div>
          <div className={s.swatch}>
            <img className={s.logoStub} src={logo} alt={t.logoStub} />
            <span className={s.swatchName}>src/assets/brand/logo.svg</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className={s.sectionTitle}>{t.surfaces}</h2>
        <div className={`${s.card} ${s.grid}`}>
          <div className={s.swatch}>
            <div className={s.swatchColor} style={{ background: 'var(--bg-page)' }} />
            <span className={s.swatchLabel}>{t.bgPage}</span>
            <span className={s.swatchName}>--bg-page</span>
          </div>
          <div className={s.swatch}>
            <div className={s.swatchColor} style={{ background: 'var(--bg-surface)' }} />
            <span className={s.swatchLabel}>{t.bgSurface}</span>
            <span className={s.swatchName}>--bg-surface</span>
          </div>
          <div className={s.swatch}>
            <div className={s.swatchColor} style={{ background: 'var(--bg-sunken)' }} />
            <span className={s.swatchLabel}>{t.bgSunken}</span>
            <span className={s.swatchName}>--bg-sunken</span>
          </div>
          <div className={s.swatch}>
            <div
              className={s.swatchColor}
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {t.textPrimary}
            </div>
            <span className={s.swatchName}>--text-primary на --bg-surface</span>
          </div>
          <div className={s.swatch}>
            <div
              className={s.swatchColor}
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {t.textSecondary}
            </div>
            <span className={s.swatchName}>--text-secondary на --bg-surface</span>
          </div>
          <div className={s.swatch}>
            <div
              className={s.swatchColor}
              style={{
                border: '2px solid var(--border)',
                boxShadow: 'var(--shadow-card)',
                background: 'var(--bg-surface)',
              }}
            />
            <span className={s.swatchLabel}>{t.borderAndShadow}</span>
            <span className={s.swatchName}>--border, --shadow-card</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className={s.sectionTitle}>{t.dataStatuses}</h2>
        <div className={s.card}>
          <div className={s.statusRow}>
            <span className={s.statusName}>good</span>
            <span className={`${s.valueGood} tabular`}>27,4 %</span>
          </div>
          <div className={s.statusRow}>
            <span className={s.statusName}>stale</span>
            <span className={`${s.valueStale} tabular`}>24,1 % · {t.statusStale}</span>
          </div>
          <div className={s.statusRow}>
            <span className={s.statusName}>offline</span>
            <span className={`${s.valueStale} tabular`}>✕ 24,1 %</span>
          </div>
          <div className={s.statusRow}>
            <span className={s.statusName}>out_of_range</span>
            <span className={`${s.valueError} tabular`}>147 %</span>
          </div>
          <div className={s.statusRow}>
            <span className={s.statusName}>sensor_error</span>
            <span className={`${s.valueError} tabular`}>—</span>
          </div>
          <div className={s.statusRow}>
            <span className={s.statusName}>forecast</span>
            <span className={`${s.valueForecast} tabular`}>1,8 мм · {t.statusForecast}</span>
          </div>
          <div className={s.statusRow}>
            <span className={s.statusName}>sim</span>
            <span className={s.simBadge}>{t.statusSim}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className={s.sectionTitle}>{t.alarmPriorities}</h2>
        <div
          className={s.card}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          <div
            className={s.alarmRow}
            style={{ color: 'var(--alarm-p1)', background: 'var(--alarm-p1-bg)' }}
          >
            {t.alarmP1}
          </div>
          <div
            className={s.alarmRow}
            style={{ color: 'var(--alarm-p2)', background: 'var(--alarm-p2-bg)' }}
          >
            {t.alarmP2}
          </div>
          <div
            className={s.alarmRow}
            style={{ color: 'var(--alarm-p3)', background: 'var(--alarm-p3-bg)' }}
          >
            {t.alarmP3}
          </div>
          <div
            className={s.alarmRow}
            style={{ color: 'var(--alarm-p4)', background: 'var(--alarm-p4-bg)' }}
          >
            {t.alarmP4}
          </div>
        </div>
      </section>

      <section>
        <h2 className={s.sectionTitle}>{t.actuatorStates}</h2>
        <div className={`${s.card} ${s.actuatorRow}`}>
          <span className={s.actuatorItem}>
            <span className={`${s.dot} ${s.dotOn}`} /> {t.actuatorOn}
          </span>
          <span className={s.actuatorItem}>
            <span className={`${s.dot} ${s.dotOff}`} /> {t.actuatorOff}
          </span>
          <span className={s.actuatorItem}>
            <span className={`${s.dot} ${s.dotPending}`} /> {t.actuatorPending}
          </span>
          <span className={s.actuatorItem}>
            <span className={`${s.dot} ${s.dotUnknown}`} /> {t.actuatorUnknown}
          </span>
          <span className={s.actuatorItem}>
            <span className={`${s.dot} ${s.dotFault}`} /> {t.actuatorFault}
          </span>
        </div>
      </section>

      <section>
        <h2 className={s.sectionTitle}>{t.typography}</h2>
        <div className={s.card}>
          <div className={s.typeRow} style={{ fontSize: 'var(--font-size-xs)' }}>
            <span className={s.typeName}>12</span> Подписи, время
          </div>
          <div className={s.typeRow} style={{ fontSize: 'var(--font-size-base)' }}>
            <span className={s.typeName}>14</span> Базовый текст интерфейса
          </div>
          <div className={s.typeRow} style={{ fontSize: 'var(--font-size-md)' }}>
            <span className={s.typeName}>16</span> Подзаголовки
          </div>
          <div className={s.typeRow} style={{ fontSize: 'var(--font-size-lg)' }}>
            <span className={s.typeName}>20</span> Заголовки блоков
          </div>
          <div className={s.typeRow} style={{ fontSize: 'var(--font-size-xl)' }}>
            <span className={s.typeName}>24</span> Заголовки страниц
          </div>
          <div className={s.typeRow} style={{ fontSize: 'var(--font-size-xxl)' }}>
            <span className={s.typeName}>32</span> Крупные акценты
          </div>
          <p className={s.note}>{t.typographyNote}</p>
        </div>
      </section>

      <section>
        <h2 className={s.sectionTitle}>{t.shape}</h2>
        <div className={s.card}>
          <div className={s.shapeRow}>
            <div className={`${s.shapeCard} ${s.shapeCardRound}`}>{t.radiusCard}</div>
            <div className={`${s.shapeCard} ${s.shapeBtnRound}`}>{t.radiusBtn}</div>
            <div className={s.shapeCta} aria-label={t.radiusCta} />
          </div>
          <div className={s.spacingScale}>
            {([4, 8, 12, 16, 24, 32] as const).map((px) => (
              <div
                key={px}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                }}
              >
                <span className={s.spacingItem} style={{ height: px }} />
                <span className={s.spacingName}>{px}</span>
              </div>
            ))}
          </div>
          <p className={s.note}>{t.spacingScale}</p>
          <p className={s.note}>{t.touchNote}</p>
        </div>
      </section>
    </div>
  )
}
