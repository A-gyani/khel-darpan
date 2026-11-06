import { useMemo, useState } from 'react'
import { Box, Button, Card, CardActionArea, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputBase, InputLabel, MenuItem, Paper, Select, Stack, ToggleButton, ToggleButtonGroup, Typography, IconButton } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, Stars, DemoBadge, useCurrentUser, LangButton } from '../components/ui'
import { home } from '../lib/routes'
import { MapView } from '../components/MapView'
import { useDb, publicFacilities, avgRating } from '../data/store'
import { FACILITY_TYPES, SPORTS, TALUKAS } from '../lib/constants'
import { getPosition, haversine, isOpenNow } from '../lib/geo'
import { brand } from '../theme'
import type { Facility } from '../lib/types'

const TYPE_ICON: Record<string, string> = {
  stadium: 'stadium', sports_complex: 'sports', indoor_hall: 'sports_tennis', open_ground: 'sports_cricket', swimming_pool: 'pool',
  court: 'sports_basketball', gym: 'fitness_center', akhada: 'sports_kabaddi', school_ground: 'school', other: 'sports',
}
export const typeIcon = (t: string) => TYPE_ICON[t] || 'sports'

interface Filters { sport: string; type: string; taluka: string; fee: string; women: boolean; accessible: boolean; openNow: boolean }
const EMPTY: Filters = { sport: '', type: '', taluka: '', fee: '', women: false, accessible: false, openNow: false }

export function isWomenFriendly(f: Facility) { return f.amenities.includes('toilets_women') && f.amenities.includes('changing_room_women') }
export function isAccessible(f: Facility) { return f.amenities.includes('ramp_access') || f.amenities.includes('accessible_toilet') }

export default function PublicMap() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const db = useDb()
  const user = useCurrentUser()
  const [q, setQ] = useState('')
  const [f, setF] = useState<Filters>(EMPTY)
  const [draft, setDraft] = useState<Filters>(EMPTY)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [sel, setSel] = useState<string | null>(null)
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null)

  const all = publicFacilities(db)
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let r = all.filter(x => {
      if (ql) {
        const tal = TALUKAS.find(tt => tt.id === x.taluka)
        const hay = [x.name, x.ward, tal?.en, tal?.gu, ...x.sports.map(s => t(`sport.${s}`) as string), ...x.sports].join(' ').toLowerCase()
        if (!hay.includes(ql)) return false
      }
      if (f.sport && !x.sports.includes(f.sport)) return false
      if (f.type && x.type !== f.type) return false
      if (f.taluka && x.taluka !== f.taluka) return false
      if (f.fee && x.feeType !== f.fee) return false
      if (f.women && !isWomenFriendly(x)) return false
      if (f.accessible && !isAccessible(x)) return false
      if (f.openNow && !isOpenNow(x.timings)) return false
      return true
    })
    if (me) r = [...r].sort((a, b) => haversine(me.lat, me.lng, a.lat!, a.lng!) - haversine(me.lat, me.lng, b.lat!, b.lng!))
    return r
  }, [all, q, f, me, i18n.language]) // eslint-disable-line

  const activeCount = Object.values(f).filter(Boolean).length
  const selected = list.find(x => x.id === sel)

  async function locate() {
    try { const p = await getPosition(); setMe({ lat: p.coords.latitude, lng: p.coords.longitude }) } catch { /* denied */ }
  }

  const quickChip = (key: 'women' | 'accessible' | 'openNow', label: string, icon: string) => (
    <Chip icon={<Icon name={icon} size={18} />} label={label} onClick={() => setF({ ...f, [key]: !f[key] })}
      color={f[key] ? 'primary' : 'default'} variant={f[key] ? 'filled' : 'outlined'} sx={{ bgcolor: f[key] ? undefined : '#fff', flexShrink: 0 }} />
  )

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* header: brand + language + official login, then search, then filter chips */}
      <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 'calc(8px + env(safe-area-inset-top))', pb: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', zIndex: 1100 }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
          <Box component="img" src="./brand/sag-logo.png" alt="Sports Authority of Gujarat" sx={{ height: { xs: 34, sm: 40 }, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: { xs: '0.98rem', sm: '1.15rem' }, fontWeight: 700, lineHeight: 1.15, color: 'primary.dark' }}>{t('app.name')}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ lineHeight: 1.2, display: { xs: 'none', sm: 'block' } }}>{t('app.tagline')}</Typography>
          </Box>
          <LangButton />
          {user ? (
            <Button size="small" variant="contained" onClick={() => nav(home(user.role))} startIcon={<Icon name="dashboard" size={20} />} sx={{ flexShrink: 0, px: 1.5, minHeight: 40 }}>
              {t('public.myDashboard')}
            </Button>
          ) : (
            <Button size="small" variant="outlined" onClick={() => nav('/login')} startIcon={<Icon name="badge" size={20} />} sx={{ flexShrink: 0, px: 1.5, minHeight: 40 }}>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{t('public.officialLogin')}</Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{t('public.officials')}</Box>
            </Button>
          )}
        </Stack>
        <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'center', px: 1.5, borderRadius: 100, height: 48, bgcolor: '#F1F4F9', border: 'none' }}>
          <Icon name="search" color="#5B6B7E" />
          <InputBase sx={{ ml: 1, flex: 1, fontSize: 16 }} placeholder={t('public.searchPh') as string} value={q} onChange={e => setQ(e.target.value)} inputProps={{ enterKeyHint: 'search' }} />
          {q && <IconButton size="small" onClick={() => setQ('')} aria-label={t('common.clear')}><Icon name="close" /></IconButton>}
        </Paper>
        <Stack direction="row" gap={1} sx={{ mt: 1, overflowX: 'auto', pb: 0.5, mx: { xs: -1.5, sm: 0 }, px: { xs: 1.5, sm: 0 }, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          <Chip icon={<Icon name="tune" size={18} />} label={`${t('common.filters')}${activeCount ? ` · ${activeCount}` : ''}`} onClick={() => { setDraft(f); setOpen(true) }}
            color={activeCount ? 'secondary' : 'default'} sx={{ flexShrink: 0 }} />
          {quickChip('openNow', t('public.openNow'), 'schedule')}
          {quickChip('women', t('public.womenFriendly'), 'woman')}
          {quickChip('accessible', t('public.accessible'), 'accessible')}
          <Chip icon={<Icon name="near_me" size={18} />} label={t('public.nearest')} onClick={locate} color={me ? 'primary' : 'default'} variant={me ? 'filled' : 'outlined'} sx={{ bgcolor: me ? undefined : '#fff', flexShrink: 0 }} />
        </Stack>
      </Box>

      <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {view === 'map' ? (
          <MapView pins={list.map(x => ({ id: x.id, lat: x.lat!, lng: x.lng!, color: x.id === sel ? brand.orange : brand.blue, icon: typeIcon(x.type), label: x.name }))}
            onPinClick={setSel}
            extraPins={me ? [{ id: 'me', lat: me.lat, lng: me.lng, color: '#1A73E8', icon: 'person' }] : []} />
        ) : (
          <Box sx={{ height: '100%', overflowY: 'auto', p: 1.5, pt: 8, pb: 'calc(16px + env(safe-area-inset-bottom))' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('public.results', { count: list.length })}{!me && ` · ${t('public.allowLocation')}`}</Typography>
            {list.length === 0 && <Typography sx={{ p: 4, textAlign: 'center' }} color="text.secondary">{t('public.noResults')}</Typography>}
            <Stack spacing={1.5}>{list.map(x => <FacilityCard key={x.id} f={x} me={me} onClick={() => nav(`/f/${x.id}`)} />)}</Stack>
          </Box>
        )}

        <ToggleButtonGroup exclusive value={view} onChange={(_, v) => v && setView(v)} size="small"
          sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, bgcolor: '#fff', borderRadius: 100, boxShadow: 2, '& .MuiToggleButton-root': { border: 'none', px: 2, borderRadius: '100px !important' } }}>
          <ToggleButton value="map"><Icon name="map" size={20} />&nbsp;{t('common.map')}</ToggleButton>
          <ToggleButton value="list"><Icon name="list" size={20} />&nbsp;{t('common.list')}</ToggleButton>
        </ToggleButtonGroup>

        {view === 'map' && selected && (
          <Box sx={{ position: 'absolute', left: 8, right: 8, bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 1000, maxWidth: 520, mx: 'auto' }}>
            <FacilityCard f={selected} me={me} onClick={() => nav(`/f/${selected.id}`)} onClose={() => setSel(null)} elevated />
          </Box>
        )}
        {view === 'map' && !selected && (
          <Chip label={t('public.results', { count: list.length })} sx={{ position: 'absolute', left: 12, bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 1000, bgcolor: '#fff', boxShadow: 2 }} />
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('common.filters')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {([
              ['sport', t('public.sport'), SPORTS.map(s => [s, t(`sport.${s}`)])],
              ['type', t('public.type'), FACILITY_TYPES.map(s => [s, t(`type.${s}`)])],
              ['taluka', t('public.taluka'), TALUKAS.map(s => [s.id, i18n.language === 'gu' ? s.gu : s.en])],
              ['fee', t('public.fee'), ['free', 'subsidised', 'paid'].map(s => [s, t(`fee.${s}`)])],
            ] as [keyof Filters, string, string[][]][]).map(([key, label, opts]) => (
              <FormControl key={key} fullWidth>
                <InputLabel>{label}</InputLabel>
                <Select label={label} value={draft[key] as string} onChange={e => setDraft({ ...draft, [key]: e.target.value })}>
                  <MenuItem value="">{t('common.all')}</MenuItem>
                  {opts.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                </Select>
              </FormControl>
            ))}
            <Stack direction="row" gap={1} flexWrap="wrap">
              {(['openNow', 'women', 'accessible'] as const).map(k => (
                <Chip key={k} label={t(k === 'openNow' ? 'public.openNow' : k === 'women' ? 'public.womenFriendly' : 'public.accessible')}
                  color={draft[k] ? 'primary' : 'default'} onClick={() => setDraft({ ...draft, [k]: !draft[k] })} />
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setF(EMPTY); setOpen(false) }}>{t('common.clear')}</Button>
          <Button variant="contained" onClick={() => { setF(draft); setOpen(false) }}>{t('common.apply')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function FacilityCard({ f, me, onClick, onClose, elevated }: { f: Facility; me: { lat: number; lng: number } | null; onClick: () => void; onClose?: () => void; elevated?: boolean }) {
  const { t, i18n } = useTranslation()
  const db = useDb()
  const r = avgRating(db, f.id)
  const tal = TALUKAS.find(x => x.id === f.taluka)
  const dist = me && f.lat != null ? haversine(me.lat, me.lng, f.lat, f.lng!) : null
  const open = isOpenNow(f.timings)
  return (
    <Card sx={{ boxShadow: elevated ? 6 : 0, position: 'relative' }}>
      {onClose && <IconButton size="small" onClick={onClose} sx={{ position: 'absolute', right: 4, top: 4, zIndex: 2 }}><Icon name="close" size={20} /></IconButton>}
      <CardActionArea onClick={onClick} sx={{ display: 'flex', alignItems: 'stretch', justifyContent: 'flex-start' }}>
        <Box component="img" src={f.photos[1]?.thumbUrl || f.photos[0]?.thumbUrl} alt="" sx={{ width: { xs: 92, sm: 112 }, minHeight: 104, objectFit: 'cover', flexShrink: 0, bgcolor: '#E3ECF6' }} />
        <Box sx={{ p: 1.5, flex: 1, minWidth: 0, pr: 4 }}>
          <Typography fontWeight={500} sx={{ lineHeight: 1.25 }}>{f.name}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {t(`type.${f.type}`)} · {f.ward}{tal ? `, ${i18n.language === 'gu' ? tal.gu : tal.en}` : ''}{dist != null ? ` · ${(dist / 1000).toFixed(1)} ${t('common.km')}` : ''}
          </Typography>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
            {r ? <><Stars value={r.avg} size="small" /><Typography variant="caption">({r.count})</Typography></> : <Typography variant="caption" color="text.secondary">{t('public.noRatings')}</Typography>}
          </Stack>
          <Stack direction="row" gap={0.5} sx={{ mt: 0.75 }} flexWrap="wrap">
            <Chip size="small" label={open ? t('public.openNow') : t('public.closed')} sx={{ height: 22, bgcolor: open ? '#DCF2E1' : '#ECEFF3', color: open ? '#1D6B33' : '#43474E' }} />
            <Chip size="small" label={t(`fee.${f.feeType}`)} sx={{ height: 22 }} />
            {f.cwg !== 'none' && <Chip size="small" label="CWG 2030" sx={{ height: 22, bgcolor: '#FFE7CC', color: '#8A4B00' }} />}
            {f.demo && <DemoBadge />}
          </Stack>
        </Box>
      </CardActionArea>
    </Card>
  )
}
