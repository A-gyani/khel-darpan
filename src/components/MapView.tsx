// Map wrapper. Uses OpenStreetMap via Leaflet; swap this file to change provider (e.g. Google Maps).
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'

export interface MapPin { id: string; lat: number; lng: number; color: string; icon?: string; label?: string }

const iconCache = new Map<string, L.DivIcon>()
function pinIcon(color: string, icon = 'sports', big = false) {
  const key = color + icon + big
  if (!iconCache.has(key)) {
    const s = big ? 40 : 32
    iconCache.set(key, L.divIcon({
      className: '',
      html: `<div class="ks-pin" style="width:${s}px;height:${s}px;background:${color}"><span class="ms fill">${icon}</span></div>`,
      iconSize: [s, s], iconAnchor: [s / 2, s], popupAnchor: [0, -s],
    }))
  }
  return iconCache.get(key)!
}

function Fit({ pins, center, focus }: { pins: MapPin[]; center?: [number, number]; focus?: [number, number][] }) {
  const map = useMap()
  const focusKey = focus?.map(p => p.join(',')).join(';') || ''
  useEffect(() => {
    if (focus && focus.length) {
      if (focus.length === 1) map.setView(focus[0], 14, { animate: false })
      else map.fitBounds(L.latLngBounds(focus), { padding: [48, 48], maxZoom: 15, animate: false })
      return
    }
    // no animation: avoids Leaflet errors if the page changes mid-zoom
    if (center) { map.setView(center, Math.max(map.getZoom(), 16), { animate: false }); return }
    if (pins.length > 1) map.fitBounds(L.latLngBounds(pins.map(p => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 14, animate: false })
    else if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 15, { animate: false })
  }, [pins.length, center?.[0], center?.[1], focusKey]) // eslint-disable-line
  return null
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onClick && onClick(e.latlng.lat, e.latlng.lng) })
  return null
}

export function MapView({ pins, onPinClick, height = '100%', draggablePinId, onDrag, onMapClick, center, extraPins, focus }: {
  pins: MapPin[]
  onPinClick?: (id: string) => void
  height?: number | string
  draggablePinId?: string
  onDrag?: (lat: number, lng: number) => void
  onMapClick?: (lat: number, lng: number) => void
  center?: [number, number]
  extraPins?: MapPin[]
  /** points the map should zoom to show (e.g. user + nearest facilities) */
  focus?: [number, number][]
}) {
  return (
    <MapContainer center={[23.0225, 72.5714]} zoom={11} style={{ height, width: '100%' }} scrollWheelZoom>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit pins={pins} center={center} focus={focus} />
      <ClickHandler onClick={onMapClick} />
      {pins.map(p => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.color, p.icon, p.id === draggablePinId)} title={p.label}
          draggable={p.id === draggablePinId}
          eventHandlers={{
            click: () => onPinClick && onPinClick(p.id),
            dragend: e => { const ll = (e.target as L.Marker).getLatLng(); onDrag && onDrag(ll.lat, ll.lng) },
          }} />
      ))}
      {extraPins?.map(p => <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.color, p.icon)} title={p.label} />)}
    </MapContainer>
  )
}
