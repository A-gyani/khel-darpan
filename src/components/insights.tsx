// Facility usage (QR check-ins), taluka coverage and CWG readiness.
import { Alert, Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, ScoreBadge } from './ui'
import { useDb } from '../data/store'
import { MIN_SCANS_FOR_QR, BAND_COLORS } from '../lib/score'
import type { ScoreResult } from '../lib/score'
import { CWG_SPORTS, DISTRICTS, talukasOf, placeName } from '../lib/constants'
import type { Facility } from '../lib/types'
import { brand } from '../theme'

type Scored = { f: Facility; r: ScoreResult }

function Bars({ rows, color = brand.blue }: { rows: { label: string; n: number }[]; color?: string }) {
  const max = Math.max(1, ...rows.map(r => r.n))
  const total = rows.reduce((s, r) => s + r.n, 0) || 1
  return (
    <Stack spacing={0.75}>
      {rows.map(r => (
        <Box key={r.label}>
          <Stack direction="row" justifyContent="space-between"><Typography variant="body2">{r.label}</Typography><Typography variant="body2" color="text.secondary">{Math.round((r.n / total) * 100)}%</Typography></Stack>
          <Box sx={{ height: 8, borderRadius: '4px', bgcolor: '#E6EBF1' }}><Box sx={{ height: '100%', width: `${(r.n / max) * 100}%`, bgcolor: color, borderRadius: '4px' }} /></Box>
        </Box>
      ))}
    </Stack>
  )
}

/** QR check-ins for one facility: who comes, for what, and when. */
export function UsagePanel({ facilityId }: { facilityId: string }) {
  const { t } = useTranslation()
  const db = useDb()
  const now = Date.now()
  const all = db.checkins.filter(c => c.facilityId === facilityId)
  const last30 = all.filter(c => now - new Date(c.at).getTime() <= 30 * 864e5)
  const people = last30.reduce((s, c) => s + (c.groupSize || 1), 0)
  const weeks = [7, 6, 5, 4, 3, 2, 1, 0].map(w => {
    const end = now - w * 7 * 864e5, start = end - 7 * 864e5
    return all.filter(c => { const x = new Date(c.at).getTime(); return x > start && x <= end }).reduce((s, c) => s + (c.groupSize || 1), 0)
  })
  const wMax = Math.max(1, ...weeks)
  const sumBy = <K extends string>(key: (c: typeof last30[number]) => K) => {
    const m = new Map<K, number>()
    last30.forEach(c => m.set(key(c), (m.get(key(c)) || 0) + (c.groupSize || 1)))
    return m
  }
  const sport = [...sumBy(c => c.sport).entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ label: t(`sport.${k}`), n }))
  const g = sumBy(c => (c.gender === 'female' ? 'female' : c.gender === 'male' ? 'male' : 'other'))
  const gender = (['female', 'male', 'other'] as const).map(k => ({ label: k === 'other' ? t('state.otherNa') : t(`state.${k}`), n: g.get(k) || 0 }))
  const a = sumBy(c => c.ageGroup)
  const age = (['u14', '14_18', '19_25', '26_40', '40plus'] as const).map(k => ({ label: t(`qr.ages.${k}`), n: a.get(k) || 0 }))
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const d = sumBy(c => dayNames[new Date(c.at).getDay()])
  const busiest = [...d.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k]) => t(`day.${k}`)).join(', ')
  const band = (h: number) => (h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 16 ? 'afternoon' : h >= 16 && h < 22 ? 'evening' : 'night')
  const tod = sumBy(c => band(new Date(c.at).getHours()))
  const time = (['morning', 'afternoon', 'evening'] as const).map(k => ({ label: t(`usage.${k}`), n: tod.get(k) || 0 }))

  return (
    <Card><CardContent>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}><Icon name="qr_code_scanner" color={brand.blue} /><Typography variant="h4">{t('usage.title')}</Typography></Stack>
      {all.length === 0 ? <Alert severity="info">{t('usage.none')}</Alert> : (
        <Stack spacing={2}>
          <Stack direction="row" gap={3}>
            <Box><Typography sx={{ fontSize: 28, fontWeight: 500, lineHeight: 1.1 }}>{last30.length}</Typography><Typography variant="caption" color="text.secondary">{t('usage.scans')} · {t('usage.last30')}</Typography></Box>
            <Box><Typography sx={{ fontSize: 28, fontWeight: 500, lineHeight: 1.1 }}>{people}</Typography><Typography variant="caption" color="text.secondary">{t('usage.people')}</Typography></Box>
            {busiest && <Box><Typography sx={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6 }}>{busiest}</Typography><Typography variant="caption" color="text.secondary">{t('usage.busiestDays')}</Typography></Box>}
          </Stack>
          {last30.length < MIN_SCANS_FOR_QR && <Alert severity="warning">{t('usage.fewScans', { count: last30.length })}</Alert>}
          <Box>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 0.75 }}>{t('usage.perWeek')}</Typography>
            <Stack direction="row" alignItems="flex-end" gap={0.75} sx={{ height: 64 }}>
              {weeks.map((n, i) => (
                <Box key={i} title={String(n)} sx={{ flex: 1, height: `${Math.max(4, (n / wMax) * 100)}%`, bgcolor: i === 7 ? brand.orange : brand.blue, borderRadius: '4px 4px 0 0', opacity: n ? 1 : 0.25 }} />
              ))}
            </Stack>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Box><Typography variant="body2" fontWeight={500} sx={{ mb: 0.75 }}>{t('usage.bySport')}</Typography><Bars rows={sport} /></Box>
            <Box><Typography variant="body2" fontWeight={500} sx={{ mb: 0.75 }}>{t('usage.byGender')}</Typography><Bars rows={gender} color={brand.orange} /></Box>
            <Box><Typography variant="body2" fontWeight={500} sx={{ mb: 0.75 }}>{t('usage.byAge')}</Typography><Bars rows={age} color={brand.green} /></Box>
            <Box><Typography variant="body2" fontWeight={500} sx={{ mb: 0.75 }}>{t('usage.timeOfDay')}</Typography><Bars rows={time} color="#607D8B" /></Box>
          </Box>
        </Stack>
      )}
    </CardContent></Card>
  )
}

/** Which talukas have no facility, or only poor ones. */
export function CoverageView({ approved, all, dist }: { approved: Scored[]; all: Facility[]; dist: string }) {
  const { t, i18n } = useTranslation()
  const groups = (dist ? DISTRICTS.filter(d => d.id === dist) : DISTRICTS).map(d => ({ d, talukas: talukasOf(d.id) }))
  const rows = groups.flatMap(g => g.talukas.map(tl => {
    const fs = approved.filter(x => x.f.taluka === tl.id)
    const n = { green: 0, amber: 0, red: 0, grey: 0 } as Record<ScoreResult['band'], number>
    fs.forEach(x => n[x.r.band]++)
    const pending = all.filter(f => f.taluka === tl.id && f.status === 'submitted').length
    const status = fs.length === 0 ? 'none' : n.green + n.amber === 0 ? 'onlyPoor' : 'ok'
    return { g: g.d, tl, total: fs.length, n, pending, status }
  }))
  const noneCount = rows.filter(r => r.status === 'none').length
  const poorCount = rows.filter(r => r.status === 'onlyPoor').length
  const chip = (s: string) => s === 'none' ? <Chip size="small" color="error" label={t('cov.none')} /> : s === 'onlyPoor' ? <Chip size="small" color="warning" label={t('cov.onlyPoor')} /> : <Chip size="small" variant="outlined" color="success" label={t('cov.ok')} />
  return (
    <Card><CardContent>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}><Icon name="grid_view" color={brand.blue} /><Typography variant="h4">{t('cov.title')}</Typography></Stack>
      <Typography variant="body2" sx={{ mb: 0.5 }}><b>{t('cov.summary', { none: noneCount, poor: poorCount })}</b></Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>{t('cov.legend')}</Typography>
      {groups.map(g => (
        <Box key={g.d.id} sx={{ mb: 1.5 }}>
          {!dist && <Typography variant="body2" fontWeight={700} color="primary.dark" sx={{ mb: 0.5 }}>{placeName(g.d, i18n.language)}</Typography>}
          <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
            {rows.filter(r => r.g.id === g.d.id).map(r => (
              <Stack key={r.tl.id} direction="row" alignItems="center" gap={1.25} sx={{ py: 0.9 }}>
                <Box sx={{ width: { xs: 104, sm: 150 }, flexShrink: 0 }}>
                  <Typography variant="body2" fontWeight={500} sx={{ lineHeight: 1.25, wordBreak: "break-word" }}>{placeName(r.tl, i18n.language)}</Typography>
                  {r.pending > 0 && <Typography variant="caption" color="text.secondary">{t('cov.pending', { count: r.pending })}</Typography>}
                </Box>
                <Typography sx={{ width: 22, textAlign: 'right', fontWeight: 500, flexShrink: 0 }}>{r.total}</Typography>
                <Box sx={{ flex: 1, height: 10, borderRadius: '5px', bgcolor: '#E6EBF1', display: 'flex', overflow: 'hidden', minWidth: 30 }}>
                  {(['green', 'amber', 'red', 'grey'] as const).map(b => r.n[b] ? <Box key={b} sx={{ width: `${(r.n[b] / Math.max(1, r.total)) * 100}%`, bgcolor: BAND_COLORS[b] }} /> : null)}
                </Box>
                <Box sx={{ flexShrink: 0 }}>{chip(r.status)}</Box>
              </Stack>
            ))}
          </Stack>
        </Box>
      ))}
    </CardContent></Card>
  )
}

/** CWG 2030: for each sport, are there tagged venues in good shape? */
export function CwgReadiness({ approved }: { approved: Scored[] }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const rows = CWG_SPORTS.map(s => {
    const venues = approved.filter(x => x.f.cwg !== 'none' && x.f.sports.includes(s))
    const others = approved.filter(x => x.f.cwg === 'none' && x.f.sports.includes(s))
    const status = venues.length === 0 ? 'gap' : venues.some(v => (v.r.score ?? 0) >= 75) ? 'ready' : 'atRisk'
    return { s, venues, others, othersGood: others.filter(o => (o.r.score ?? 0) >= 75).length, status }
  })
  const count = (s: string) => rows.filter(r => r.status === s).length
  const style: Record<string, { color: 'success' | 'warning' | 'error'; icon: string }> = {
    ready: { color: 'success', icon: 'check_circle' }, atRisk: { color: 'warning', icon: 'warning' }, gap: { color: 'error', icon: 'cancel' },
  }
  return (
    <Card><CardContent>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}><Icon name="emoji_events" color={brand.blue} /><Typography variant="h4">{t('state.cwgReady')}</Typography></Stack>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
        {(['ready', 'atRisk', 'gap'] as const).map(s => <Chip key={s} color={style[s].color} icon={<Icon name={style[s].icon} size={18} color="#fff" />} label={`${t(`cwgx.${s}`)}: ${count(s)}`} />)}
      </Stack>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>{t('cwgx.rule')}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>{t('state.cwgNote')}</Typography>
      <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
        {rows.map(r => (
          <Box key={r.s} sx={{ py: 1.25 }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography fontWeight={500} sx={{ flex: 1 }}>{t(`sport.${r.s}`)}</Typography>
              <Chip size="small" color={style[r.status].color} label={t(`cwgx.${r.status}`)} />
            </Stack>
            {r.venues.length === 0
              ? <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }}>{t('cwgx.noVenue')}</Typography>
              : r.venues.map(v => (
                <Card key={v.f.id} variant="outlined" sx={{ mt: 0.75 }}>
                  <CardActionArea onClick={() => nav(`/state/review/${v.f.id}`)} sx={{ p: 1, display: 'flex', gap: 1.25, justifyContent: 'flex-start' }}>
                    <ScoreBadge r={v.r} size={34} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500} sx={{ lineHeight: 1.25 }}>{v.f.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{t(`cwg.${v.f.cwg}`)} · {t('state.condition')} {Math.round(v.r.pillars[0].value ?? 0)}</Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              ))}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>{t('cwgx.others', { count: r.others.length, good: r.othersGood })}</Typography>
          </Box>
        ))}
      </Stack>
    </CardContent></Card>
  )
}
