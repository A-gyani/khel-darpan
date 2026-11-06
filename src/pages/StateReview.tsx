import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Chip, Container, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon, TopBar, ScoreBars, ScoreBadge, StatusChip, TagChips, Stars, useCurrentUser, Section, BottomBar } from '../components/ui'
import { MapView } from '../components/MapView'
import { useDb, reviewFacility, avgRating } from '../data/store'
import { computeScore } from '../lib/score'
import { CONDITION_KEYS } from '../lib/constants'
import { PhotoStrip, FacilityDetails } from './FacilityPage'
import { brand } from '../theme'
import { typeIcon } from './PublicMap'

export default function StateReview() {
  const { id } = useParams()
  const { t } = useTranslation()
  const nav = useNavigate()
  const db = useDb()
  const user = useCurrentUser()!
  const [tab, setTab] = useState(0)
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')
  const f = db.facilities.find(x => x.id === id)
  if (!f) return null
  const r = computeScore(f, db.checkins)
  const rating = avgRating(db, f.id)
  const flags = f.photos.filter(p => p.flagFar || p.flagDuplicate || p.flagPoorGps)
  const history = [
    ...db.audit.filter(a => a.facilityId === f.id).map(a => ({ at: a.at, who: a.actor, what: a.action, detail: a.detail })),
    ...db.reviews.filter(x => x.facilityId === f.id && !db.audit.some(a => a.facilityId === f.id && a.action === x.action && a.at === x.at)).map(x => ({ at: x.at, who: x.by, what: x.action, detail: x.comment })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  const userName = (uid: string) => db.users.find(u => u.id === uid)?.fullName || uid

  function act(action: 'approved' | 'returned' | 'rejected') {
    if (action !== 'approved' && !comment.trim()) return setErr(t('state.commentReq'))
    reviewFacility(f!.id, user.id, action, comment.trim())
    nav('/state')
  }

  return (
    <>
      <TopBar back="/state" title={f.name} actions={<Box sx={{ display: { xs: 'none', sm: 'block' } }}><StatusChip status={f.status} /></Box>} />
      <Container maxWidth="lg" sx={{ py: 2, pb: f.status === 'submitted' ? 24 : 6, px: { xs: 1.5, sm: 3 } }}>
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, mb: 1 }}><StatusChip status={f.status} /></Box>
        <PhotoStrip f={f} flags />
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab icon={<Icon name="info" />} iconPosition="start" label={t('common.details')} />
          <Tab icon={<Icon name="history" />} iconPosition="start" label={t('common.history')} />
        </Tabs>

        {tab === 0 && (
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Section title={t('state.flags')} icon="flag">
                {flags.length === 0 ? <Alert severity="success">{t('state.noFlags')}</Alert> : (
                  <Stack spacing={1}>
                    {flags.map(p => (
                      <Alert key={p.id} severity="warning" icon={<Icon name="flag" />}>
                        {t(`caption.${p.caption}`)}: {[p.flagFar && t('cam.farFlag', { m: p.distanceFromPin }), p.flagPoorGps && t('cam.gpsFlag'), p.flagDuplicate && t('cam.dupFlag')].filter(Boolean).join(' · ')}
                      </Alert>
                    ))}
                  </Stack>
                )}
              </Section>
              <Section title={t('common.map')} icon="map">
                <Box sx={{ height: 260, borderRadius: '16px', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                  <MapView pins={[{ id: 'pin', lat: f.lat!, lng: f.lng!, color: brand.orange, icon: typeIcon(f.type), label: f.name }]} center={[f.lat!, f.lng!]}
                    extraPins={f.photos.filter(p => p.lat != null).map(p => ({ id: p.id, lat: p.lat!, lng: p.lng!, color: p.flagFar ? '#C62828' : '#607D8B', icon: 'photo_camera', label: p.caption }))} />
                </Box>
              </Section>
              <FacilityDetails f={f} />
              <Section title={(t('wiz.steps', { returnObjects: true }) as string[])[5]} icon="star_rate">
                <Card><CardContent>
                  {CONDITION_KEYS.map(k => (
                    <Stack key={k} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.25 }}>
                      <Typography variant="body2">{t(`cond.${k}`)}</Typography><Stars value={f.condition[k] || 0} size="small" />
                    </Stack>
                  ))}
                  {f.lastMaintenance && <Typography variant="caption" color="text.secondary">{t('wiz.lastMaintenance')}: {f.lastMaintenance}</Typography>}
                </CardContent></Card>
              </Section>
            </Box>
            <Box sx={{ width: { xs: '100%', md: 360 }, position: { md: 'sticky' }, top: 80 }}>
              <Card sx={{ mb: 2 }}><CardContent>
                <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 2 }}>
                  <ScoreBadge r={r} size={64} />
                  <Box><Typography variant="h4">Facility Health Score</Typography><TagChips r={r} /></Box>
                </Stack>
                <ScoreBars r={r} />
              </CardContent></Card>
              <Card sx={{ mb: 2 }}><CardContent>
                <Typography variant="h4" sx={{ mb: 1 }}>{t('state.rating')}</Typography>
                {rating ? <Stack direction="row" gap={1} alignItems="center"><Stars value={rating.avg} /><Typography>{rating.avg.toFixed(1)} ({rating.count})</Typography></Stack> : <Typography color="text.secondary">{t('public.noRatings')}</Typography>}
                <Typography variant="caption" color="text.secondary">Shown separately, not part of the score</Typography>
              </CardContent></Card>
              {f.cwg !== 'none' && <Chip icon={<Icon name="emoji_events" size={18} />} label={t(`cwg.${f.cwg}`)} sx={{ bgcolor: '#FFE7CC', color: '#8A4B00', mb: 2 }} />}
              {f.status === 'approved' && <Button fullWidth variant="outlined" startIcon={<Icon name="qr_code_2" />} onClick={() => nav(`/poster/${f.id}`)}>{t('qr.poster')}</Button>}
            </Box>
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={1}>
            {history.length === 0 && <Typography color="text.secondary">—</Typography>}
            {history.map((h, i) => (
              <Card key={i}><CardContent sx={{ py: 1.5 }}>
                <Stack direction="row" gap={1} alignItems="center">
                  <Icon name={h.what === 'approved' ? 'verified' : h.what === 'returned' ? 'undo' : h.what === 'rejected' ? 'block' : h.what === 'submitted' ? 'send' : 'edit'} color={brand.blue} />
                  <Typography fontWeight={500} sx={{ flex: 1 }}>{h.what} · {t('state.by')} {userName(h.who)}</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(h.at).toLocaleString('en-IN')}</Typography>
                </Stack>
                {h.detail && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 4 }}>{h.detail}</Typography>}
              </CardContent></Card>
            ))}
          </Stack>
        )}
      </Container>

      {f.status === 'submitted' && (
        <BottomBar>
          <Box>
            {err && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setErr('')}>{err}</Alert>}
            <TextField size="small" label={t('state.commentReq')} value={comment} onChange={e => setComment(e.target.value)} sx={{ mb: 1 }} />
            <Stack direction="row" gap={1}>
              <Button color="error" variant="text" startIcon={<Icon name="block" />} onClick={() => act('rejected')} sx={{ flex: 1, px: 1 }}>{t('state.reject')}</Button>
              <Button color="warning" variant="outlined" startIcon={<Icon name="undo" />} onClick={() => act('returned')} sx={{ flex: 1, px: 1 }}>{t('state.return')}</Button>
              <Button color="success" variant="contained" startIcon={<Icon name="verified" />} onClick={() => act('approved')} sx={{ flex: 1.3, px: 1 }}>{t('state.approve')}</Button>
            </Stack>
          </Box>
        </BottomBar>
      )}
    </>
  )
}
