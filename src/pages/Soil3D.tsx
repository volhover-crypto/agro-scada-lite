import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTagHistory } from '@/api/endpoints/tags'
import { toMskIso } from '@/lib/time'
import { ru } from '@/i18n/ru'
import { formatNumber } from '@/widgets/quality'
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
 * Soil3D — полупрозрачный 3D-разрез почвы с реалистичными горизонтами, травой,
 * корнями, 5 уровнями влажности и контрастной визуализацией проникающей воды (07 §3.2).
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

const BLOCK_PAD_CM = 10
const CM_TO_UNIT = 0.1
const BLOCK_W = 5.2
const BLOCK_D = 4.2
const PLAY_TICK_MS = 320
const PERIOD_MS: Record<SoilPeriod, number> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
}
const PERIOD_STEP: Record<SoilPeriod, '15m' | '1h'> = { '24h': '15m', '7d': '1h' }

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Процедурная текстура боковой грани почвы: геологические слои +
 * высококонтрастный вертикальный градиент проникающей воды.
 */
function drawSoilTexture(
  canvas: HTMLCanvasElement,
  readings: DepthReading[],
  maxDepth: number,
  mode: SoilMode,
  tempRange: { min: number; max: number },
): void {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, w, h)

  // 1. Геологические горизонты (волнистые слои)
  const horizons: Array<{ stop: number; color: string; amp: number; freq: number }> = [
    { stop: 0.0, color: '#6b4a33', amp: 4, freq: 2.2 },
    { stop: 0.14, color: '#9c6e4e', amp: 7, freq: 2.8 },
    { stop: 0.24, color: '#cfb08c', amp: 6, freq: 3.1 },
    { stop: 0.34, color: '#8f9e59', amp: 5, freq: 2.5 },
    { stop: 0.44, color: '#dfd1b4', amp: 7, freq: 3.0 },
    { stop: 0.56, color: '#3f3b3d', amp: 6, freq: 2.1 },
    { stop: 0.68, color: '#b99c7c', amp: 8, freq: 3.4 },
    { stop: 0.82, color: '#4c4d4a', amp: 5, freq: 2.6 },
    { stop: 1.0, color: '#646964', amp: 4, freq: 2.0 },
  ]

  for (let i = 0; i < horizons.length - 1; i++) {
    const top = horizons[i]!
    const bot = horizons[i + 1]!
    const y0 = top.stop * h
    const y1 = bot.stop * h

    ctx.beginPath()
    ctx.moveTo(0, y0)
    for (let x = 0; x <= w; x += 8) {
      const wave =
        Math.sin((x / w) * Math.PI * top.freq + i * 1.3) * top.amp +
        Math.cos((x / w) * Math.PI * (top.freq * 1.7) + i) * (top.amp * 0.4)
      ctx.lineTo(x, y0 + wave)
    }
    ctx.lineTo(w, y1 + 12)
    ctx.lineTo(0, y1 + 12)
    ctx.closePath()

    const grad = ctx.createLinearGradient(0, y0, 0, y1)
    grad.addColorStop(0, top.color)
    grad.addColorStop(1, bot.color)
    ctx.fillStyle = grad
    ctx.fill()
  }

  // Тонкие прожилки и галька
  ctx.strokeStyle = 'rgba(40, 28, 18, 0.22)'
  ctx.lineWidth = 1.5
  for (let k = 1; k < 14; k++) {
    const yBase = (k / 14) * h
    ctx.beginPath()
    for (let x = 0; x <= w; x += 12) {
      const y = yBase + Math.sin((x / w) * Math.PI * 4 + k) * 4
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(215, 210, 198, 0.32)'
  for (let p = 0; p < 28; p++) {
    const px = ((p * 53) % (w - 16)) + 8
    const py = h * 0.8 + ((p * 29) % Math.max(10, Math.floor(h * 0.18)))
    ctx.beginPath()
    ctx.ellipse(px, py, 3 + (p % 4), 2 + (p % 3), (p % 5) * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }

  // 2. Высококонтрастный динамический слой влажности / температуры по глубине
  const bands = 40
  const bandH = h / bands
  for (let b = 0; b < bands; b++) {
    const depthCm = ((b + 0.5) / bands) * maxDepth
    const val = valueAtDepth(readings, depthCm)
    if (val == null) continue

    if (mode === 'moisture') {
      const norm = clamp01((val - 12) / 28)
      // Сухо (<18%) — тёплый песок; влажно (>24%) — яркий насыщенный сине-голубой фронт воды
      if (norm < 0.35) {
        const dryK = 1 - norm / 0.35
        ctx.fillStyle = `rgba(214, 158, 86, ${(0.12 + dryK * 0.28).toFixed(3)})`
      } else {
        const wetK = (norm - 0.35) / 0.65
        const r = Math.round(14 * (1 - wetK))
        const g = Math.round(168 - wetK * 50)
        const bl = 255
        const alpha = 0.22 + wetK * 0.56
        ctx.fillStyle = `rgba(${r}, ${g}, ${bl}, ${alpha.toFixed(3)})`
      }
      ctx.fillRect(0, b * bandH, w, bandH + 1)
    } else {
      const span = tempRange.max - tempRange.min
      const norm = span > 0 ? clamp01((val - tempRange.min) / span) : 0.5
      const r = Math.round(47 * (1 - norm) + 198 * norm)
      const g = Math.round(127 * (1 - norm) + 40 * norm)
      const bl = Math.round(216 * (1 - norm) + 40 * norm)
      ctx.fillStyle = `rgba(${r}, ${g}, ${bl}, 0.44)`
      ctx.fillRect(0, b * bandH, w, bandH + 1)
    }
  }

  // 3. Яркие прожилки просачивающейся воды на боковой грани при высокой влажности
  if (mode === 'moisture') {
    for (let sIdx = 0; sIdx < 9; sIdx++) {
      const sx = ((sIdx + 0.5) / 9) * w
      for (let b = 0; b < bands; b += 2) {
        const depthCm = ((b + 0.5) / bands) * maxDepth
        const val = valueAtDepth(readings, depthCm)
        if (val == null || val < 22) continue
        const wetK = clamp01((val - 22) / 18)
        ctx.strokeStyle = `rgba(110, 224, 255, ${(0.25 + wetK * 0.65).toFixed(3)})`
        ctx.lineWidth = 1.5 + wetK * 2
        ctx.beginPath()
        const y0 = b * bandH
        ctx.moveTo(sx + Math.sin(b * 0.7 + sIdx) * 3, y0)
        ctx.lineTo(sx + Math.sin((b + 2) * 0.7 + sIdx) * 3, y0 + bandH * 2)
        ctx.stroke()
      }
    }
  }
}

export function Soil3D({ moisture, temperature }: Soil3DProps) {
  const [mode, setMode] = useState<SoilMode>('moisture')
  const [period, setPeriod] = useState<SoilPeriod>('24h')
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)

  const allTags = useMemo(() => [...moisture, ...temperature].slice(0, 8), [moisture, temperature])

  const range = useMemo(
    () => ({ from: toMskIso(Date.now() - PERIOD_MS[period]), to: toMskIso() }),
    [period],
  )
  const ids = useMemo(() => allTags.map((t) => t.tagId).filter(Boolean), [allTags])
  const hist = useTagHistory(ids, { ...range, agg: 'avg', step: PERIOD_STEP[period] })

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

  useEffect(() => {
    setIdx(0)
    setPlaying(false)
  }, [period])

  const tempDisabled = temperature.length < 2
  const ts = grid[Math.min(idx, Math.max(grid.length - 1, 0))]

  const currentReadings = useMemo<DepthReading[]>(
    () =>
      active.map((t) => ({
        depthCm: t.depthCm,
        value: valueAt(series[t.tagId] ?? [], ts ?? Number.NaN),
      })),
    [active, series, ts],
  )

  const avgValue = useMemo(() => {
    const valid = currentReadings.map((r) => r.value).filter((v): v is number => v != null)
    if (valid.length === 0) return null
    return valid.reduce((acc, v) => acc + v, 0) / valid.length
  }, [currentReadings])

  const avgUnit = active[0]?.unit ?? (mode === 'moisture' ? '%' : '°C')
  const avgColor = profileColor(avgValue, mode, tempRange)
  const avgFillPct =
    avgValue == null
      ? 0
      : mode === 'moisture'
        ? Math.round(clamp01(avgValue / 45) * 100)
        : Math.round(
            clamp01(
              tempRange.max > tempRange.min
                ? (avgValue - tempRange.min) / (tempRange.max - tempRange.min)
                : 0.5,
            ) * 100,
          )

  const maxDepth = (active[active.length - 1]?.depthCm ?? 20) + BLOCK_PAD_CM
  const worldH = maxDepth * CM_TO_UNIT
  const corners = [0, BLOCK_W].flatMap((dx) =>
    [-worldH / 2 - 0.8, worldH / 2 + 0.9].flatMap((y) =>
      [0, BLOCK_D].map((dz) => isoScreenY([dx - BLOCK_W / 2, y, dz - BLOCK_D / 2])),
    ),
  )
  const zoom = Math.min(34, (320 * 0.88) / (Math.max(...corners) - Math.min(...corners)))

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
              <ambientLight intensity={1.25} />
              <directionalLight position={[10, 16, 8]} intensity={0.85} />
              <directionalLight position={[-8, 6, -6]} intensity={0.35} />
              <SoilBlock
                tags={active}
                readings={currentReadings}
                avgValue={avgValue}
                playing={playing}
                mode={mode}
                tempRange={tempRange}
              />
            </Canvas>

            {/* Крупный динамический показатель средней влажности / температуры */}
            <div className={s.soilAvgCard} data-testid="soil-avg">
              <span className={s.soilAvgTitle}>
                {mode === 'moisture' ? 'Средняя влажность' : 'Средняя температура'}
              </span>
              <span className={s.soilAvgValue} style={{ color: avgColor }}>
                {avgValue == null ? '—' : `${formatNumber(avgValue)} ${avgUnit}`}
              </span>
              <div className={s.soilAvgBar}>
                <div
                  className={s.soilAvgBarFill}
                  style={{ width: `${avgFillPct}%`, backgroundColor: avgColor }}
                />
              </div>
            </div>

            <div className={s.soilLabels}>
              {[...active]
                .sort((a, b) => a.depthCm - b.depthCm)
                .map((t) => (
                  <div
                    key={t.tagId}
                    className={s.soilLabel}
                    style={{ top: `${labelTopPx(t.depthCm, maxDepth, zoom, 320)}px` }}
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

/** Контрастные анимированные струи и капли проникающей воды внутри разреза */
function MoistureDroplets({
  worldH,
  intensity,
  playing,
}: {
  worldH: number
  intensity: number
  playing: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const drops = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        x: ((i * 1.19) % (BLOCK_W - 0.5)) - (BLOCK_W - 0.5) / 2,
        z: ((i * 1.73) % (BLOCK_D - 0.5)) - (BLOCK_D - 0.5) / 2,
        phase: (i * 0.17) % 1,
        speed: 0.22 + (i % 5) * 0.06,
        len: 0.24 + (i % 3) * 0.12,
      })),
    [],
  )

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const speedMul = playing ? 2.1 : 0.65
    groupRef.current.children.forEach((child, i) => {
      const d = drops[i]!
      d.phase = (d.phase + delta * d.speed * speedMul) % 1
      child.position.y = -d.phase * worldH
    })
  })

  if (intensity <= 0.05) return null

  return (
    <group ref={groupRef} position={[BLOCK_W / 2, 0, BLOCK_D / 2]}>
      {drops.map((d, i) => (
        <mesh key={i} position={[d.x, -d.phase * worldH, d.z]}>
          <capsuleGeometry args={[0.065 + intensity * 0.03, d.len, 4, 8]} />
          <meshStandardMaterial
            color="#38d6ff"
            emissive="#009dff"
            emissiveIntensity={0.85}
            transparent
            opacity={0.55 + intensity * 0.4}
            roughness={0.15}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Процедурный травяной покров на верхней грани блока */
function GrassCover() {
  const blades = useMemo(() => {
    const arr: Array<{ x: number; z: number; h: number; tiltX: number; tiltZ: number; color: string }> = []
    const palette = ['#4b8624', '#5c9d2e', '#70b338', '#3d711c', '#82bf42']
    const cols = 11
    const rows = 9
    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        const seed = ix * 31 + iz * 17
        const jitterX = (((seed * 13) % 10) - 5) * 0.03
        const jitterZ = (((seed * 19) % 10) - 5) * 0.03
        arr.push({
          x: 0.25 + (ix / (cols - 1)) * (BLOCK_W - 0.5) + jitterX,
          z: 0.25 + (iz / (rows - 1)) * (BLOCK_D - 0.5) + jitterZ,
          h: 0.45 + ((seed * 7) % 5) * 0.1,
          tiltX: (((seed * 11) % 7) - 3) * 0.06,
          tiltZ: (((seed * 23) % 7) - 3) * 0.06,
          color: palette[seed % palette.length]!,
        })
      }
    }
    return arr
  }, [])

  return (
    <group position={[0, 0.02, 0]}>
      <mesh position={[BLOCK_W / 2, 0.04, BLOCK_D / 2]}>
        <boxGeometry args={[BLOCK_W + 0.04, 0.08, BLOCK_D + 0.04]} />
        <meshLambertMaterial color="#4e7d28" />
      </mesh>
      {blades.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2 + 0.05, b.z]} rotation={[b.tiltX, 0, b.tiltZ]}>
          <coneGeometry args={[0.11, b.h, 4]} />
          <meshLambertMaterial color={b.color} />
        </mesh>
      ))}
    </group>
  )
}

/** Стилизованные корни внутри и снизу полупрозрачного разреза */
function RootSystem({ worldH }: { worldH: number }) {
  const strands = useMemo(
    () => [
      { x: BLOCK_W * 0.3, z: BLOCK_D * 0.35, len: worldH * 0.65, rotZ: 0.14, rotX: 0.08 },
      { x: BLOCK_W * 0.45, z: BLOCK_D * 0.6, len: worldH * 0.72, rotZ: -0.12, rotX: -0.1 },
      { x: BLOCK_W * 0.65, z: BLOCK_D * 0.4, len: worldH * 0.6, rotZ: 0.18, rotX: -0.06 },
      { x: BLOCK_W * 0.38, z: BLOCK_D * 0.72, len: worldH * 0.45, rotZ: -0.22, rotX: 0.14 },
      { x: BLOCK_W * 0.58, z: BLOCK_D * 0.68, len: worldH * 0.52, rotZ: 0.1, rotX: 0.16 },
    ],
    [worldH],
  )

  return (
    <group>
      {strands.map((st, i) => (
        <mesh
          key={i}
          position={[st.x, -worldH + st.len * 0.28, st.z]}
          rotation={[st.rotX, 0, st.rotZ]}
        >
          <cylinderGeometry args={[0.045, 0.012, st.len, 6]} />
          <meshLambertMaterial color="#6e4b30" transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  )
}

/** Полупрозрачный 3D-блок грунта с травой, слоями, контрастной водой и 5 датчиками */
function SoilBlock({
  tags,
  readings,
  avgValue,
  playing,
  mode,
  tempRange,
}: {
  tags: SoilDepthTag[]
  readings: DepthReading[]
  avgValue: number | null
  playing: boolean
  mode: SoilMode
  tempRange: { min: number; max: number }
}) {
  const sorted = [...readings].sort((a, b) => a.depthCm - b.depthCm)
  const maxDepth = (sorted[sorted.length - 1]?.depthCm ?? 20) + BLOCK_PAD_CM
  const worldH = maxDepth * CM_TO_UNIT
  const halfH = worldH / 2

  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const sideTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    canvasRef.current = canvas
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    textureRef.current = tex
    return tex
  }, [])

  useEffect(() => {
    return () => {
      textureRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !textureRef.current) return
    drawSoilTexture(canvasRef.current, readings, maxDepth, mode, tempRange)
    textureRef.current.needsUpdate = true
  }, [readings, maxDepth, mode, tempRange])

  const moistureNorm =
    avgValue == null
      ? 0
      : mode === 'moisture'
        ? clamp01((avgValue - 12) / 28)
        : clamp01(
            tempRange.max > tempRange.min
              ? (avgValue - tempRange.min) / (tempRange.max - tempRange.min)
              : 0.5,
          )
  const waterH = Math.max(0.3, worldH * (0.14 + moistureNorm * 0.82))
  const innerColor = mode === 'moisture' ? '#0095ff' : profileColor(avgValue, mode, tempRange)

  return (
    <group position={[-BLOCK_W / 2, halfH, -BLOCK_D / 2]}>
      <GrassCover />

      {/* Контрастный внутренний объём проникающей воды */}
      <mesh position={[BLOCK_W / 2, -worldH + waterH / 2, BLOCK_D / 2]}>
        <boxGeometry args={[BLOCK_W - 0.16, waterH, BLOCK_D - 0.16]} />
        <meshStandardMaterial
          color={innerColor}
          emissive={mode === 'moisture' ? '#0066cc' : innerColor}
          emissiveIntensity={0.45}
          transparent
          opacity={mode === 'moisture' ? 0.28 + moistureNorm * 0.46 : 0.32}
          roughness={0.2}
          depthWrite={false}
        />
      </mesh>

      {/* Верхняя светящаяся кромка фронта воды */}
      {mode === 'moisture' && (
        <mesh position={[BLOCK_W / 2, -worldH + waterH, BLOCK_D / 2]}>
          <boxGeometry args={[BLOCK_W - 0.1, 0.08, BLOCK_D - 0.1]} />
          <meshStandardMaterial
            color="#66e0ff"
            emissive="#00b8ff"
            emissiveIntensity={0.9}
            transparent
            opacity={0.75}
          />
        </mesh>
      )}

      {mode === 'moisture' && (
        <MoistureDroplets worldH={worldH} intensity={moistureNorm} playing={playing} />
      )}

      <RootSystem worldH={worldH} />

      {/* Полупрозрачный корпус грунта со слоями и градиентом влажности */}
      <mesh position={[BLOCK_W / 2, -halfH, BLOCK_D / 2]}>
        <boxGeometry args={[BLOCK_W, worldH, BLOCK_D]} />
        <meshLambertMaterial map={sideTexture} transparent opacity={0.56} />
      </mesh>

      {/* Капсулы 5 датчиков на передней грани */}
      {tags.map((t) => {
        const reading = readings.find((r) => r.depthCm === t.depthCm)
        const val = reading?.value ?? null
        const ringColor = val == null ? NO_DATA_COLOR : profileColor(val, mode, tempRange)
        return (
          <group
            key={`cap${t.tagId}`}
            position={[BLOCK_W * 0.72, -t.depthCm * CM_TO_UNIT, BLOCK_D + 0.06]}
          >
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.12, 0.48, 4, 8]} />
              <meshLambertMaterial color={val == null ? NO_DATA_COLOR : '#2f2f2d'} />
            </mesh>
            <mesh position={[0.26, 0, 0.02]}>
              <sphereGeometry args={[0.11, 10, 10]} />
              <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={0.55} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
