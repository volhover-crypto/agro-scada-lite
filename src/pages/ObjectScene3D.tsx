import { useEffect, useMemo, useRef, type ReactNode } from 'react'
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
 * 3D-сцена объекта (07 §3.1): изометрия (ортокамера, вращение ±45°, зум, сброс),
 * светлая поверхность, ряды виноградника с листвой, детализированные посты «ТОЧКА»,
 * пунктирные линии связи к БС. Подробная карточка поста — только при выделении.
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
const WOOD = '#8D6E4C'
const TRELLIS_WIRE = '#A68B6B'
const FOLIAGE = '#6B9B3E'
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
          sizeX={Math.max(24, ...scaled.map((p) => Math.abs(p.x - center[0]) * 2)) + 24}
          sizeY={Math.max(16, ...scaled.map((p) => Math.abs(p.y - center[1]) * 2)) + 24}
          onClear={() => onSelectPost(null)}
        />
        <CropRows objectType={objectType} positions={scaled} />
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
  return (
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
  )
}

/** Ряды культур инстансингом (07 §3.1): столбы + шпалера + зелёная крона виноградника */
function CropRows({
  objectType,
  positions,
}: {
  objectType?: string
  positions: Array<ScenePosition & { x: number; y: number }>
}) {
  const columns = useMemo(() => {
    if (objectType === 'pump_station') return []
    const items: Array<{ x: number; z: number }> = []
    const minX = Math.min(0, ...positions.map((p) => p.x)) - 4
    const maxX = Math.max(0, ...positions.map((p) => p.x)) + 4
    const minY = Math.min(0, ...positions.map((p) => p.y)) - 4
    const maxY = Math.max(0, ...positions.map((p) => p.y)) + 4
    for (let x = minX; x <= maxX; x += 4) {
      for (let z = minY; z <= maxY; z += 4) {
        items.push({ x, z })
      }
    }
    return items
  }, [positions, objectType])

  const postsRef = useRef<THREE.InstancedMesh>(null)
  const foliageRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const m = new THREE.Matrix4()
    if (postsRef.current) {
      columns.forEach((c, i) => {
        m.setPosition(c.x, 0.75, c.z)
        postsRef.current!.setMatrixAt(i, m)
      })
      postsRef.current.instanceMatrix.needsUpdate = true
    }
    if (foliageRef.current) {
      columns.forEach((c, i) => {
        m.setPosition(c.x, 1.05, c.z)
        foliageRef.current!.setMatrixAt(i, m)
      })
      foliageRef.current.instanceMatrix.needsUpdate = true
    }
  }, [columns])

  if (objectType === 'pump_station') return null

  return (
    <group>
      {/* столбы шпалеры */}
      <instancedMesh
        ref={postsRef}
        args={[
          undefined as unknown as THREE.BufferGeometry,
          undefined as unknown as THREE.Material,
          Math.max(1, columns.length),
        ]}
      >
        <boxGeometry args={[0.16, 1.5, 0.16]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </instancedMesh>
      {/* зелёная крона виноградной лозы */}
      <instancedMesh
        ref={foliageRef}
        args={[
          undefined as unknown as THREE.BufferGeometry,
          undefined as unknown as THREE.Material,
          Math.max(1, columns.length),
        ]}
      >
        <boxGeometry args={[3.4, 0.75, 0.55]} />
        <meshStandardMaterial color={FOLIAGE} roughness={0.8} />
      </instancedMesh>
      {/* шпалера: горизонтальные перекладины по X */}
      {columns.map((c, i) => (
        <mesh key={i} position={[c.x, 1.48, c.z]}>
          <boxGeometry args={[3.8, 0.05, 0.05]} />
          <meshStandardMaterial color={TRELLIS_WIRE} roughness={0.7} />
        </mesh>
      ))}
    </group>
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
