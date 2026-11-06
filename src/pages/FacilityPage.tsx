import { Alert, Box, Button, Card, CardContent, Chip, Container, Stack, Typography, Dialog } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon, TopBar, Stars, DemoBadge, Section, NotFound } from '../components/ui'
import { useDb, publicFacilities, avgRating } from '../data/store'
import { DAYS, TALUKAS } from '../lib/constants'
import { directionsUrl } from '../lib/geo'
import type { Facility } from '../lib/types'
import { dayTimingText } from '../components/review'

export function PhotoStrip({ f, flags }: { f: Facility; flags?: boolean }) {
  const { t } = useTranslation()
  const [big, setBig] = useState<string | null>(null)
  return (
    <>
      <Stack direction="row" gap={1} sx={{ overflowX: 'auto', pb: 1 }}>
        {f.photos.map(p => (
          <Box key={p.id} sx={{ position: 'relative', flexShrink: 0, cursor: 'zoom-in' }} onClick={() => setBig(p.dataUrl)}>
            <Box component="img" src={p.thumbUrl} alt={t(`caption.${p.caption}`) as string} sx={{ width: 200, height: 140, objectFit: 'cover', borderRadius: '12px', display: 'block' }} />
            <Chip size="small" label={t(`caption.${p.caption}`)} sx={{ position: 'absolute', left: 6, bottom: 6, height: 22, bgcolor: 'rgba(0,0,0,.6)', color: '#fff' }} />
            {flags && (p.flagFar || p.flagDuplicate || p.flagPoorGps) && (
              <Stack gap={0.5} sx={{ position: 'absolute', right: 6, top: 6 }}>
                {p.flagFar && <Chip size="small" color="warning" icon={<Icon name="wrong_location" size={16} />} label={t('cam.farFlag', { m: p.distanceFromPin })} sx={{ height: 22 }} />}
                {p.flagDuplicate && <Chip size="small" color="error" icon={<Icon name="content_copy" size={16} />} label={t('cam.dupFlag')} sx={{ height: 22 }} />}
                {p.flagPoorGps && <Chip size="small" color="warning" icon={<Icon name="gps_off" size={16} />} label={t('cam.gpsFlag')} sx={{ height: 22 }} />}
              </Stack>
            )}
          </Box>
        ))}
      </Stack>
      <Dialog open={!!big} onClose={() => setBig(null)} maxWidth="lg">
        {big && <Box component="img" src={big} alt="" sx={{ maxWidth: '100%', display: 'block' }} onClick={() => setBig(null)} />}
      </Dialog>
    </>
  )
}

export function FacilityDetails({ f }: { f: Facility }) {
  const { t, i18n } = useTranslation()
  const tal = TALUKAS.find(x => x.id === f.taluka)
  const flag = (on: boolean, label: string, icon: string) => (
    <Chip icon={<Icon name={on ? icon : 'close'} size={18} />} label={label} variant="outlined" sx={{ opacity: on ? 1 : 0.5, textDecoration: on ? 'none' : 'line-through' }} />
  )
  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        <Icon name="location_on" size={18} /> {f.address}{tal ? ` · ${i18n.language === 'gu' ? tal.gu : tal.en}` : ''}
      </Typography>
      <Section title={t('public.sports')} icon="sports">
        <Stack direction="row" gap={1} flexWrap="wrap">{f.sports.map(s => <Chip key={s} label={t(`sport.${s}`)} color="primary" variant="outlined" />)}</Stack>
      </Section>
      <Section title={t('public.amenities')} icon="checklist">
        <Stack direction="row" gap={1} flexWrap="wrap">
          {f.amenities.map(a => <Chip key={a} icon={<Icon name="check" size={18} />} label={t(`amenity.${a}`)} />)}
        </Stack>
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
          {flag(f.coachAvailable, t('public.coach'), 'sports_handball')}
          {flag(f.womenOnlySlots, t('public.womenSlots'), 'woman')}
          {flag(f.paraSports, t('public.para'), 'accessible_forward')}
          {flag(f.openToSchools, t('public.schools'), 'school')}
        </Stack>
      </Section>
      <Section title={t('public.timings')} icon="schedule">
        <Card><CardContent sx={{ py: 1 }}>
          {DAYS.map(d => (
            <Stack key={d} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
              <Typography variant="body2">{t(`day.${d}`)}</Typography>
              <Typography variant="body2" color={f.timings[d] ? 'text.primary' : 'text.secondary'}>{dayTimingText(f.timings[d], t('public.closed'))}</Typography>
            </Stack>
          ))}
        </CardContent></Card>
      </Section>
      <Section title={t('public.fee')} icon="payments">
        <Typography>{t(`fee.${f.feeType}`)}{f.feeAmount ? ` · ₹${f.feeAmount} ${t(`fee.${f.feeUnit}`)}` : ''}</Typography>
        {f.capacity && <Typography variant="body2" color="text.secondary">{t('public.capacity')}: {f.capacity}</Typography>}
      </Section>
    </>
  )
}

export default function FacilityPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const nav = useNavigate()
  const db = useDb()
  const raw = db.facilities.find(x => x.id === id)
  const f = publicFacilities(db).find(x => x.id === id)
  if (!f) return <NotFound />
  const r = avgRating(db, f.id)

  return (
    <>
      <TopBar back="/map" title={f.name} />
      <Container maxWidth="md" sx={{ py: 2, pb: 12 }}>
        {raw && raw.status !== 'approved' && <Alert severity="info" sx={{ mb: 2 }}>{t('public.underReview')}</Alert>}
        <PhotoStrip f={f} />
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ my: 1 }}>
          <Typography variant="h2" sx={{ flex: '1 1 auto' }}>{f.name}</Typography>
          {f.demo && <DemoBadge />}
        </Stack>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
          {r ? <><Stars value={r.avg} /><Typography>{r.avg.toFixed(1)} · {t('public.ratings', { count: r.count })}</Typography></> : <Typography color="text.secondary">{t('public.noRatings')}</Typography>}
        </Stack>
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
          <Chip label={t(`type.${f.type}`)} />
          <Chip label={t(`own.${f.ownership}`)} />
          {f.cwg !== 'none' && <Chip icon={<Icon name="emoji_events" size={18} />} label={t(`cwg.${f.cwg}`)} sx={{ bgcolor: '#FFE7CC', color: '#8A4B00' }} />}
        </Stack>

        <Stack direction="row" gap={1} sx={{ mb: 3 }} flexWrap="wrap">
          <Button variant="contained" startIcon={<Icon name="directions" />} href={directionsUrl(f.lat!, f.lng!)} target="_blank">{t('common.directions')}</Button>
          {f.bookingPhone && <Button variant="outlined" startIcon={<Icon name="call" />} href={`tel:${f.bookingPhone}`}>{t('common.call')}</Button>}
        </Stack>

        <Card sx={{ mb: 3, bgcolor: '#FFF6EC', borderColor: '#FFD9B0' }}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <Button fullWidth variant="contained" color="secondary" startIcon={<Icon name="how_to_reg" />} onClick={() => nav(`/q/${f.id}/checkin`)}>{t('qr.checkIn')}</Button>
              <Button fullWidth variant="outlined" color="secondary" startIcon={<Icon name="report" />} onClick={() => nav(`/q/${f.id}/report`)}>{t('qr.report')}</Button>
              <Button fullWidth variant="outlined" color="secondary" startIcon={<Icon name="star" />} onClick={() => nav(`/q/${f.id}/rate`)}>{t('qr.rate')}</Button>
            </Stack>
          </CardContent>
        </Card>

        <FacilityDetails f={f} />
      </Container>
    </>
  )
}
