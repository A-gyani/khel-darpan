// DSO: read-only view of one facility, opened before editing.
import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Container, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tab, Tabs, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon, TopBar, ScoreBars, ScoreBadge, StatusChip, TagChips, BottomBar, NotFound, DemoBadge, useCurrentUser } from '../components/ui'
import { HistoryList, ReturnNote } from '../components/review'
import { UsagePanel } from '../components/insights'
import { PhotoStrip, FacilityDetails } from './FacilityPage'
import { useDb, deleteDraft } from '../data/store'
import { computeScore } from '../lib/score'
import { RETURN_REASONS, districtOf, placeName } from '../lib/constants'
import { daysSince } from './DsoHome'

/** First form step the DSO should open for a returned entry. */
export function fixStep(reasons?: string[]) {
  const steps = (reasons || []).map(r => RETURN_REASONS.find(x => x.id === r)?.step ?? 0)
  return steps.length ? Math.min(...steps) : 0
}

export default function DsoFacilityView() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const db = useDb()
  const user = useCurrentUser()!
  const [tab, setTab] = useState(0)
  const [ask, setAsk] = useState<'' | 'edit' | 'delete'>('')
  const f = db.facilities.find(x => x.id === id && x.district === user.district)
  if (!f) return <NotFound back="/dso" />
  const r = computeScore(f, db.checkins)
  const last = [...db.reviews].reverse().find(x => x.facilityId === f.id)
  const editUrl = (step?: number) => `/dso/edit/${f.id}${step ? `?step=${step}` : ''}`

  return (
    <>
      <TopBar back="/dso" title={f.name || '—'} />
      <Container maxWidth="md" sx={{ py: 2, pb: 14, px: { xs: 1.5, sm: 3 } }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
          <StatusChip status={f.status} />
          <Typography variant="body2" color="text.secondary">{t(`type.${f.type}`)} · {placeName(districtOf(f.district), i18n.language)}</Typography>
          {f.demo && <DemoBadge />}
        </Stack>

        {(f.status === 'returned' || f.status === 'rejected') && last && last.action !== 'approved' && (
          <Box sx={{ mb: 2 }}>
            <ReturnNote review={last} action={f.status === 'returned'
              ? <Button variant="contained" color="warning" startIcon={<Icon name="build" />} onClick={() => nav(editUrl(fixStep(last.reasons)))}>{t('fv.fixNow')}</Button>
              : undefined} />
          </Box>
        )}
        {f.status === 'submitted' && (
          <Alert severity="info" icon={<Icon name="schedule" />} sx={{ mb: 2 }}>
            {t('fv.waiting', { count: daysSince(f.submittedAt || f.updatedAt) })}{f.published ? ` ${t('fv.underReviewEdit')}` : ''}
          </Alert>
        )}

        <PhotoStrip f={f} flags />

        <Card sx={{ my: 2 }}><CardContent>
          <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 2 }}>
            <ScoreBadge r={r} size={56} />
            <Box><Typography variant="h4">{t('fv.score')}</Typography><TagChips r={r} /></Box>
          </Stack>
          <ScoreBars r={r} />
        </CardContent></Card>
        {f.status !== 'draft' && <Box sx={{ mb: 2 }}><UsagePanel facilityId={f.id} /></Box>}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab icon={<Icon name="info" />} iconPosition="start" label={t('common.details')} />
          <Tab icon={<Icon name="history" />} iconPosition="start" label={t('common.history')} />
        </Tabs>
        {tab === 0 ? <FacilityDetails f={f} /> : <HistoryList facilityId={f.id} />}
      </Container>

      <BottomBar>
        <Stack direction="row" gap={1}>
          {f.status === 'draft' && (
            <Button color="error" variant="outlined" startIcon={<Icon name="delete" />} onClick={() => setAsk('delete')} sx={{ flex: 1, px: 1 }}>{t('fv.deleteDraft')}</Button>
          )}
          {f.status === 'approved' && (
            <Button variant="outlined" startIcon={<Icon name="qr_code_2" />} onClick={() => nav(`/poster/${f.id}`)} sx={{ flex: 1, px: 1 }}>{t('qr.poster')}</Button>
          )}
          {f.status !== 'rejected' && (
            <Button variant="contained" startIcon={<Icon name={f.status === 'returned' ? 'build' : 'edit'} />} sx={{ flex: 1.3, px: 1 }}
              onClick={() => (f.status === 'approved' ? setAsk('edit') : nav(editUrl(f.status === 'returned' ? fixStep(last?.reasons) : 0)))}>
              {f.status === 'returned' ? t('fv.fixNow') : t('fv.edit')}
            </Button>
          )}
        </Stack>
      </BottomBar>

      <Dialog open={ask === 'edit'} onClose={() => setAsk('')} fullWidth maxWidth="xs">
        <DialogTitle>{t('fv.editApprovedTitle')}</DialogTitle>
        <DialogContent><Typography>{t('fv.editApprovedBody')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setAsk('')}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => nav(editUrl())}>{t('fv.edit')}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={ask === 'delete'} onClose={() => setAsk('')} fullWidth maxWidth="xs">
        <DialogTitle>{t('fv.deleteTitle')}</DialogTitle>
        <DialogContent><Typography>{t('fv.deleteBody')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setAsk('')}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={() => { deleteDraft(f.id, user.id); nav('/dso') }}>{t('fv.delete')}</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
