import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Chip, Container, FormControl, FormControlLabel, IconButton, InputLabel, LinearProgress, MenuItem, Select, Stack, Switch, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon, TopBar, Stars, ScoreBars, ScoreBadge, TagChips, StatusChip, useCurrentUser, BottomBar } from '../components/ui'
import { CameraCapture } from '../components/CameraCapture'
import { MapView } from '../components/MapView'
import { useDb, saveFacility, submitFacility } from '../data/store'
import { AMENITIES, CONDITION_KEYS, DAYS, FACILITY_TYPES, OWNERSHIP, SPORTS, TALUKAS, FAR_FROM_PIN_M, talukasOf, districtOf } from '../lib/constants'
import { computeScore } from '../lib/score'
import { getPosition, haversine, uid } from '../lib/geo'
import { brand } from '../theme'
import type { Facility, Photo, PhotoCaption } from '../lib/types'
import { typeIcon } from './PublicMap'

function blank(userId: string, district: string): Facility {
  const t = new Date().toISOString()
  return {
    id: 'f' + uid(), name: '', type: 'open_ground', ownership: 'municipal', district, taluka: '', ward: '', address: '',
    lat: null, lng: null, gpsLat: null, gpsLng: null, gpsAccuracy: null, sports: [], amenities: [],
    timings: { mon: { open: '06:00', close: '20:00' }, tue: { open: '06:00', close: '20:00' }, wed: { open: '06:00', close: '20:00' }, thu: { open: '06:00', close: '20:00' }, fri: { open: '06:00', close: '20:00' }, sat: { open: '06:00', close: '20:00' }, sun: null },
    feeType: 'free', feeAmount: null, feeUnit: 'per_month', bookingName: '', bookingPhone: '', capacity: null, surface: '',
    coachAvailable: false, coachCount: null, womenOnlySlots: false, paraSports: false, openToSchools: false, condition: {},
    lastMaintenance: '', yearBuilt: null, weeklyUsersEstimate: null, athletesTrainedLastYear: null, cwg: 'none', photos: [],
    status: 'draft', published: null, createdBy: userId, createdAt: t, updatedAt: t, submittedAt: null, approvedAt: null, lastVerifiedAt: null,
  }
}

const REQUIRED: PhotoCaption[][] = [['entrance'], ['playing_area'], ['toilets', 'changing_room']]

export default function DsoWizard() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const db = useDb()
  const user = useCurrentUser()!
  const existing = db.facilities.find(f => f.id === id)
  const [f, setF] = useState<Facility>(() => existing ? structuredClone(existing) : blank(user.id, user.district || 'ahmedabad'))
  const [step, setStep] = useState(0)
  const [cam, setCam] = useState(false)
  const [msg, setMsg] = useState('')
  const chipRow = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = chipRow.current
    const chip = row?.children[step] as HTMLElement | undefined
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
    window.scrollTo(0, 0)
  }, [step])
  const steps = t('wiz.steps', { returnObjects: true }) as string[]
  const set = <K extends keyof Facility>(k: K, v: Facility[K]) => setF(prev => ({ ...prev, [k]: v }))
  const score = useMemo(() => computeScore(f, db.checkins), [f, db.checkins])
  const rv = [...db.reviews].reverse().find(r => r.facilityId === f.id)
  const lastReturned = f.status === 'returned' && rv?.action === 'returned' ? rv : null

  const missingPhotos = REQUIRED.filter(group => !f.photos.some(p => group.includes(p.caption))).map(g => g.map(c => t(`caption.${c}`)).join(' / '))
  const nextCaption: PhotoCaption = (REQUIRED.find(g => !f.photos.some(p => g.includes(p.caption)))?.[0]) || 'other'

  function missing(): string[] {
    const m: string[] = []
    if (!f.name.trim()) m.push(t('wiz.name'))
    if (!f.taluka) m.push(t('wiz.taluka'))
    if (missingPhotos.length) m.push(t('common.photos'))
    if (f.lat == null) m.push(steps[2])
    if (!f.sports.length) m.push(t('wiz.sports'))
    if (CONDITION_KEYS.some(k => f.condition[k] === undefined)) m.push(steps[5])
    return m
  }

  function addPhoto(p: Photo) {
    setF(prev => {
      const first = prev.lat == null && p.lat != null
      const photos = [...prev.photos, p]
      return {
        ...prev, photos,
        ...(first ? { lat: p.lat, lng: p.lng, gpsLat: p.lat, gpsLng: p.lng, gpsAccuracy: p.accuracy } : {}),
      }
    })
  }

  function movePin(lat: number, lng: number) {
    setF(prev => ({
      ...prev, lat, lng,
      photos: prev.photos.map(p => {
        const d = p.lat != null ? Math.round(haversine(p.lat, p.lng!, lat, lng)) : null
        return { ...p, distanceFromPin: d, flagFar: d != null && d > FAR_FROM_PIN_M }
      }),
    }))
  }

  function save(andSubmit = false) {
    const changed = existing ? (Object.keys(f) as (keyof Facility)[]).filter(k => JSON.stringify(f[k]) !== JSON.stringify(existing[k]) && k !== 'updatedAt') : []
    if (andSubmit) {
      const m = missing()
      if (m.length) { setMsg(t('wiz.missing', { list: m.join(', ') })); window.scrollTo(0, 0); return }
      saveFacility(f, user.id, changed as string[])
      submitFacility(f.id, user.id)
      nav('/dso')
    } else {
      saveFacility(f, user.id, changed as string[])
      if (!existing) nav(`/dso/edit/${f.id}`, { replace: true })
      setMsg(t('wiz.saved'))
    }
  }

  const toggle = (k: 'sports' | 'amenities', v: string) => set(k, f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v])
  const talName = (x: typeof TALUKAS[number]) => (i18n.language === 'gu' ? x.gu : x.en)

  const body = [
    // 1 Basic
    <Stack spacing={2} key="b">
      <TextField label={t('wiz.name')} value={f.name} onChange={e => set('name', e.target.value)} required />
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <FormControl fullWidth><InputLabel>{t('wiz.type')}</InputLabel>
          <Select label={t('wiz.type')} value={f.type} onChange={e => set('type', e.target.value as Facility['type'])}>
            {FACILITY_TYPES.map(x => <MenuItem key={x} value={x}><Icon name={typeIcon(x)} size={20} style={{ marginRight: 8 }} />{t(`type.${x}`)}</MenuItem>)}
          </Select></FormControl>
        <FormControl fullWidth><InputLabel>{t('wiz.ownership')}</InputLabel>
          <Select label={t('wiz.ownership')} value={f.ownership} onChange={e => set('ownership', e.target.value as Facility['ownership'])}>
            {OWNERSHIP.map(x => <MenuItem key={x} value={x}>{t(`own.${x}`)}</MenuItem>)}
          </Select></FormControl>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <FormControl fullWidth required><InputLabel>{t('wiz.taluka')}</InputLabel>
          <Select label={t('wiz.taluka')} value={f.taluka} onChange={e => set('taluka', e.target.value)}>
            {talukasOf(f.district).map(x => <MenuItem key={x.id} value={x.id}>{talName(x)}</MenuItem>)}
          </Select></FormControl>
        <TextField label={t('wiz.ward')} value={f.ward} onChange={e => set('ward', e.target.value)} />
      </Stack>
      <TextField label={t('wiz.address')} value={f.address} onChange={e => set('address', e.target.value)} multiline minRows={2} />
      <FormControl fullWidth><InputLabel>{t('wiz.cwg')}</InputLabel>
        <Select label={t('wiz.cwg')} value={f.cwg} onChange={e => set('cwg', e.target.value as Facility['cwg'])}>
          {(['none', 'venue', 'training'] as const).map(x => <MenuItem key={x} value={x}>{t(`cwg.${x}`)}</MenuItem>)}
        </Select></FormControl>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <TextField label={t('wiz.capacity')} type="number" value={f.capacity ?? ''} onChange={e => set('capacity', e.target.value ? Number(e.target.value) : null)} />
        <TextField label={t('wiz.surface')} value={f.surface} onChange={e => set('surface', e.target.value)} />
        <TextField label={t('wiz.yearBuilt')} type="number" value={f.yearBuilt ?? ''} onChange={e => set('yearBuilt', e.target.value ? Number(e.target.value) : null)} />
      </Stack>
    </Stack>,

    // 2 Photos
    <Stack spacing={2} key="p">
      <Alert severity="info" icon={<Icon name="photo_camera" />}>{t('wiz.photosHint')}</Alert>
      {missingPhotos.length > 0 && <Alert severity="warning">{t('wiz.needPhotos', { list: missingPhotos.join(', ') })}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
        {f.photos.map(p => (
          <Card key={p.id} sx={{ position: 'relative' }}>
            <Box component="img" src={p.thumbUrl} alt="" sx={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
            <IconButton size="small" onClick={() => set('photos', f.photos.filter(x => x.id !== p.id))} sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,.9)', width: 32, height: 32 }}><Icon name="delete" size={18} /></IconButton>
            <Box sx={{ p: 1 }}>
              <Typography variant="body2" fontWeight={500}>{t(`caption.${p.caption}`)}</Typography>
              <Stack direction="row" gap={0.5} flexWrap="wrap">
                {p.flagFar && <Chip size="small" color="warning" label={t('cam.farFlag', { m: p.distanceFromPin })} sx={{ height: 20, fontSize: 11 }} />}
                {p.flagPoorGps && <Chip size="small" color="warning" label={t('cam.gpsFlag')} sx={{ height: 20, fontSize: 11 }} />}
                {p.flagDuplicate && <Chip size="small" color="error" label={t('cam.dupFlag')} sx={{ height: 20, fontSize: 11 }} />}
              </Stack>
            </Box>
          </Card>
        ))}
        <Card sx={{ borderStyle: 'dashed', borderColor: brand.blue }}>
          <Button onClick={() => setCam(true)} sx={{ width: '100%', height: '100%', minHeight: 150, flexDirection: 'column', borderRadius: '16px' }}>
            <Icon name="add_a_photo" size={40} /><Typography sx={{ mt: 1 }}>{t('wiz.takePhoto')}</Typography>
          </Button>
        </Card>
      </Box>
    </Stack>,

    // 3 Location
    <Stack spacing={2} key="l">
      <Alert severity="info" icon={<Icon name="location_on" />}>{t('wiz.locationHint')}</Alert>
      <Box sx={{ height: 380, borderRadius: '16px', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <MapView pins={f.lat != null ? [{ id: 'pin', lat: f.lat, lng: f.lng!, color: brand.orange, icon: typeIcon(f.type) }] : []} draggablePinId="pin"
          onDrag={movePin} onMapClick={(lat, lng) => f.lat == null && movePin(lat, lng)}
          startAt={districtOf(f.district) ? [districtOf(f.district)!.lat, districtOf(f.district)!.lng] : undefined}
          center={f.lat != null ? [f.lat, f.lng!] : undefined}
          extraPins={f.gpsLat != null && (f.gpsLat !== f.lat || f.gpsLng !== f.lng) ? [{ id: 'gps', lat: f.gpsLat, lng: f.gpsLng!, color: '#9E9E9E', icon: 'my_location' }] : []} />
      </Box>
      <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
        <Button variant="outlined" startIcon={<Icon name="my_location" />} onClick={async () => {
          try { const p = await getPosition(); if (f.gpsLat == null) setF(prev => ({ ...prev, gpsLat: p.coords.latitude, gpsLng: p.coords.longitude, gpsAccuracy: Math.round(p.coords.accuracy) })); movePin(p.coords.latitude, p.coords.longitude) } catch { setMsg(t('cam.noGps')) }
        }}>{t('wiz.useMyLocation')}</Button>
        {f.lat != null && <Typography variant="body2" color="text.secondary">{f.lat.toFixed(5)}, {f.lng!.toFixed(5)}</Typography>}
        {f.gpsLat != null && f.lat != null && haversine(f.gpsLat, f.gpsLng!, f.lat, f.lng!) > 5 && (
          <Chip size="small" icon={<Icon name="info" size={16} />} label={t('wiz.pinMoved', { m: Math.round(haversine(f.gpsLat, f.gpsLng!, f.lat, f.lng!)) })} />
        )}
      </Stack>
    </Stack>,

    // 4 Sports & amenities
    <Stack spacing={3} key="s">
      <Box>
        <Typography fontWeight={500} sx={{ mb: 1 }}>{t('wiz.sports')}</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {SPORTS.map(s => <Chip key={s} label={t(`sport.${s}`)} onClick={() => toggle('sports', s)} color={f.sports.includes(s) ? 'primary' : 'default'} variant={f.sports.includes(s) ? 'filled' : 'outlined'} icon={f.sports.includes(s) ? <Icon name="check" size={18} color="#fff" /> : undefined} sx={{ height: 40 }} />)}
        </Stack>
      </Box>
      <Box>
        <Typography fontWeight={500} sx={{ mb: 1 }}>{t('wiz.amenities')}</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {AMENITIES.map(s => <Chip key={s} label={t(`amenity.${s}`)} onClick={() => toggle('amenities', s)} color={f.amenities.includes(s) ? 'primary' : 'default'} variant={f.amenities.includes(s) ? 'filled' : 'outlined'} icon={f.amenities.includes(s) ? <Icon name="check" size={18} color="#fff" /> : undefined} sx={{ height: 40 }} />)}
        </Stack>
      </Box>
      <Card><CardContent>
        <Stack>
          <FormControlLabel control={<Switch checked={f.coachAvailable} onChange={e => set('coachAvailable', e.target.checked)} />} label={t('wiz.coach')} />
          {f.coachAvailable && <TextField sx={{ my: 1, maxWidth: 240 }} size="small" type="number" label={t('wiz.coachCount')} value={f.coachCount ?? ''} onChange={e => set('coachCount', e.target.value ? Number(e.target.value) : null)} />}
          <FormControlLabel control={<Switch checked={f.womenOnlySlots} onChange={e => set('womenOnlySlots', e.target.checked)} />} label={t('wiz.womenSlots')} />
          <FormControlLabel control={<Switch checked={f.paraSports} onChange={e => set('paraSports', e.target.checked)} />} label={t('wiz.para')} />
          <FormControlLabel control={<Switch checked={f.openToSchools} onChange={e => set('openToSchools', e.target.checked)} />} label={t('wiz.schools')} />
        </Stack>
      </CardContent></Card>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <TextField label={t('wiz.weeklyUsers')} type="number" value={f.weeklyUsersEstimate ?? ''} onChange={e => set('weeklyUsersEstimate', e.target.value ? Number(e.target.value) : null)} />
        <TextField label={t('wiz.athletes')} type="number" value={f.athletesTrainedLastYear ?? ''} onChange={e => set('athletesTrainedLastYear', e.target.value ? Number(e.target.value) : null)} />
      </Stack>
    </Stack>,

    // 5 Timings & fees
    <Stack spacing={2} key="t">
      <Typography fontWeight={500}>{t('wiz.timings')}</Typography>
      <Card><CardContent sx={{ px: { xs: 1, sm: 2 } }}>
        {DAYS.map(d => {
          const v = f.timings[d]
          return (
            <Stack key={d} direction="row" alignItems="center" gap={{ xs: 0.75, sm: 1.5 }} sx={{ py: 0.75 }}>
              <Typography sx={{ width: { xs: 36, sm: 48 }, flexShrink: 0 }}>{t(`day.${d}`)}</Typography>
              <Switch sx={{ flexShrink: 0 }} checked={!!v} onChange={e => set('timings', { ...f.timings, [d]: e.target.checked ? { open: '06:00', close: '20:00' } : null })} />
              {v ? (
                <>
                  <TextField size="small" type="time" value={v.open} onChange={e => set('timings', { ...f.timings, [d]: { ...v, open: e.target.value } })} sx={{ flex: 1, minWidth: 0, maxWidth: 140 }} inputProps={{ style: { paddingLeft: 8, paddingRight: 4 } }} />
                  <Typography>–</Typography>
                  <TextField size="small" type="time" value={v.close} onChange={e => set('timings', { ...f.timings, [d]: { ...v, close: e.target.value } })} sx={{ flex: 1, minWidth: 0, maxWidth: 140 }} inputProps={{ style: { paddingLeft: 8, paddingRight: 4 } }} />
                </>
              ) : <Typography color="text.secondary">{t('wiz.closed')}</Typography>}
            </Stack>
          )
        })}
      </CardContent></Card>
      <Typography fontWeight={500}>{t('wiz.fee')}</Typography>
      <Stack direction="row" gap={1}>
        {(['free', 'subsidised', 'paid'] as const).map(x => <Chip key={x} label={t(`fee.${x}`)} onClick={() => set('feeType', x)} color={f.feeType === x ? 'primary' : 'default'} variant={f.feeType === x ? 'filled' : 'outlined'} sx={{ height: 40 }} />)}
      </Stack>
      {f.feeType !== 'free' && (
        <Stack direction="row" gap={2}>
          <TextField label={t('wiz.feeAmount')} type="number" value={f.feeAmount ?? ''} onChange={e => set('feeAmount', e.target.value ? Number(e.target.value) : null)} />
          <FormControl fullWidth><InputLabel>{t('wiz.feeUnit')}</InputLabel>
            <Select label={t('wiz.feeUnit')} value={f.feeUnit} onChange={e => set('feeUnit', e.target.value as Facility['feeUnit'])}>
              {(['per_hour', 'per_month', 'per_year'] as const).map(x => <MenuItem key={x} value={x}>{t(`fee.${x}`)}</MenuItem>)}
            </Select></FormControl>
        </Stack>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <TextField label={t('wiz.bookingName')} value={f.bookingName} onChange={e => set('bookingName', e.target.value)} />
        <TextField label={t('wiz.bookingPhone')} value={f.bookingPhone} inputMode="tel" onChange={e => set('bookingPhone', e.target.value.replace(/[^\d]/g, '').slice(0, 11))} />
      </Stack>
    </Stack>,

    // 6 Condition
    <Stack spacing={1.5} key="c">
      <Typography color="text.secondary">{t('wiz.condition')}</Typography>
      {CONDITION_KEYS.map(k => (
        <Card key={k}><CardContent sx={{ py: 1.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1}>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={500}>{t(`cond.${k}`)}</Typography>
              <Typography variant="caption" color="text.secondary">{t(`condHint.${k}`)}</Typography>
            </Box>
            <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={0.5}>
              <Box sx={{ opacity: f.condition[k] === 0 ? 0.35 : 1, pointerEvents: f.condition[k] === 0 ? 'none' : 'auto' }}>
                <Stars value={f.condition[k] || 0} onChange={v => set('condition', { ...f.condition, [k]: v })} size="large" />
              </Box>
              <Chip size="small" label={t('common.notAvailable')} icon={<Icon name={f.condition[k] === 0 ? 'check' : 'block'} size={16} />}
                color={f.condition[k] === 0 ? 'primary' : 'default'} variant={f.condition[k] === 0 ? 'filled' : 'outlined'}
                onClick={() => set('condition', { ...f.condition, [k]: f.condition[k] === 0 ? undefined : 0 })} />
            </Stack>
          </Stack>
        </CardContent></Card>
      ))}
      <TextField label={t('wiz.lastMaintenance')} type="date" value={f.lastMaintenance} onChange={e => set('lastMaintenance', e.target.value)} InputLabelProps={{ shrink: true }} sx={{ maxWidth: 260 }} />
    </Stack>,

    // 7 Review
    <Stack spacing={2} key="r">
      <Card><CardContent>
        <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 2 }}>
          <ScoreBadge r={score} size={64} />
          <Box><Typography variant="h4">{t('wiz.scorePreview')}</Typography><TagChips r={score} /></Box>
        </Stack>
        <ScoreBars r={score} />
      </CardContent></Card>
      {missing().length > 0 && <Alert severity="warning">{t('wiz.missing', { list: missing().join(', ') })}</Alert>}
      <Card><CardContent>
        <Typography variant="h4">{f.name || '—'}</Typography>
        <Typography variant="body2" color="text.secondary">{t(`type.${f.type}`)} · {t(`own.${f.ownership}`)} · {TALUKAS.find(x => x.id === f.taluka) ? talName(TALUKAS.find(x => x.id === f.taluka)!) : '—'}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>{f.photos.length} {t('common.photos')} · {f.sports.map(s => t(`sport.${s}`)).join(', ') || '—'}</Typography>
      </CardContent></Card>
    </Stack>,
  ]

  return (
    <>
      <TopBar back="/dso" title={existing ? f.name || t('dso.add') : t('dso.add')} actions={existing ? <Box sx={{ display: { xs: 'none', sm: 'block' } }}><StatusChip status={f.status} /></Box> : undefined} />
      <LinearProgress variant="determinate" value={((step + 1) / steps.length) * 100} sx={{ height: 4 }} />
      <Container maxWidth="md" sx={{ py: 2, pb: 14, px: { xs: 1.5, sm: 3 } }}>
        <Stack ref={chipRow} direction="row" gap={0.75} sx={{ overflowX: 'auto', pb: 1.5 }}>
          {steps.map((s, i) => (
            <Chip key={s} label={`${i + 1}. ${s}`} onClick={() => setStep(i)} color={i === step ? 'primary' : 'default'} variant={i === step ? 'filled' : 'outlined'} sx={{ flexShrink: 0 }} />
          ))}
        </Stack>
        {lastReturned && <Alert severity="warning" icon={<Icon name="comment" />} sx={{ mb: 2 }}><b>{t('dso.stateComment')}:</b> {lastReturned.comment}</Alert>}
        {msg && <Alert severity={msg === t('wiz.saved') ? 'success' : 'warning'} onClose={() => setMsg('')} sx={{ mb: 2 }}>{msg}</Alert>}
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
          <Typography variant="h3" sx={{ flex: 1 }}>{steps[step]} <Typography component="span" variant="body2" color="text.secondary">· {step + 1}/{steps.length}</Typography></Typography>
          {existing && <Box sx={{ display: { xs: 'block', sm: 'none' } }}><StatusChip status={f.status} /></Box>}
        </Stack>
        {body[step]}
      </Container>

      <BottomBar>
        <Stack direction="row" gap={1} alignItems="center">
          <IconButton disabled={step === 0} onClick={() => setStep(step - 1)} aria-label={t('common.back')} sx={{ border: '1px solid', borderColor: 'divider', flexShrink: 0 }}><Icon name="arrow_back" /></IconButton>
          <Button variant="outlined" onClick={() => save(false)} startIcon={<Icon name="save" />} sx={{ flex: 1, px: 1 }}>{t('common.saveDraft')}</Button>
          {step < steps.length - 1
            ? <Button variant="contained" onClick={() => setStep(step + 1)} endIcon={<Icon name="arrow_forward" />} sx={{ flex: 1, px: 1 }}>{t('common.next')}</Button>
            : <Button variant="contained" color="secondary" onClick={() => save(true)} endIcon={<Icon name="send" />} sx={{ flex: 1.4, px: 1 }}>{t('common.submit')}</Button>}
        </Stack>
      </BottomBar>

      <CameraCapture open={cam} onClose={() => setCam(false)} onSave={addPhoto} facilityName={f.name} officerName={user.fullName} officerId={user.id}
        taluka={f.taluka} ward={f.ward} district={districtOf(f.district)} pin={f.lat != null ? { lat: f.lat, lng: f.lng! } : null}
        existingHashes={db.facilities.flatMap(x => x.photos.map(p => p.sha256)).concat(f.photos.map(p => p.sha256))} defaultCaption={nextCaption} />
    </>
  )
}
