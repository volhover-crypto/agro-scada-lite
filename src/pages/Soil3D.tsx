import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useTagHistory } from '@/api/endpoints/tags'
import { toMskIso } from '@/lib/time'
import { ru } from '@/i18n/ru'
import {
  NO_DATA_COLOR,
  isoScreenY,
  labelTopPx,
  profileColor,
  timeGrid,
  valueAt,
  valueAtDepth,
  sensorLabel,
  sliderTimeLabel,
  type DepthReading,
  type SeriesPoint,
} from './soil3d-helpers'
import s from './post.module.css'

/*
 * Soil3D — разрез почвы с профилем влажности (07 §3.2): изометрический блок
 * грунта, слои залиты градиентом по значениям между датчиками, капсулы датчиков
 * в 3D, подписи «−10 см · 27,4 %» — HTML-слой справа (позиция = доля глубины;
 * drei Html даёт гонку unmount при перерендере React 19 — см. DECISIONS).
 * Ползунок по истории 24 ч / 7 д с воспроизведением, второй режим — температура
 * грунта. Меньше 2 глубин — подсказка. История — один запрос /tags/history.
 */

export interface SoilDepthTag {
  tagId: string
  /** Глубина, см (положительная; level_cm контракта отрицательный) */
  depthCm: number
  unit: string
}

export type SoilMode = 'moisture' | 'temperature'
export type SoilPeriod = '24h' | '7d'

export interface Soil3DProps {
  moisture: SoilDepthTag[]
  temperature: SoilDepthTag[]
}

/** Глубина низа блока: глубже самого глубокого датчика на 10 см */
const BLOCK_PAD_CM = 10
/** Мир: 1 единица = 10 см */
const CM_TO_UNIT = 0.1
const BLOCK_W = 6
const BLOCK_D = 3
const PLAY_TICK_MS = 400
const PERIOD_MS: Record<SoilPeriod, number> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
}
/** Шаг сетки истории (enum контракта): 24 ч — 15m, 7 д — 1h */
const PERIOD_STEP: Record<SoilPeriod, '15m' | '1h'> = { '24h': '15m', '7d': '1h' }

export function Soil3D({ moisture, temperature }: Soil3DProps) {
  const [mode, setMode] = useState<SoilMode>('moisture')
  const [period, setPeriod] = useState<SoilPeriod>('24h')
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)

  const allTags = useMemo(() => [...moisture, ...temperature].slice(0, 8), [moisture, temperature])

  // окно истории стабильно на период (иначе queryKey плавает — урок Card, T07)
  const range = useMemo(
    () => ({ from: toMskIso(Date.now() - PERIOD_MS[period]), to: toMskIso() }),
    [period],
  )
  const ids = useMemo(() => allTags.map((t) => t.tagId).filter(Boolean), [allTags])
  const hist = useTagHistory(ids, { ...range, agg: 'avg', step: PERIOD_STEP[period] })

  // точки контракта [iso, value, quality] → {ts, value} для хелперов
  const series = useMemo<Record<string, SeriesPoint[]>>(() => {
    const map: Record<string, SeriesPoint[]> = {}
    for (const sr of (hist.data ?? []) as Array<{ tag_id?: string; points?: unknown[] }>) {
      if (!sr.tag_id) continue
      map[sr.tag_id] = ((sr.points ?? []) as Array<[string, number | null, string]>).map(
        ([iso, value]) => ({ ts: Date.parse(iso), value: value ?? null }),
      )
    }
    return map
  }, [hist.data])

  const active = mode === 'moisture' ? moisture : temperature

  const grid = useMemo(() => timeGrid(active.map((t) => series[t.tagId] ?? [])), [active, series])
  const gridRef = useRef<number[]>([])
  gridRef.current = grid

  const tempRange = useMemo(() => {
    const nums = temperature
      .flatMap((t) => (series[t.tagId] ?? []).map((p) => p.value))
      .filter((v): v is number => v != null)
    return { min: Math.min(...nums), max: Math.max(...nums) }
  }, [temperature, series])

  // воспроизведение: шаг по сетке до конца, там стоп (07 §3.2 «анимация смены профиля»)
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setIdx((prev) => {
        const next = prev + 1
        if (next >= gridRef.current.length - 1) setPlaying(false)
        return Math.min(next, gridRef.current.length - 1)
      })
    }, PLAY_TICK_MS)
    return () => window.clearInterval(timer)
  }, [playing])

  // смена периода пересобирает сетку — ползунок к началу
  useEffect(() => {
    setIdx(0)
    setPlaying(false)
  }, [period])

  const tempDisabled = temperature.length < 2
  const ts = grid[Math.min(idx, Math.max(grid.length - 1, 0))]

  // геометрия вида: зум, чтобы блок (в мировых единицах) влез в канвас 300 px
  const maxDepth = (active[active.length - 1]?.depthCm ?? 20) + BLOCK_PAD_CM
  const worldH = maxDepth * CM_TO_UNIT
  const corners = [0, BLOCK_W].flatMap((dx) =>
    [-worldH / 2, worldH / 2].flatMap((y) =>
      [0, BLOCK_D].map((dz) => isoScreenY([dx - BLOCK_W / 2, y, dz - BLOCK_D / 2])),
    ),
  )
  const zoom = Math.min(40, (300 * 0.9) / (Math.max(...corners) - Math.min(...corners)))

  return (
    <section className={s.soil} aria-label={ru.soil3d.title}>
      <div className={s.soilHead}>
        <h2 className={s.blockTitle}>{ru.soil3d.title}</h2>
        <SoilControls
          mode={mode}
          period={period}
          tempDisabled={tempDisabled}
          onMode={setMode}
          onPeriod={setPeriod}
        />
      </div>

      {active.length < 2 ? (
        <p className={s.soilHint} data-testid="soil-hint">
          {ru.soil3d.hint}
        </p>
      ) : (
        <>
          <div className={s.soilCanvasWrap}>
            <Canvas orthographic camera={{ position: [11, 7, 11], zoom, near: 0.1, far: 100 }}>
              <color attach="background" args={['#EFE6D6']} />
              <ambientLight intensity={1.1} />
              <directionalLight position={[8, 14, 6]} intensity={0.7} />
              <SoilBlock tags={active} series={series} ts={ts} mode={mode} tempRange={tempRange} />
            </Canvas>
            <div className={s.soilLabels}>
              {[...active]
                .sort((a, b) => a.depthCm - b.depthCm)
                .map((t) => (
                  <div
                    key={t.tagId}
                    className={s.soilLabel}
                    style={{ top: `${labelTopPx(t.depthCm, maxDepth, zoom, 300)}px` }}
                  >
                    {sensorLabel(
                      t.depthCm,
                      valueAt(series[t.tagId] ?? [], ts ?? Number.NaN),
                      t.unit,
                    )}
                  </div>
                ))}
            </div>
          </div>
          <SoilSliderRow
            playing={playing}
            canPlay={grid.length >= 2}
            idx={idx}
            maxIdx={Math.max(grid.length - 1, 0)}
            ts={ts}
            period={period}
            onTogglePlay={() => setPlaying((p) => !p)}
            onSeek={(v) => {
              setPlaying(false)
              setIdx(v)
            }}
          />
        </>
      )}
    </section>
  )
}

/** Переключатели режима заливки (влажность/температура) и периода истории */
function SoilControls({
  mode,
  period,
  tempDisabled,
  onMode,
  onPeriod,
}: {
  mode: SoilMode
  period: SoilPeriod
  tempDisabled: boolean
  onMode: (m: SoilMode) => void
  onPeriod: (p: SoilPeriod) => void
}) {
  return (
    <div className={s.soilControls}>
      <div className={s.segGroup} role="group" aria-label={ru.soil3d.modeLabel}>
        <button
          type="button"
          className={mode === 'moisture' ? s.segBtnActive : s.segBtn}
          onClick={() => onMode('moisture')}
        >
          {ru.soil3d.modeMoisture}
        </button>
        <button
          type="button"
          className={mode === 'temperature' ? s.segBtnActive : s.segBtn}
          disabled={tempDisabled}
          title={tempDisabled ? ru.soil3d.tempUnavailable : undefined}
          onClick={() => onMode('temperature')}
        >
          {ru.soil3d.modeTemp}
        </button>
      </div>
      <div className={s.segGroup} role="group" aria-label={ru.soil3d.periodLabel}>
        <button
          type="button"
          className={period === '24h' ? s.segBtnActive : s.segBtn}
          onClick={() => onPeriod('24h')}
        >
          {ru.soil3d.period24h}
        </button>
        <button
          type="button"
          className={period === '7d' ? s.segBtnActive : s.segBtn}
          onClick={() => onPeriod('7d')}
        >
          {ru.soil3d.period7d}
        </button>
      </div>
    </div>
  )
}

/** Ползунок времени с воспроизведением и меткой текущего момента */
function SoilSliderRow({
  playing,
  canPlay,
  idx,
  maxIdx,
  ts,
  period,
  onTogglePlay,
  onSeek,
}: {
  playing: boolean
  canPlay: boolean
  idx: number
  maxIdx: number
  ts: number | undefined
  period: SoilPeriod
  onTogglePlay: () => void
  onSeek: (v: number) => void
}) {
  return (
    <div className={s.soilSliderRow}>
      <button type="button" className={s.soilPlay} onClick={onTogglePlay} disabled={!canPlay}>
        {playing ? ru.soil3d.pause : ru.soil3d.play}
      </button>
      <input
        type="range"
        className={s.soilSlider}
        min={0}
        max={maxIdx}
        value={Math.min(idx, maxIdx)}
        aria-label={ru.soil3d.time}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <span className={s.soilTime} data-testid="soil-time">
        {ts != null ? sliderTimeLabel(ts, period) : '—'}
      </span>
    </div>
  )
}

/** Блок грунта: слои-боксы между границами глубин + капсулы на передней грани */
function SoilBlock({
  tags,
  series,
  ts,
  mode,
  tempRange,
}: {
  tags: SoilDepthTag[]
  series: Record<string, SeriesPoint[]>
  ts: number | undefined
  mode: SoilMode
  tempRange: { min: number; max: number }
}) {
  const readings: DepthReading[] = tags.map((t) => ({
    depthCm: t.depthCm,
    value: valueAt(series[t.tagId] ?? [], ts ?? Number.NaN),
  }))
  const sorted = [...readings].sort((a, b) => a.depthCm - b.depthCm)
  const maxDepth = (sorted[sorted.length - 1]?.depthCm ?? 20) + BLOCK_PAD_CM
  const halfH = (maxDepth * CM_TO_UNIT) / 2

  // границы слоёв: поверхность 0, глубины датчиков, дно; блок центрирован по Y
  const bounds = [0, ...sorted.map((r) => r.depthCm), maxDepth]

  return (
    <group position={[-BLOCK_W / 2, halfH, -BLOCK_D / 2]}>
      {bounds.slice(0, -1).map((top, i) => {
        const bottom = bounds[i + 1]!
        const mid = (top + bottom) / 2
        const color = profileColor(valueAtDepth(readings, mid), mode, tempRange)
        return (
          <mesh key={`slab${i}`} position={[BLOCK_W / 2, -mid * CM_TO_UNIT, BLOCK_D / 2]}>
            <boxGeometry args={[BLOCK_W, (bottom - top) * CM_TO_UNIT, BLOCK_D]} />
            <meshLambertMaterial color={color} />
          </mesh>
        )
      })}
      {tags.map((t) => {
        const value = valueAt(series[t.tagId] ?? [], ts ?? Number.NaN)
        return (
          <mesh
            key={`cap${t.tagId}`}
            rotation={[0, 0, Math.PI / 2]}
            position={[BLOCK_W * 0.7, -t.depthCm * CM_TO_UNIT, BLOCK_D + 0.05]}
          >
            <capsuleGeometry args={[0.12, 0.5, 4, 8]} />
            <meshLambertMaterial color={value == null ? NO_DATA_COLOR : '#3a3a38'} />
          </mesh>
        )
      })}
    </group>
  )
}
