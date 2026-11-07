// Map wrapper. Uses OpenStreetMap via Leaflet; swap this file to change provider (e.g. Google Maps).
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { useEffect, useRef } from 'react'

// The map is locked to Gujarat. OpenStreetMap tiles draw international borders by OSM's own policy,
// which differs from the official map of India; at zoom 7+ inside Gujarat those borders are never in view.
// For production, switch to a provider that shows India's official boundaries (e.g. Bhuvan or Mappls).
const GUJARAT_BOUNDS = L.latLngBounds([19.9, 68.0], [24.9, 74.6])
const MIN_ZOOM = 7

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

// Nearby pins are grouped into one circle with a number; tapping it zooms in and splits it.
// From street zoom (15) every facility shows on its own; facilities at the same spot fan out in a ring.
function clusterIcon(c: L.MarkerCluster) {
  const n = c.getChildCount()
  const s = n < 10 ? 36 : n < 50 ? 42 : 50
  return L.divIcon({ className: '', html: `<div class="ks-cluster" style="width:${s}px;height:${s}px">${n}</div>`, iconSize: [s, s] })
}
function ClusteredPins({ pins, onPinClick }: { pins: MapPin[]; onPinClick?: (id: string) => void }) {
  const map = useMap()
  const group = useRef<L.MarkerClusterGroup | null>(null)
  const click = useRef(onPinClick)
  click.current = onPinClick
  useEffect(() => {
    const g = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48, disableClusteringAtZoom: 15, spiderfyOnMaxZoom: true, iconCreateFunction: clusterIcon })
    group.current = g
    map.addLayer(g)
    return () => { map.removeLayer(g); group.current = null }
  }, [map])
  const key = pins.map(p => `${p.id}:${p.lat}:${p.lng}:${p.color}:${p.icon}`).join('|')
  useEffect(() => {
    const g = group.current
    if (!g) return
    g.clearLayers()
    g.addLayers(pins.map(p => {
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(p.color, p.icon), title: p.label })
      m.on('click', () => click.current && click.current(p.id))
      return m
    }))
  }, [key]) // eslint-disable-line
  return null
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onClick && onClick(e.latlng.lat, e.latlng.lng) })
  return null
}

export function MapView({ pins, onPinClick, height = '100%', draggablePinId, onDrag, onMapClick, center, extraPins, focus, startAt }: {
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
  /** where to open when there are no pins (e.g. the DSO's district) */
  startAt?: [number, number]
}) {
  return (
    <MapContainer center={startAt || [23.0225, 72.5714]} zoom={startAt ? 12 : 11} style={{ height, width: '100%' }} scrollWheelZoom
      minZoom={MIN_ZOOM} maxBounds={GUJARAT_BOUNDS} maxBoundsViscosity={1}>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit pins={pins} center={center} focus={focus} />
      <ClickHandler onClick={onMapClick} />
      {!draggablePinId && pins.length > 1 && <ClusteredPins pins={pins} onPinClick={onPinClick} />}
      {(draggablePinId || pins.length <= 1) && pins.map(p => (
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
