import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router'
import type { components } from '@/api/types.gen'
import { ru } from '@/i18n/ru'
import 'leaflet/dist/leaflet.css'
import s from './map.module.css'

/*
 * Карта объекта (05 §3): маркеры постов цветом worst_status (06 §2),
 * клик → карточка поста со ссылкой.
 */

type PostT = components['schemas']['Post']

const STATUS_COLOR: Record<string, string> = {
  ok: 'var(--actuator-on)',
  warn: 'var(--alarm-p3)',
  alarm: 'var(--alarm-p1)',
  offline: 'var(--actuator-off)',
}

/** Цветной маркер: divIcon (не зависит от тайловых иконок Leaflet) */
function postIcon(status: string): L.DivIcon {
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.ok!
  return L.divIcon({
    className: s.marker,
    html: `<span style="background:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

export function ObjectMap({ posts, objectId }: { posts: PostT[]; objectId: number }) {
  const withCoords = posts.filter(
    (p): p is PostT & { lat: number; lon: number } => p.lat != null && p.lon != null,
  )
  const first = withCoords[0]
  if (!first) return <p>{ru.widgets.noData}</p>

  return (
    <div>
      <p className={s.hint}>{ru.objectPage.mapHint}</p>
      <MapContainer center={[first.lat, first.lon]} zoom={14} scrollWheelZoom className={s.map}>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withCoords.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lon]} icon={postIcon(p.worst_status ?? 'ok')}>
            <Popup>
              <strong>
                {ru.objectPage.postPopup
                  .replace('{name}', p.name ?? '')
                  .replace('{plot}', p.plot_name ?? '')}
              </strong>
              <br />
              <Link to={`/o/${objectId}/p/${p.id}`}>{ru.objectPage.openPost}</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
