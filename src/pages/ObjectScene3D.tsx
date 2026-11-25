import { useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'
import { ValueText } from '@/widgets/quality'
import sc from './scene.module.css'
import {
  actuatorsOf,
  baseStationPoints,
  hasActiveAlarm,
  labelTagsFor,
  scenePositions,
  sceneScale,
  statusColor,
  type ScenePosition,
} from './scene3d-helpers'

/*
 * 3D-сцена объекта (07 §3.1, T20): изометрия (ортокамера, вращение ±45°, зум, сброс),
 * приглушённая подложка почвы с тонкой сеткой и плоским слоем TerrainOverlay по типу объекта,
 * детализированные посты «ТОЧКА», пунктирные линии связи к БС.
 */

type PostT = components['schemas']['Post']
type TagValueT = components['schemas']['TagValue']
type ActuatorT = components['schemas']['Actuator']
type AlarmT = components['schemas']['Alarm']

export interface Scene3DProps {
  posts: PostT[]
  objectType?: string
  current: TagValueT[]
  actuators: ActuatorT[]
  alarms: AlarmT[]
  /** выбран пост (панель) */
  selectedPostId: number | null
  onSelectPost: (id: number | null) => void
  children: (postId: number) => ReactNode
}

const SOIL_LIGHT = '#C8AE86'
const GRID_MAJOR = '#B89D75'
const GRID_MINOR = '#C0A67E'
const ROW_STRIP = '#B7A27A'
const GREENHOUSE_LINE = '#8E887B'
const PAD_GRAVEL = '#D4CFC5'
const DATA_BLUE = '#2F7FD8'

export function ObjectScene3D({
  posts,
  objectType,
  current,
  actuators,
  alarms,
  selectedPostId,
  onSelectPost,
  children,
}: Scene3DProps) {
  const positions = useMemo(() => scenePositions(posts), [posts])
  const scale = useMemo(() => sceneScale(positions), [positions])
  const scaled = useMemo(
    () => positions.map((p) => ({ ...p, x: p.x * scale, y: p.y * scale })),
    [positions, scale],
  )
  const bs = useMemo(() => baseStationPoints(scaled), [scaled])
  const center = useMemo<[number, number]>(() => {
    if (scaled.length === 0) return [0, 0]
    const xs = scaled.map((p) => p.x)
    const ys = scaled.map((p) => p.y)
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  }, [scaled])
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls> | null>(null)

  const groundSizeX = Math.max(24, ...scaled.map((p) => Math.abs(p.x - center[0]) * 2)) + 24
  const groundSizeY = Math.max(16, ...scaled.map((p) => Math.abs(p.y - center[1]) * 2)) + 24

  function resetView() {
    controlsRef.current?.reset()
  }

  return (
    <div className={sc.wrap}>
      <button type="button" className={sc.resetBtn} onClick={resetView}>
        {ru.scene3d.reset}
      </button>
      <Canvas
        orthographic
        camera={{
          position: [center[0] + 24, 24, center[1] + 24],
          zoom: 12,
          near: 0.1,
          far: 200,
        }}
      >
        <color attach="background" args={['#F4EDE0']} />
        <hemisphereLight args={['#FFFDF7', '#B89B72', 1.15]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[18, 28, 16]} intensity={1.35} color="#FFF8EA" />
        <OrbitControls
          ref={controlsRef}
          target={[center[0], 0, center[1]]}
          enableZoom
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.6}
        />
        <Ground
          cx={center[0]}
          cz={center[1]}
          sizeX={groundSizeX}
          sizeY={groundSizeY}
          onClear={() => onSelectPost(null)}
        />
        <TerrainOverlay objectType={objectType} positions={scaled} center={center} />
        {bs.map(([x, y], i) => (
          <group key={`bs${i}`} position={[x, 0, y]}>
            {/* светлый шкаф базовой станции */}
            <mesh position={[0, 0.55, 0]}>
              <boxGeometry args={[1.25, 1.1, 1.15]} />
              <meshStandardMaterial color="#E6E1D6" roughness={0.6} />
            </mesh>
            {/* козырёк */}
            <mesh position={[0, 1.15, 0]}>
              <boxGeometry args={[1.38, 0.1, 1.28]} />
              <meshStandardMaterial color="#5A636A" roughness={0.5} />
            </mesh>
            {/* мачта и LoRa-антенна */}
            <mesh position={[0, 2.0, 0]}>
              <cylinderGeometry args={[0.05, 0.07, 1.7]} />
              <meshStandardMaterial color="#8A9299" metalness={0.4} roughness={0.4} />
            </mesh>
            <mesh position={[0, 2.95, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 0.55]} />
              <meshStandardMaterial color="#F7F5F0" roughness={0.3} />
            </mesh>
            {/* индикатор связи */}
            <mesh position={[0.45, 0.85, 0.6]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshBasicMaterial color="#3E9A4A" />
            </mesh>
            <Html center position={[0, 3.55, 0]}>
              <span className={sc.bsLabel}>БС-{i + 1}</span>
            </Html>
          </group>
        ))}
        {scaled.map((p) => (
          <ScenePost
            key={p.postId}
            position={p}
            current={current}
            actuators={actuators}
            alarms={alarms}
            bs={bs}
            selected={selectedPostId === p.postId}
            onSelect={() => onSelectPost(selectedPostId === p.postId ? null : p.postId)}
          />
        ))}
      </Canvas>
      {selectedPostId != null && <aside className={sc.sidePanel}>{children(selectedPostId)}</aside>}
    </div>
  )
}

function Ground({
  cx,
  cz,
  sizeX,
  sizeY,
  onClear,
}: {
  cx: number
  cz: number
  sizeX: number
  sizeY: number
  onClear: () => void
}) {
  const gridSize = Math.max(sizeX, sizeY)
  const divisions = Math.max(8, Math.round(gridSize / 4))
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx, 0, cz]}
        onClick={(e) => {
          e.stopPropagation()
          onClear()
        }}
      >
        <planeGeometry args={[sizeX, sizeY]} />
        <meshStandardMaterial color={SOIL_LIGHT} roughness={0.95} />
      </mesh>
      <gridHelper args={[gridSize, divisions, GRID_MAJOR, GRID_MINOR]} position={[cx, 0.005, cz]} />
    </group>
  )
}

/** Плоский слой разметки поверхности по типу объекта (T20) */
function TerrainOverlay({
  objectType,
  positions,
  center,
}: {
  objectType?: string
  positions: Array<ScenePosition & { x: number; y: number }>
  center: [number, number]
}) {
  const bounds = useMemo(() => {
    if (positions.length === 0) {
      return { minX: center[0] - 8, maxX: center[0] + 8, minZ: center[1] - 6, maxZ: center[1] + 6 }
    }
    const xs = positions.map((p) => p.x)
    const zs = positions.map((p) => p.y)
    return {
      minX: Math.min(...xs) - 5,
      maxX: Math.max(...xs) + 5,
      minZ: Math.min(...zs) - 5,
      maxZ: Math.max(...zs) + 5,
    }
  }, [positions, center])

  const width = Math.max(10, bounds.maxX - bounds.minX)
  const depth = Math.max(8, bounds.maxZ - bounds.minZ)
  const cx = (bounds.minX + bounds.maxX) / 2
  const cz = (bounds.minZ + bounds.maxZ) / 2

  if (objectType === 'vineyard' || objectType === 'orchard' || objectType === 'field') {
    const step = objectType === 'field' ? 3.5 : 2.6
    const strips: number[] = []
    for (let z = bounds.minZ + 1; z <= bounds.maxZ - 1; z += step) {
      strips.push(z)
    }
    return (
      <group>
        {strips.map((z, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.01, z]}>
            <planeGeometry args={[width, 0.85]} />
            <meshBasicMaterial color={ROW_STRIP} transparent opacity={0.55} />
          </mesh>
        ))}
      </group>
    )
  }

  if (objectType === 'greenhouse') {
    const bays = 4
    const bayStep = width / bays
    const y = 0.02
    const outline: Array<[number, number, number]> = [
      [bounds.minX, y, bounds.minZ],
      [bounds.maxX, y, bounds.minZ],
      [bounds.maxX, y, bounds.maxZ],
      [bounds.minX, y, bounds.maxZ],
      [bounds.minX, y, bounds.minZ],
    ]
    return (
      <group>
        <Line points={outline} color={GREENHOUSE_LINE} lineWidth={1.5} />
        {Array.from({ length: bays - 1 }, (_, i) => {
          const x = bounds.minX + bayStep * (i + 1)
          return (
            <Line
              key={i}
              points={[
                [x, y, bounds.minZ],
                [x, y, bounds.maxZ],
              ]}
              color={GREENHOUSE_LINE}
              lineWidth={1}
            />
          )
        })}
      </group>
    )
  }

  // meteo, pump_station, other, undefined — чистая почва + светло-серая площадка под зоной постов
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.01, cz]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={PAD_GRAVEL} roughness={0.95} />
    </mesh>
  )
}

function ScenePost({
  position,
  current,
  actuators,
  alarms,
  bs,
  selected,
  onSelect,
}: {
  position: ScenePosition & { x: number; y: number }
  current: TagValueT[]
  actuators: ActuatorT[]
  alarms: AlarmT[]
  bs: Array<[number, number]>
  selected: boolean
  onSelect: () => void
}) {
  const labels = labelTagsFor(position.postId, current)
  const alarm = hasActiveAlarm(position.postId, alarms)
  const act = actuatorsOf(position.postId, actuators)
  const linkColor = position.status === 'offline' ? '#9A948A' : DATA_BLUE

  return (
    <group
      position={[position.x, 0, position.y]}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* стойка поста */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.7]} />
        <meshStandardMaterial color="#7F878E" metalness={0.35} roughness={0.45} />
      </mesh>
      {/* светлый корпус ТОЧКА */}
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.85, 0.85, 0.65]} />
        <meshStandardMaterial color={selected ? '#FFF9EB' : '#EAE5DA'} roughness={0.5} />
      </mesh>
      {/* солнечная мини-панель сверху */}
      <mesh position={[0, 1.43, 0]} rotation={[0.22, 0, 0]}>
        <boxGeometry args={[0.78, 0.06, 0.56]} />
        <meshStandardMaterial color="#2C4A6E" roughness={0.3} metalness={0.25} />
      </mesh>
      {/* антенна */}
      <mesh position={[0.32, 1.75, -0.15]}>
        <cylinderGeometry args={[0.035, 0.04, 0.9]} />
        <meshStandardMaterial color="#4A4F55" roughness={0.4} />
      </mesh>
      {/* кольцо статуса на земле */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.78, selected ? 1.25 : 1.08, 32]} />
        <meshBasicMaterial color={statusColor(position.status)} side={THREE.DoubleSide} />
      </mesh>
      {/* линии связи к БС */}
      {bs.map(([x, y], i) => (
        <Line
          key={i}
          points={[
            [0, 1.8, 0],
            [x - position.x, 2.2, y - position.y],
          ]}
          color={linkColor}
          lineWidth={selected ? 2 : 1.1}
          dashed
          dashScale={6}
        />
      ))}
      {/* исполнители */}
      {act.map((a) => (
        <ActuatorBadge key={a.id} actuator={a} />
      ))}
      {/* HTML-метка: компактная пилюля по умолчанию, подробная карточка — только при выделении */}
      <Html
        center
        position={[0, selected ? 2.85 : 2.35, 0]}
        zIndexRange={selected ? [100, 0] : [10, 0]}
        style={{ pointerEvents: 'auto' }}
      >
        {selected ? (
          <button
            type="button"
            className={`${sc.postLabel} ${sc.postLabelSelected}`}
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
          >
            <strong>
              {position.name}
              {alarm ? <span className={sc.alarmDot}>⚠</span> : null}
            </strong>
            {labels.map(({ tag, label }) => (
              <span key={tag.tag_id} className={`${sc.postLabelValue} tabular`}>
                <ValueText value={tag} precision={1} />{' '}
                <span className={sc.postLabelName}>{label}</span>
              </span>
            ))}
            <span className={`${sc.postLabelTime} tabular`}>
              {ru.scene3d.measured}{' '}
              {tag_ts(labels[0]?.tag ?? current.find((t) => t.post_id === position.postId))}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className={alarm ? `${sc.postPill} ${sc.postPillAlarm}` : sc.postPill}
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
          >
            {position.name}
            {alarm ? <span className={sc.alarmDot}>⚠</span> : null}
          </button>
        )}
      </Html>
    </group>
  )
}

function tag_ts(tag?: TagValueT): string {
  const iso = tag?.ts_measured ?? tag?.ts_received
  if (!iso) return '—'
  return iso.slice(11, 16)
}

/** Значок исполнителя: вкл — синий пульсирующий (поток), off — серый */
function ActuatorBadge({ actuator }: { actuator: ActuatorT }) {
  const on = actuator.fact_state === 'on' || actuator.fact_state === 'open'
  const ref = useRef<THREE.Mesh>(null)
  // пульсация включённого 1.2 с (06 §6)
  useFrame(({ clock }) => {
    if (on && ref.current) {
      const t = (clock.elapsedTime / 1.2) % 1
      ref.current.scale.setScalar(0.85 + 0.3 * Math.abs(Math.sin(t * Math.PI)))
    }
  })
  const color = on ? DATA_BLUE : actuator.fact_state === 'fault' ? '#C62828' : '#9A948A'
  return (
    <mesh ref={ref} position={[1.25, 0.35, 0.55]}>
      <sphereGeometry args={[0.32, 16, 16]} />
      <meshStandardMaterial color={color} roughness={0.4} />
    </mesh>
  )
}
