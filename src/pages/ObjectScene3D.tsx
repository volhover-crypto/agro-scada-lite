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
 * поверхность, инстансинг рядов культур, посты «ТОЧКА» с кольцами статуса,
 * пунктирные линии связи к БС, HTML-метки (название, значения, время, тревога),
 * значки исполнителей (вкл — пульс/поток). Клик по посту → панель поста.
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

const SOIL_LIGHT = '#8B6A47'
const SOIL_DARK = '#6E5236'
const WOOD = '#6E5236'
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
        <color attach="background" args={['#EFE6D6']} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} />
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
        />
        <CropRows objectType={objectType} positions={scaled} />
        {bs.map(([x, y], i) => (
          <group key={`bs${i}`} position={[x, 0, y]}>
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[1.2, 1, 1.2]} />
              <meshLambertMaterial color="#4A4F55" />
            </mesh>
            <mesh position={[0, 1.6, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 1.4]} />
              <meshLambertMaterial color="#4A4F55" />
            </mesh>
            <Html center position={[0, 2.4, 0]}>
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
            onSelect={() => onSelectPost(p.postId)}
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
}: {
  cx: number
  cz: number
  sizeX: number
  sizeY: number
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow={false}>
      <planeGeometry args={[sizeX, sizeY]} />
      <meshLambertMaterial color={SOIL_LIGHT} />
    </mesh>
  )
}

/** Ряды культур инстансингом (07 §3.1): столбы+шпалера для виноградника,
 *  деревья для сада; насосная — без рядов */
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

  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    if (ref.current) {
      const m = new THREE.Matrix4()
      columns.forEach((c, i) => {
        m.setPosition(c.x, 0.75, c.z)
        ref.current!.setMatrixAt(i, m)
      })
      ref.current.instanceMatrix.needsUpdate = true
    }
  }, [columns])

  if (objectType === 'pump_station') return null

  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[
          undefined as unknown as THREE.BufferGeometry,
          undefined as unknown as THREE.Material,
          Math.max(1, columns.length),
        ]}
      >
        <boxGeometry args={[0.18, 1.5, 0.18]} />
        <meshLambertMaterial color={WOOD} />
      </instancedMesh>
      {/* шпалера: горизонтальные перекладины по X */}
      {columns.map((c, i) => (
        <mesh key={i} position={[c.x, 1.35, c.z]}>
          <boxGeometry args={[3.6, 0.08, 0.08]} />
          <meshLambertMaterial color={SOIL_DARK} />
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
    <group position={[position.x, 0, position.y]} onClick={onSelect}>
      {/* корпус ТОЧКА + антенна */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.9, 1.1, 0.7]} />
        <meshLambertMaterial color="#4A4F55" />
      </mesh>
      <mesh position={[0.3, 1.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1]} />
        <meshLambertMaterial color="#4A4F55" />
      </mesh>
      {/* кольцо статуса */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.8, 1.15, 32]} />
        <meshBasicMaterial color={statusColor(position.status)} side={THREE.DoubleSide} />
      </mesh>
      {/* линии связи к БС: пунктир, цвет по качеству (локальные координаты группы) */}
      {bs.map(([x, y], i) => (
        <Line
          key={i}
          points={[
            [0, 0.4, 0],
            [x - position.x, 0.4, y - position.y],
          ]}
          color={linkColor}
          lineWidth={1.2}
          dashed
          dashScale={6}
        />
      ))}
      {/* исполнители: значок у поста; вкл — пульс (масштаб анимацией) */}
      {act.map((a) => (
        <ActuatorBadge key={a.id} actuator={a} />
      ))}
      {/* HTML-метка */}
      <Html center position={[0, 2.4, 0]} style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          className={selected ? `${sc.postLabel} ${sc.postLabelSelected}` : sc.postLabel}
          onClick={onSelect}
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
    <mesh ref={ref} position={[1.4, 0.35, 0.6]}>
      <sphereGeometry args={[0.35, 16, 16]} />
      <meshLambertMaterial color={color} />
    </mesh>
  )
}
