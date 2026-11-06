import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Chip, Dialog, IconButton, Stack, Typography, CircularProgress } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Icon } from './ui'
import { getPosition, haversine, sha256, uid } from '../lib/geo'
import { PHOTO_CAPTIONS, FAR_FROM_PIN_M, POOR_GPS_M, TALUKAS } from '../lib/constants'
import type { Photo, PhotoCaption } from '../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (p: Photo) => void
  facilityName: string
  officerName: string
  officerId: string
  taluka: string
  ward: string
  district?: { en: string; gu: string }
  pin: { lat: number; lng: number } | null
  existingHashes: string[]
  defaultCaption: PhotoCaption
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src })
}

// small OSM map thumbnail for the stamp (one tile at zoom 16, marker drawn at the exact point)
async function drawMiniMap(ctx: CanvasRenderingContext2D, lat: number, lng: number, x: number, y: number, size: number) {
  const z = 16
  const n = 2 ** z
  const xt = ((lng + 180) / 360) * n
  const latR = (lat * Math.PI) / 180
  const yt = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n
  const tx = Math.floor(xt), ty = Math.floor(yt)
  try {
    const img = await loadImage(`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`)
    ctx.save()
    ctx.beginPath(); ctx.roundRect(x, y, size, size, 10); ctx.clip()
    ctx.drawImage(img, x, y, size, size)
    const px = x + (xt - tx) * size, py = y + (yt - ty) * size
    ctx.fillStyle = '#E53935'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.restore()
    return true
  } catch { return false }
}

export function CameraCapture(props: Props) {
  const { t, i18n } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [caption, setCaption] = useState<PhotoCaption>(props.defaultCaption)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Photo | null>(null)

  useEffect(() => { setCaption(props.defaultCaption) }, [props.defaultCaption, props.open])

  useEffect(() => {
    if (!props.open || preview) return
    let cancelled = false
    setErr('')
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
      .then(s => {
        if (cancelled) { s.getTracks().forEach(tr => tr.stop()); return }
        streamRef.current = s
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}) }
      })
      .catch(() => setErr(t('cam.noCamera')))
    if (!navigator.mediaDevices) setErr(t('cam.noCamera'))
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(tr => tr.stop()); streamRef.current = null }
  }, [props.open, preview]) // eslint-disable-line

  async function capture() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    setBusy(true)
    // freeze frame first, then get GPS at the moment of capture
    const frame = document.createElement('canvas')
    frame.width = v.videoWidth; frame.height = v.videoHeight
    frame.getContext('2d')!.drawImage(v, 0, 0)
    let lat: number | null = null, lng: number | null = null, acc: number | null = null
    try {
      const pos = await getPosition()
      lat = pos.coords.latitude; lng = pos.coords.longitude; acc = Math.round(pos.coords.accuracy)
    } catch { /* no GPS */ }
    const capturedAt = new Date()

    // resize to max 1280 on the long edge
    const scale = Math.min(1, 1280 / Math.max(frame.width, frame.height))
    const W = Math.round(frame.width * scale), H = Math.round(frame.height * scale)
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const ctx = c.getContext('2d')!
    ctx.drawImage(frame, 0, 0, W, H)

    // stamp band
    const band = Math.round(Math.max(150, H * 0.2))
    ctx.fillStyle = 'rgba(0,0,0,0.62)'
    ctx.fillRect(0, H - band, W, band)
    const mapSize = band - 20
    const hasMap = lat != null && lng != null ? await drawMiniMap(ctx, lat, lng!, W - mapSize - 10, H - band + 10, mapSize) : false
    const tal = TALUKAS.find(x => x.id === props.taluka)
    const lines = [
      props.facilityName || '—',
      lat != null ? `${lat.toFixed(5)}, ${lng!.toFixed(5)}  (±${acc} m)` : 'GPS not available',
      `${[props.ward, tal ? (i18n.language === 'gu' ? tal.gu : tal.en) : '', props.district ? (i18n.language === 'gu' ? props.district.gu : props.district.en) : ''].filter(Boolean).join(', ')}`,
      `${capturedAt.toLocaleDateString('en-IN')} ${capturedAt.toLocaleTimeString('en-IN')} · ${props.officerName}`,
    ]
    const fs = Math.round(band / 6.2)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'top'
    lines.forEach((ln, i) => {
      ctx.font = `${i === 0 ? 'bold ' : ''}${fs}px Roboto, "Noto Sans Gujarati", sans-serif`
      ctx.fillText(ln, 14, H - band + 12 + i * (fs * 1.35), W - (hasMap ? mapSize + 34 : 28))
    })
    const dataUrl = c.toDataURL('image/jpeg', 0.75)
    const th = document.createElement('canvas')
    const ts = 320 / Math.max(W, H)
    th.width = Math.round(W * ts); th.height = Math.round(H * ts)
    th.getContext('2d')!.drawImage(c, 0, 0, th.width, th.height)
    const thumbUrl = th.toDataURL('image/jpeg', 0.7)

    const hash = await sha256(dataUrl)
    const dist = props.pin && lat != null ? Math.round(haversine(lat, lng!, props.pin.lat, props.pin.lng)) : null
    setPreview({
      id: uid(), caption, dataUrl, thumbUrl, lat, lng, accuracy: acc, capturedAt: capturedAt.toISOString(),
      capturedBy: props.officerId, sha256: hash, distanceFromPin: dist,
      flagFar: dist != null && dist > FAR_FROM_PIN_M, flagDuplicate: props.existingHashes.includes(hash),
      flagPoorGps: acc == null || acc > POOR_GPS_M,
    })
    setBusy(false)
  }

  function close() { setPreview(null); props.onClose() }

  return (
    <Dialog open={props.open} onClose={close} fullScreen PaperProps={{ sx: { bgcolor: '#000', borderRadius: 0 } }}>
      <Stack direction="row" alignItems="center" sx={{ p: 1, color: '#fff' }}>
        <IconButton onClick={close} sx={{ color: '#fff' }}><Icon name="close" /></IconButton>
        <Typography sx={{ flex: 1 }}>{t('cam.title')} · {t(`caption.${caption}`)}</Typography>
      </Stack>
      <Box sx={{ flex: 1, position: 'relative', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {err && <Alert severity="error" sx={{ m: 2 }}>{err}</Alert>}
        {!preview && <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
        {preview && <img src={preview.dataUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
        {!preview && !err && (
          <Alert icon={<Icon name="face_retouching_off" />} severity="info" sx={{ position: 'absolute', top: 8, left: 8, right: 8, opacity: 0.92 }}>{t('wiz.faces')}</Alert>
        )}
      </Box>
      <Box sx={{ p: 2, bgcolor: '#111' }}>
        {!preview && (
          <>
            <Typography variant="caption" sx={{ color: '#ccc' }}>{t('cam.caption')}</Typography>
            <Stack direction="row" gap={1} sx={{ overflowX: 'auto', py: 1 }}>
              {PHOTO_CAPTIONS.map(c => (
                <Chip key={c} label={t(`caption.${c}`)} onClick={() => setCaption(c)} color={c === caption ? 'secondary' : 'default'}
                  sx={{ bgcolor: c === caption ? undefined : '#333', color: '#fff' }} />
              ))}
            </Stack>
            <Stack alignItems="center" sx={{ mt: 1 }}>
              <IconButton onClick={capture} disabled={busy || !!err} aria-label={t('cam.capture')}
                sx={{ width: 76, height: 76, bgcolor: '#fff', '&:hover': { bgcolor: '#eee' } }}>
                {busy ? <CircularProgress size={30} /> : <Icon name="photo_camera" size={36} color="#1B6FB8" fill />}
              </IconButton>
            </Stack>
          </>
        )}
        {preview && (
          <Stack spacing={1.5}>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Chip icon={<Icon name="my_location" size={18} />} sx={{ bgcolor: '#333', color: '#fff' }}
                label={preview.lat != null ? `${t('cam.gps')} ${t('cam.accuracy', { m: preview.accuracy })}` : t('cam.noGps')} />
              {preview.flagPoorGps && <Chip color="warning" icon={<Icon name="gps_off" size={18} />} label={t('cam.gpsFlag')} />}
              {preview.flagFar && <Chip color="warning" icon={<Icon name="wrong_location" size={18} />} label={t('cam.farFlag', { m: preview.distanceFromPin })} />}
              {preview.flagDuplicate && <Chip color="error" icon={<Icon name="content_copy" size={18} />} label={t('cam.dupFlag')} />}
            </Stack>
            {preview.flagPoorGps && <Alert severity="warning">{t('cam.poorGps')}</Alert>}
            <Stack direction="row" gap={1}>
              <Button fullWidth variant="outlined" sx={{ color: '#fff', borderColor: '#666' }} startIcon={<Icon name="replay" />} onClick={() => setPreview(null)}>{t('cam.retake')}</Button>
              <Button fullWidth variant="contained" color="secondary" startIcon={<Icon name="check" />} onClick={() => { props.onSave(preview); setPreview(null); props.onClose() }}>{t('cam.use')}</Button>
            </Stack>
          </Stack>
        )}
      </Box>
    </Dialog>
  )
}
