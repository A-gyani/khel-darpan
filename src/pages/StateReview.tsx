import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon, TopBar, ScoreBars, ScoreBadge, StatusChip, TagChips, Stars, useCurrentUser, Section, BottomBar, NotFound } from '../components/ui'
import { HistoryList, ChangesCard, ReturnNote } from '../components/review'
import { MapView } from '../components/MapView'
import { useDb, reviewFacility, avgRating } from '../data/store'
import { computeScore } from '../lib/score'
import { CONDITION_KEYS, RETURN_REASONS, districtOf, placeName } from '../lib/constants'
import type { Facility } from '../lib/types'
import { PhotoStrip, FacilityDetails } from './FacilityPage'
import { brand } from '../theme'
import { typeIcon } from './PublicMap'
import { daysSince } from './DsoHome'

type Mode = '' | 'approve' | 'return' | 'reject'

export default function StateReview() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const db = useDb()
  const user = useCurrentUser()!
  const [tab, setTab] = useState(0)
  const [mode, setMode] = useState<Mode>('')
  const [comment, setComment] = useState('')
  const [reasons, setReasons] = useState<string[]>([])
  const [err, setErr] = useState('')
  const f = db.facilities.find(x => x.id === id)
  if (!f) return <NotFound back="/state" />
  const r = computeScore(f, db.checkins)
  const rating = avgRating(db, f.id)
  const flags = f.photos.filter(p => p.flagFar || p.flagDuplicate || p.flagPoorGps)
  const last = [...db.reviews].reverse().find(x => x.facilityId === f.id)
  const pending = f.status === 'submitted'
  const photoPoints = f.photos.filter(p => p.lat != null)

  function open(m: Mode) {
    setErr(''); setComment(''); setReasons([])
    if (m === 'approve' && flags.length === 0) { reviewFacility(f!.id, user.id, 'approved', ''); nav('/state'); return }
    setMode(m)
  }
  function confirm() {
    const c = comment.trim()
    if (mode === 'approve' && !c) return setErr(t('rv.needNote'))
    if (mode === 'return' && !c && reasons.length === 0) return setErr(t('rv.needReason'))
    if (mode === 'reject' && !c) return setErr(t('rv.needComment'))
    reviewFacility(f!.id, user.id, mode === 'approve' ? 'approved' : mode === 'return' ? 'returned' : 'rejected', c, mode === 'approve' ? [] : reasons)
    nav('/state')
  }

  // Score, flags and photo-location map: what a reviewer checks first
  const side = (
    <Stack spacing={2} sx={{ width: { xs: '100%', md: 360 }, flexShrink: 0, position: { md: 'sticky' }, top: { md: 80 } }}>
      <Card><CardContent>
        <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 2 }}>
          <ScoreBadge r={r} size={60} />
          <Box sx={{ minWidth: 0 }}><Typography variant="h4">{t('fv.score')}</Typography><TagChips r={r} /></Box>
        </Stack>
        <ScoreBars r={r} />
      </CardContent></Card>
      <Card sx={{ borderColor: flags.length ? '#F0C58A' : undefined }}><CardContent>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: flags.length ? 1 : 0 }}>
          <Icon name={flags.length ? 'flag' : 'verified'} color={flags.length ? '#B26A00' : brand.green} />
          <Typography fontWeight={500}>{flags.length ? t('rv.flagsSummary', { count: flags.length }) : t('rv.noFlags')}</Typography>
        </Stack>
        {flags.map(p => (
          <Typography key={p.id} variant="body2" sx={{ py: 0.25 }}>
            <b>{t(`caption.${p.caption}`)}</b>: {[p.flagFar && t('cam.farFlag', { m: p.distanceFromPin }), p.flagPoorGps && t('cam.gpsFlag'), p.flagDuplicate && t('cam.dupFlag')].filter(Boolean).join(' · ')}
          </Typography>
        ))}
      </CardContent></Card>
      <Box sx={{ height: 240, borderRadius: '16px', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <MapView pins={[{ id: 'pin', lat: f.lat!, lng: f.lng!, color: brand.orange, icon: typeIcon(f.type), label: f.name }]}
          focus={[[f.lat!, f.lng!], ...photoPoints.map(p => [p.lat!, p.lng!] as [number, number])]}
          extraPins={photoPoints.map(p => ({ id: p.id, lat: p.lat!, lng: p.lng!, color: p.flagFar ? '#C62828' : '#607D8B', icon: 'photo_camera', label: t(`caption.${p.caption}`) }))} />
      </Box>
      <Card><CardContent>
        <Typography fontWeight={500} sx={{ mb: 0.5 }}>{t('state.rating')}</Typography>
        {rating ? <Stack direction="row" gap={1} alignItems="center"><Stars value={rating.avg} size="small" /><Typography variant="body2">{rating.avg.toFixed(1)} ({rating.count})</Typography></Stack> : <Typography variant="body2" color="text.secondary">{t('public.noRatings')}</Typography>}
        <Typography variant="caption" color="text.secondary">{t('rv.ratingNote')}</Typography>
      </CardContent></Card>
      {f.cwg !== 'none' && <Chip icon={<Icon name="emoji_events" size={18} />} label={t(`cwg.${f.cwg}`)} sx={{ bgcolor: '#FFE7CC', color: '#8A4B00', alignSelf: 'flex-start' }} />}
      {f.status === 'approved' && <Button variant="outlined" startIcon={<Icon name="qr_code_2" />} onClick={() => nav(`/poster/${f.id}`)}>{t('qr.poster')}</Button>}
    </Stack>
  )

  return (
    <>
      <TopBar back="/state" title={f.name} />
      <Container maxWidth="lg" sx={{ py: 2, pb: pending ? 14 : 6, px: { xs: 1.5, sm: 3 } }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
          <StatusChip status={f.status} />
          <Typography variant="body2" color="text.secondary">
            {placeName(districtOf(f.district), i18n.language)} · {t(`type.${f.type}`)}{pending && f.submittedAt ? ` · ${t('dso.daysOpen', { count: daysSince(f.submittedAt) })}` : ''}
          </Typography>
        </Stack>
        {pending && f.published && <Box sx={{ mb: 2 }}><ChangesCard prev={f.published as Facility} next={f} /></Box>}
        {!pending && last && last.action !== 'approved' && <Box sx={{ mb: 2 }}><ReturnNote review={last} /></Box>}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab icon={<Icon name="fact_check" />} iconPosition="start" label={t('common.details')} />
          <Tab icon={<Icon name="history" />} iconPosition="start" label={t('common.history')} />
        </Tabs>

        {tab === 0 && (
          <Stack direction={{ xs: 'column', md: 'row-reverse' }} gap={2} alignItems="flex-start">
            {side}
            <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
              <Section title={t('common.photos')} icon="photo_library"><PhotoStrip f={f} flags /></Section>
              <FacilityDetails f={f} />
              <Section title={(t('wiz.steps', { returnObjects: true }) as string[])[5]} icon="star_rate">
                <Card><CardContent>
                  {CONDITION_KEYS.map(k => (
                    <Stack key={k} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.25 }}>
                      <Typography variant="body2">{t(`cond.${k}`)}</Typography>
                      {f.condition[k] === 0 ? <Typography variant="caption" color="text.secondary">{t('common.notAvailable')}</Typography> : <Stars value={f.condition[k] || 0} size="small" />}
                    </Stack>
                  ))}
                  {f.lastMaintenance && <Typography variant="caption" color="text.secondary">{t('wiz.lastMaintenance')}: {f.lastMaintenance}</Typography>}
                </CardContent></Card>
              </Section>
            </Box>
          </Stack>
        )}
        {tab === 1 && <HistoryList facilityId={f.id} />}
      </Container>

      {pending && (
        <BottomBar>
          <Stack direction="row" gap={1}>
            <Button color="error" variant="text" startIcon={<Icon name="block" />} onClick={() => open('reject')} sx={{ flex: 1, px: 1 }}>{t('state.reject')}</Button>
            <Button color="warning" variant="outlined" startIcon={<Icon name="undo" />} onClick={() => open('return')} sx={{ flex: 1, px: 1 }}>{t('state.return')}</Button>
            <Button color="success" variant="contained" startIcon={<Icon name={flags.length ? 'flag' : 'verified'} />} onClick={() => open('approve')} sx={{ flex: 1.3, px: 1 }}>{t('state.approve')}</Button>
          </Stack>
        </BottomBar>
      )}

      <Dialog open={!!mode} onClose={() => setMode('')} fullWidth maxWidth="xs" scroll="paper">
        <DialogTitle>{mode === 'approve' ? t('rv.approveFlagTitle') : mode === 'return' ? t('rv.returnTitle') : t('rv.rejectTitle')}</DialogTitle>
        <DialogContent dividers>
          {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}
          {mode === 'approve' && (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>{t('rv.approveFlagBody')}</Typography>
              {flags.map(p => <Typography key={p.id} variant="body2" color="warning.dark">• {t(`caption.${p.caption}`)}: {[p.flagFar && t('cam.farFlag', { m: p.distanceFromPin }), p.flagPoorGps && t('cam.gpsFlag'), p.flagDuplicate && t('cam.dupFlag')].filter(Boolean).join(' · ')}</Typography>)}
            </>
          )}
          {mode !== 'approve' && (
            <>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>{t('rv.pickReason')}</Typography>
              <Stack sx={{ mb: 1 }}>
                {RETURN_REASONS.map(rr => (
                  <FormControlLabel key={rr.id} sx={{ my: -0.25 }}
                    control={<Checkbox checked={reasons.includes(rr.id)} onChange={e => setReasons(e.target.checked ? [...reasons, rr.id] : reasons.filter(x => x !== rr.id))} />}
                    label={<Typography variant="body2">{t(`reason.${rr.id}`)}</Typography>} />
                ))}
              </Stack>
            </>
          )}
          <TextField sx={{ mt: 1 }} multiline minRows={2} label={mode === 'approve' ? t('rv.note') : t('rv.commentLabel')} value={comment} onChange={e => setComment(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMode('')}>{t('common.cancel')}</Button>
          <Button variant="contained" color={mode === 'approve' ? 'success' : mode === 'return' ? 'warning' : 'error'} onClick={confirm}>
            {mode === 'approve' ? t('state.approve') : mode === 'return' ? t('state.return') : t('state.reject')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
