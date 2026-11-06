// Shared pieces for the DSO facility view and the State review screen.
import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Icon } from './ui'
import { useDb } from '../data/store'
import { DAYS, TALUKAS, CONDITION_KEYS } from '../lib/constants'
import { haversine } from '../lib/geo'
import type { DayTiming, Facility, ReviewAction } from '../lib/types'
import { brand } from '../theme'

export const dayTimingText = (v: DayTiming, closed: string) =>
  !v ? closed : `${v.open}–${v.close}${v.open2 && v.close2 ? `, ${v.open2}–${v.close2}` : ''}`

const HIST_ICON: Record<string, string> = {
  created: 'add_circle', updated: 'edit', submitted: 'send', approved: 'verified', returned: 'undo',
  rejected: 'block', deleted: 'delete', grievance_resolved: 'task_alt',
}

/** Who did what, newest first. Action names are translated. */
export function HistoryList({ facilityId }: { facilityId: string }) {
  const { t, i18n } = useTranslation()
  const db = useDb()
  const fromAudit = db.audit.filter(a => a.facilityId === facilityId).map(a => ({ at: a.at, who: a.actor, what: a.action, detail: a.detail }))
  const fromReviews = db.reviews
    .filter(x => x.facilityId === facilityId && !db.audit.some(a => a.facilityId === facilityId && a.action === x.action && Math.abs(new Date(a.at).getTime() - new Date(x.at).getTime()) < 5000))
    .map(x => ({ at: x.at, who: x.by, what: x.action, detail: [x.reasons?.length ? `[${x.reasons.join(', ')}]` : '', x.comment].filter(Boolean).join(' ') }))
  const items = [...fromAudit, ...fromReviews].sort((a, b) => b.at.localeCompare(a.at))
  const name = (id: string) => db.users.find(u => u.id === id)?.fullName || id
  // show reason ids as words
  const pretty = (s: string) => s.replace(/\[([^\]]+)\]/, (_, ids: string) => ids.split(', ').map(id => t(`reason.${id}`, { defaultValue: id })).join(' · ') + ' —')
  if (!items.length) return <Typography color="text.secondary">—</Typography>
  return (
    <Stack spacing={1}>
      {items.map((h, i) => (
        <Card key={i}><CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Stack direction="row" gap={1} alignItems="flex-start">
            <Icon name={HIST_ICON[h.what] || 'history'} color={brand.blue} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={500}>{t(`hist.${h.what}`, { defaultValue: h.what })}</Typography>
              <Typography variant="caption" color="text.secondary">{name(h.who)} · {new Date(h.at).toLocaleString(i18n.language === 'gu' ? 'gu-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography>
              {h.detail && h.what !== 'updated' && <Typography variant="body2" sx={{ mt: 0.5 }}>{pretty(h.detail)}</Typography>}
            </Box>
          </Stack>
        </CardContent></Card>
      ))}
    </Stack>
  )
}

/** The State officer's latest return/reject, with reasons as chips. */
export function ReturnNote({ review, action }: { review: ReviewAction; action?: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <Alert severity={review.action === 'rejected' ? 'error' : 'warning'} icon={<Icon name={review.action === 'rejected' ? 'block' : 'assignment_return'} />} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
      <Typography fontWeight={500} sx={{ mb: 0.5 }}>{review.action === 'rejected' ? t('fv.rejectedNote') : t('fv.whatToFix')}</Typography>
      {!!review.reasons?.length && (
        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mb: 0.75 }}>
          {review.reasons.map(r => <Chip key={r} size="small" label={t(`reason.${r}`)} sx={{ bgcolor: '#fff', height: 26 }} />)}
        </Stack>
      )}
      {review.comment && <Typography variant="body2">“{review.comment}”</Typography>}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Alert>
  )
}

interface Change { label: string; before: string; after: string }

/** Field-by-field differences between the last approved copy and the edited facility. */
export function diffFacility(prev: Facility, next: Facility, t: TFunction): Change[] {
  const out: Change[] = []
  const yn = (b: boolean) => (b ? t('common.yes') : t('common.no'))
  const list = (xs: string[], ns: string) => xs.map(x => t(`${ns}.${x}`)).join(', ') || '—'
  const tal = (id: string) => TALUKAS.find(x => x.id === id)?.en || id
  const val = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const add = (label: string, a: string, b: string) => { if (a !== b) out.push({ label, before: a, after: b }) }
  add(t('wiz.name'), prev.name, next.name)
  add(t('wiz.type'), t(`type.${prev.type}`), t(`type.${next.type}`))
  add(t('wiz.ownership'), t(`own.${prev.ownership}`), t(`own.${next.ownership}`))
  add(t('wiz.taluka'), tal(prev.taluka), tal(next.taluka))
  add(t('wiz.ward'), val(prev.ward), val(next.ward))
  add(t('wiz.cwg'), t(`cwg.${prev.cwg}`), t(`cwg.${next.cwg}`))
  add(t('wiz.capacity'), val(prev.capacity), val(next.capacity))
  add(t('wiz.surfaceType'), prev.surface ? t(`surface.${prev.surface}`, { defaultValue: prev.surface }) : '—', next.surface ? t(`surface.${next.surface}`, { defaultValue: next.surface }) : '—')
  // lists: show only what was added / removed
  const setDiff = (label: string, a: string[], b: string[], ns: string) => {
    const added = b.filter(x => !a.includes(x)), removed = a.filter(x => !b.includes(x))
    if (!added.length && !removed.length) return
    out.push({ label, before: removed.length ? '− ' + list(removed, ns) : '', after: added.length ? '+ ' + list(added, ns) : t('common.none') })
  }
  setDiff(t('wiz.sports'), prev.sports, next.sports, 'sport')
  setDiff(t('wiz.amenities'), prev.amenities, next.amenities, 'amenity')
  add(t('wiz.coach'), yn(prev.coachAvailable), yn(next.coachAvailable))
  add(t('wiz.womenSlots'), yn(prev.womenOnlySlots), yn(next.womenOnlySlots))
  add(t('wiz.para'), yn(prev.paraSports), yn(next.paraSports))
  add(t('wiz.schools'), yn(prev.openToSchools), yn(next.openToSchools))
  // timings: one line when every changed day changed the same way
  const dayCh = DAYS.map(d => ({ d, a: dayTimingText(prev.timings[d], t('wiz.closed')), b: dayTimingText(next.timings[d], t('wiz.closed')) })).filter(x => x.a !== x.b)
  if (dayCh.length && dayCh.every(x => x.a === dayCh[0].a && x.b === dayCh[0].b)) {
    out.push({ label: `${t('wiz.timings')} · ${dayCh.length === 7 ? t('rv.everyDay') : dayCh.map(x => t(`day.${x.d}`)).join(', ')}`, before: dayCh[0].a, after: dayCh[0].b })
  } else dayCh.forEach(x => out.push({ label: `${t('wiz.timings')} · ${t(`day.${x.d}`)}`, before: x.a, after: x.b }))
  add(t('wiz.fee'), `${t(`fee.${prev.feeType}`)}${prev.feeAmount ? ` ₹${prev.feeAmount}` : ''}`, `${t(`fee.${next.feeType}`)}${next.feeAmount ? ` ₹${next.feeAmount}` : ''}`)
  add(t('wiz.bookingPhone'), val(prev.bookingPhone), val(next.bookingPhone))
  for (const k of CONDITION_KEYS) {
    const s = (v?: number) => (v === undefined ? '—' : v === 0 ? t('common.notAvailable') : `${v}★`)
    add(t(`cond.${k}`), s(prev.condition[k]), s(next.condition[k]))
  }
  add(t('wiz.lastMaintenance'), val(prev.lastMaintenance), val(next.lastMaintenance))
  add(t('wiz.weeklyUsers'), val(prev.weeklyUsersEstimate), val(next.weeklyUsersEstimate))
  if (prev.photos.length !== next.photos.length || prev.photos.some((p, i) => p.id !== next.photos[i]?.id)) add(t('rv.photos'), String(prev.photos.length), String(next.photos.length))
  if (prev.lat != null && next.lat != null) {
    const m = Math.round(haversine(prev.lat, prev.lng!, next.lat, next.lng!))
    if (m > 5) out.push({ label: t('common.map'), before: '', after: t('rv.pinMoved', { m }) })
  }
  return out
}

export function ChangesCard({ prev, next }: { prev: Facility; next: Facility }) {
  const { t } = useTranslation()
  const ch = diffFacility(prev, next, t)
  return (
    <Card sx={{ borderColor: '#F0C58A', bgcolor: '#FFF8EE' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}><Icon name="difference" color="#8A4B00" /><Typography variant="h4">{t('rv.changes')}</Typography></Stack>
        {ch.length === 0 && <Typography color="text.secondary">{t('rv.noChanges')}</Typography>}
        <Stack divider={<Box sx={{ borderTop: '1px solid #F3DDBF' }} />}>
          {ch.map((c, i) => (
            <Box key={i} sx={{ py: 0.75 }}>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
              <Typography variant="body2">
                {c.before && <><Box component="span" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>{c.before}</Box>{' → '}</>}
                <b>{c.after}</b>
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
