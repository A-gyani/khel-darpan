import { useState } from 'react'
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Fab, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, TopBar, StatusChip, ScoreBadge, TagChips, useCurrentUser, DemoBadge } from '../components/ui'
import { MapView } from '../components/MapView'
import { useDb, resolveGrievance } from '../data/store'
import { computeScore, BAND_COLORS } from '../lib/score'
import { ESCALATE_AFTER_DAYS, TALUKAS, districtOf, placeName } from '../lib/constants'
import type { Status } from '../lib/types'
import { typeIcon } from './PublicMap'
import { ReturnNote } from '../components/review'
import { fixStep } from './DsoFacilityView'

export const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5))

export default function DsoHome() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const db = useDb()
  const user = useCurrentUser()!
  const [tab, setTab] = useState(0)
  const [resolving, setResolving] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const mine = db.facilities.filter(f => f.district === user.district)
  const count = (s: Status) => mine.filter(f => f.status === s).length
  const returned = mine.filter(f => f.status === 'returned')
  const ids = new Set(mine.map(f => f.id))
  const grievances = db.grievances.filter(g => ids.has(g.facilityId)).sort((a, b) => (a.status === b.status ? a.at.localeCompare(b.at) : a.status === 'open' ? -1 : 1))
  const openG = grievances.filter(g => g.status === 'open')

  const stat = (s: Status, icon: string) => (
    <Card>
      <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
        <Stack direction="row" alignItems="center" gap={1}><Icon name={icon} color="#1B6FB8" /><Typography variant="body2" color="text.secondary">{t(`status.${s}`)}</Typography></Stack>
        <Typography sx={{ mt: 0.25, fontSize: { xs: 26, sm: 32 }, fontWeight: 500, lineHeight: 1.1 }}>{count(s)}</Typography>
      </CardContent>
    </Card>
  )

  return (
    <>
      <TopBar title={`${t('dso.home')} · ${placeName(districtOf(user.district || ''), i18n.language)}`} />
      <Container maxWidth="lg" sx={{ py: 2, pb: 12, px: { xs: 1.5, sm: 3 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.25, mb: 2 }}>
          {stat('draft', 'edit_note')}{stat('submitted', 'schedule_send')}{stat('returned', 'undo')}{stat('approved', 'verified')}
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
          <Tab icon={<Icon name="assignment_return" />} iconPosition="start" label={`${t('status.returned')} (${returned.length})`} />
          <Tab icon={<Icon name="list_alt" />} iconPosition="start" label={t('dso.myFacilities')} />
          <Tab icon={<Icon name="report" />} iconPosition="start" label={`${t('dso.grievances')} (${openG.length})`} />
        </Tabs>

        {tab === 0 && (
          <Stack spacing={1.5}>
            {returned.length === 0 && <Alert severity="success">{t('dso.noReturned')}</Alert>}
            {returned.map(f => {
              const rv = [...db.reviews].reverse().find(r => r.facilityId === f.id)
              return (
                <Card key={f.id} sx={{ borderColor: '#FFD9B0' }}>
                  <CardActionArea onClick={() => nav(`/dso/edit/${f.id}?step=${fixStep(rv?.reasons)}`)} sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}><Typography fontWeight={500} sx={{ flex: 1 }}>{f.name}</Typography><StatusChip status={f.status} /></Stack>
                    {rv && <ReturnNote review={rv} action={<Typography variant="body2" fontWeight={700} color="warning.dark"><Icon name="build" size={18} /> {t('fv.fixNow')} →</Typography>} />}
                  </CardActionArea>
                </Card>
              )
            })}
          </Stack>
        )}

        {tab === 1 && (
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <Box sx={{ flex: { md: 1 }, flexShrink: 0, height: { xs: 280, md: 560 }, borderRadius: '16px', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              <MapView pins={mine.filter(f => f.lat != null).map(f => ({ id: f.id, lat: f.lat!, lng: f.lng!, color: BAND_COLORS[computeScore(f, db.checkins).band], icon: typeIcon(f.type), label: f.name }))}
                onPinClick={id => nav(`/dso/f/${id}`)} />
            </Box>
            <Stack spacing={1} sx={{ flex: 1, maxHeight: { md: 560 }, overflowY: 'auto' }}>
              {[...mine].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(f => {
                const r = computeScore(f, db.checkins)
                const tal = TALUKAS.find(x => x.id === f.taluka)
                return (
                  <Card key={f.id} sx={{ display: 'flex', alignItems: 'stretch' }}>
                    <CardActionArea onClick={() => nav(`/dso/f/${f.id}`)} sx={{ p: 1.5, display: 'flex', gap: 1.5, justifyContent: 'flex-start', flex: 1, minWidth: 0 }}>
                      <ScoreBadge r={r} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={500} sx={{ lineHeight: 1.25 }}>{f.name}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>{t(`type.${f.type}`)} · {tal ? (i18n.language === 'gu' ? tal.gu : tal.en) : ''}</Typography>
                        <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }} flexWrap="wrap"><StatusChip status={f.status} /><TagChips r={r} />{f.demo && <DemoBadge />}</Stack>
                      </Box>
                    </CardActionArea>
                    {f.status === 'approved' && (
                      <Button size="small" variant="text" onClick={() => nav(`/poster/${f.id}`)} aria-label={t('dso.poster')}
                        sx={{ flexDirection: 'column', minWidth: 56, borderRadius: 0, borderLeft: '1px solid', borderColor: 'divider', fontSize: 12, px: 1 }}>
                        <Icon name="qr_code_2" />QR
                      </Button>
                    )}
                  </Card>
                )
              })}
            </Stack>
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={1.5}>
            {grievances.map(g => {
              const f = db.facilities.find(x => x.id === g.facilityId)
              const d = daysSince(g.at)
              const overdue = g.status === 'open' && d > ESCALATE_AFTER_DAYS
              return (
                <Card key={g.id} sx={{ borderColor: overdue ? 'error.main' : undefined }}>
                  <CardContent>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <Typography fontWeight={500} sx={{ flex: 1 }}>{t(`gcat.${g.category}`)} · {f?.name}</Typography>
                      <Chip size="small" label={g.ref} variant="outlined" />
                      {g.status === 'open'
                        ? <Chip size="small" color={overdue ? 'error' : 'warning'} label={overdue ? `${t('dso.overdue')} · ${t('dso.daysOpen', { count: d })}` : t('dso.daysOpen', { count: d })} />
                        : <Chip size="small" color="success" label={t('dso.resolved')} />}
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1 }}>{g.description}</Typography>
                    {g.photo && <Box component="img" src={g.photo} alt="" sx={{ mt: 1, maxWidth: 200, borderRadius: '10px' }} />}
                    {g.status === 'resolved' && g.resolutionNote && <Typography variant="body2" color="success.main" sx={{ mt: 1 }}><Icon name="check_circle" size={18} /> {g.resolutionNote}</Typography>}
                    {g.status === 'open' && <Button size="small" sx={{ mt: 1 }} variant="outlined" startIcon={<Icon name="task_alt" />} onClick={() => { setResolving(g.id); setNote('') }}>{t('dso.markResolved')}</Button>}
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
        )}
      </Container>

      <Fab variant="extended" color="secondary" onClick={() => nav('/dso/edit/new')} sx={{ position: 'fixed', right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))', height: 56, px: 3 }}>
        <Icon name="add_location_alt" style={{ marginRight: 8 }} />{t('dso.add')}
      </Fab>

      <Dialog open={!!resolving} onClose={() => setResolving(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('dso.markResolved')}</DialogTitle>
        <DialogContent><TextField sx={{ mt: 1 }} label={t('dso.resolutionNote')} value={note} onChange={e => setNote(e.target.value)} multiline minRows={2} autoFocus /></DialogContent>
        <DialogActions>
          <Button onClick={() => setResolving(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" disabled={!note.trim()} onClick={() => { resolveGrievance(resolving!, note.trim(), user.id); setResolving(null) }}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
