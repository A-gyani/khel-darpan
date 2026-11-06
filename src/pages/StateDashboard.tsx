import { useMemo, useState } from 'react'
import { Alert, Box, Card, CardActionArea, CardContent, Chip, Container, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, Typography, Button } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { Icon, TopBar, ScoreBadge, StatusChip, Section, TagChips } from '../components/ui'
import { MapView } from '../components/MapView'
import { useDb, resetDemo } from '../data/store'
import { computeScore, BAND_COLORS } from '../lib/score'
import { CWG_SPORTS, ESCALATE_AFTER_DAYS, FACILITY_TYPES, GRIEVANCE_CATEGORIES, DISTRICTS, talukasOf, districtOf, placeName } from '../lib/constants'
import type { DB } from '../lib/types'

/** Limit all data to one district ('' = whole state). */
function scope(db: DB, dist: string): DB {
  if (!dist) return db
  const facilities = db.facilities.filter(f => f.district === dist)
  const ids = new Set(facilities.map(f => f.id))
  const by = <T extends { facilityId: string }>(xs: T[]) => xs.filter(x => ids.has(x.facilityId))
  return { ...db, facilities, checkins: by(db.checkins), grievances: by(db.grievances), ratings: by(db.ratings), reviews: by(db.reviews), audit: by(db.audit) }
}
import { brand } from '../theme'
import { daysSince } from './DsoHome'
import { typeIcon } from './PublicMap'

const C = { blue: brand.blue, orange: brand.orange, green: brand.green, grey: '#9AA7B5' }

function Kpi({ icon, label, value, sub, color = brand.blue, onClick }: { icon: string; label: string; value: number | string; sub?: string; color?: string; onClick?: () => void }) {
  return (
    <Card>
      <CardActionArea onClick={onClick} disabled={!onClick} sx={{ p: { xs: 1.5, sm: 2 }, height: '100%' }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Box sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, borderRadius: '12px', bgcolor: color + '1F', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={icon} color={color} /></Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.25, fontSize: { xs: 12.5, sm: 14 } }}>{label}</Typography>
        </Stack>
        <Typography sx={{ fontSize: { xs: 26, sm: 34 }, fontWeight: 500, mt: 1, lineHeight: 1.1 }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardActionArea>
    </Card>
  )
}

function ChartCard({ title, icon, children, note }: { title: string; icon: string; children: React.ReactNode; note?: string }) {
  return (
    <Card sx={{ flex: '1 1 420px', minWidth: 0 }}>
      <CardContent sx={{ px: { xs: 1.5, sm: 2 }, overflowX: 'auto' }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}><Icon name={icon} color={brand.blue} /><Typography variant="h4">{title}</Typography></Stack>
        {note && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>{note}</Typography>}
        {children}
      </CardContent>
    </Card>
  )
}

export default function StateDashboard() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const fullDb = useDb()
  const [dist, setDist] = useState<string>(() => { try { return localStorage.getItem('ks_state_dist') || '' } catch { return '' } })
  const pickDist = (d: string) => { setDist(d); try { localStorage.setItem('ks_state_dist', d) } catch { /* ignore */ } }
  const db = useMemo(() => scope(fullDb, dist), [fullDb, dist])
  const [tab, setTab] = useState(0)

  const scored = useMemo(() => db.facilities.map(f => ({ f, r: computeScore(f, db.checkins) })), [db.facilities, db.checkins])
  const approved = scored.filter(x => x.f.status === 'approved')
  const queue = db.facilities.filter(f => f.status === 'submitted').sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || ''))
  const openG = db.grievances.filter(g => g.status === 'open')
  const overdue = openG.filter(g => daysSince(g.at) > ESCALATE_AFTER_DAYS)
  const weekAgo = Date.now() - 7 * 864e5
  const weekCi = db.checkins.filter(c => new Date(c.at).getTime() >= weekAgo)
  const weekPeople = weekCi.reduce((s, c) => s + c.groupSize, 0)

  // charts
  const sportData = useMemo(() => {
    const m = new Map<string, number>()
    approved.forEach(({ f }) => f.sports.forEach(s => m.set(s, (m.get(s) || 0) + 1)))
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => ({ name: t(`sport.${s}`), n }))
  }, [approved, i18n.language]) // eslint-disable-line
  const typeData = FACILITY_TYPES.map(ty => ({ name: t(`type.${ty}`), n: approved.filter(x => x.f.type === ty).length })).filter(x => x.n)
  const bandData = (['green', 'amber', 'red', 'grey'] as const).map(b => ({ name: t(`band.${b}`), n: approved.filter(x => x.r.band === b).length, b }))
  const trend = useMemo(() => {
    const weeks = [3, 2, 1, 0].map(w => {
      const end = Date.now() - w * 7 * 864e5, start = end - 7 * 864e5
      const cs = db.checkins.filter(c => { const ts = new Date(c.at).getTime(); return ts >= start && ts < end })
      const sum = (g: string[]) => cs.filter(c => g.includes(c.gender)).reduce((s, c) => s + c.groupSize, 0)
      return { name: new Date(end - 864e5).toLocaleDateString(i18n.language === 'gu' ? 'gu-IN' : 'en-IN', { day: 'numeric', month: 'short' }), female: sum(['female']), male: sum(['male']), other: sum(['other', 'na']) }
    })
    return weeks
  }, [db.checkins, i18n.language])
  const gData = GRIEVANCE_CATEGORIES.map(c => {
    const gs = db.grievances.filter(g => g.category === c)
    return { name: t(`gcat.${c}`), open: gs.filter(g => g.status === 'open' && daysSince(g.at) <= ESCALATE_AFTER_DAYS).length, overdue: gs.filter(g => g.status === 'open' && daysSince(g.at) > ESCALATE_AFTER_DAYS).length, resolved: gs.filter(g => g.status === 'resolved').length }
  }).filter(x => x.open + x.overdue + x.resolved)

  // CWG readiness
  const cwg = CWG_SPORTS.map(s => {
    const fs = approved.filter(x => x.f.sports.includes(s))
    const good = fs.filter(x => (x.r.pillars[0].value ?? 0) >= 70).length
    return { s, total: fs.length, good, poor: fs.length - good }
  })

  const repair = approved.filter(x => x.r.tags.includes('repair_priority')).sort((a, b) => (b.r.pillars[1].value ?? 0) - (a.r.pillars[1].value ?? 0))
  const underused = approved.filter(x => x.r.tags.includes('underused')).sort((a, b) => (a.r.pillars[1].value ?? 0) - (b.r.pillars[1].value ?? 0))

  // whole state: one row per district; one district: one row per taluka
  const units = dist ? talukasOf(dist) : DISTRICTS
  const inUnit = (f: { taluka: string; district: string }, id: string) => (dist ? f.taluka === id : f.district === id)
  const progress = units.map(tal => {
    const fs = db.facilities.filter(f => inUnit(f, tal.id) && f.status !== 'draft')
    const ids = new Set(fs.map(f => f.id))
    const returnedCount = db.reviews.filter(r => ids.has(r.facilityId) && r.action === 'returned').length
    const gs = db.grievances.filter(g => ids.has(g.facilityId))
    const onTime = gs.filter(g => g.status === 'resolved' && g.resolvedAt && (new Date(g.resolvedAt).getTime() - new Date(g.at).getTime()) / 864e5 <= ESCALATE_AFTER_DAYS).length
    const last = db.facilities.filter(f => inUnit(f, tal.id)).map(f => f.updatedAt).sort().pop()
    return { tal, mapped: fs.length, approved: fs.filter(f => f.status === 'approved').length, returnedCount, gTotal: gs.length, onTime, last }
  })

  const fname = (id: string) => db.facilities.find(f => f.id === id)?.name || id

  return (
    <>
      <TopBar title={`${t('state.dashboard')} · ${dist ? placeName(districtOf(dist), i18n.language) : t('state.gujarat')}`} />
      <Container maxWidth="xl" sx={{ py: 2, pb: 6, px: { xs: 1.5, sm: 3 } }}>
        <Stack direction="row" gap={1} sx={{ mb: 1.5, overflowX: 'auto', pb: 0.5 }}>
          {[{ id: '', label: t('state.allDistricts') }, ...DISTRICTS.map(d => ({ id: d.id, label: placeName(d, i18n.language) }))].map(d => (
            <Chip key={d.id || 'all'} label={d.label} onClick={() => pickDist(d.id)} color={dist === d.id ? 'primary' : 'default'} variant={dist === d.id ? 'filled' : 'outlined'}
              icon={<Icon name={d.id ? 'location_city' : 'map'} size={18} color={dist === d.id ? '#fff' : undefined} />} sx={{ flexShrink: 0, bgcolor: dist === d.id ? undefined : '#fff' }} />
          ))}
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.25, mb: 2 }}>
          <Kpi icon="location_on" label={t('state.total')} value={approved.length} sub={`${db.facilities.length} ${t('common.all').toLowerCase()}`} />
          <Kpi icon="pending_actions" label={t('state.pending')} value={queue.length} color={brand.orange} onClick={() => setTab(0)} />
          <Kpi icon="warning" label={t('state.overdueG')} value={overdue.length} sub={`${openG.length} ${t('dso.open').toLowerCase()}`} color="#C62828" onClick={() => setTab(3)} />
          <Kpi icon="how_to_reg" label={t('state.checkinsWeek')} value={weekCi.length} sub={t('state.people', { count: weekPeople })} color={brand.green} />
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
          <Tab icon={<Icon name="fact_check" />} iconPosition="start" label={`${t('state.review')} (${queue.length})`} />
          <Tab icon={<Icon name="monitoring" />} iconPosition="start" label={t('state.dashboard')} />
          <Tab icon={<Icon name="emoji_events" />} iconPosition="start" label="CWG 2030" />
          <Tab icon={<Icon name="report" />} iconPosition="start" label={`${t('state.grievances')} (${openG.length})`} />
          <Tab icon={<Icon name="groups" />} iconPosition="start" label={t('state.progress')} />
        </Tabs>

        {tab === 0 && (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">{t('state.toReview')}</Typography>
            {queue.length === 0 && <Alert severity="success">{t('state.allClear')}</Alert>}
            {queue.map(f => {
              const r = computeScore(f, db.checkins)
              const flags = f.photos.filter(p => p.flagFar || p.flagDuplicate || p.flagPoorGps).length
              return (
                <Card key={f.id}>
                  <CardActionArea onClick={() => nav(`/state/review/${f.id}`)} sx={{ p: 1.5, display: 'flex', gap: 1.5, justifyContent: 'flex-start' }}>
                    <Box component="img" src={f.photos[1]?.thumbUrl || f.photos[0]?.thumbUrl} alt="" sx={{ width: { xs: 64, sm: 96 }, height: { xs: 64, sm: 72 }, flexShrink: 0, borderRadius: '10px', objectFit: 'cover', bgcolor: '#E3ECF6' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={500} noWrap>{f.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{!dist && <b>{placeName(districtOf(f.district), i18n.language)} · </b>}{t('state.submittedOn')} {f.submittedAt ? new Date(f.submittedAt).toLocaleDateString('en-IN') : ''} · {daysSince(f.submittedAt || f.updatedAt)} {t('common.days')}</Typography>
                      <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                        <StatusChip status={f.status} />
                        {f.published && <Chip size="small" label="Re-review" sx={{ height: 26 }} />}
                        {flags > 0 && <Chip size="small" color="warning" icon={<Icon name="flag" size={16} />} label={`${flags} ${t('state.flags')}`} sx={{ height: 26 }} />}
                      </Stack>
                    </Box>
                    <ScoreBadge r={r} />
                    <Icon name="chevron_right" color="#5B6B7E" />
                  </CardActionArea>
                </Card>
              )
            })}
          </Stack>
        )}

        {tab === 1 && (
          <Stack gap={2}>
            <Card sx={{ height: { xs: 300, sm: 380 }, overflow: 'hidden', p: 0 }}>
              <MapView pins={approved.map(({ f, r }) => ({ id: f.id, lat: f.lat!, lng: f.lng!, color: BAND_COLORS[r.band], icon: typeIcon(f.type), label: `${f.name} · ${r.score ?? '–'}` }))}
                onPinClick={id => nav(`/state/review/${id}`)} />
            </Card>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {bandData.map(b => <Chip key={b.b} label={`${b.name}: ${b.n}`} sx={{ bgcolor: BAND_COLORS[b.b], color: '#fff' }} />)}
            </Stack>
            <Stack direction="row" gap={2} flexWrap="wrap" alignItems="flex-start">
              <ChartCard title={t('state.bySport')} icon="sports">
                <ResponsiveContainer width="100%" height={Math.max(220, sportData.length * 26)}>
                  <BarChart data={sportData} layout="vertical" margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} />
                    <Tooltip /><Bar dataKey="n" fill={C.blue} radius={[0, 6, 6, 0]} name={t('state.facilities')} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <Stack gap={2} sx={{ flex: '1 1 420px', minWidth: 0, '& > .MuiCard-root': { flex: 'none' } }}>
                <ChartCard title={t('state.byType')} icon="category">
                  <ResponsiveContainer width="100%" height={Math.max(160, typeData.length * 28)}>
                    <BarChart data={typeData} layout="vertical" margin={{ left: 0, right: 8 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 11 }} interval={0} /><Tooltip /><Bar dataKey="n" fill={C.orange} radius={[0, 6, 6, 0]} name={t('state.facilities')} /></BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title={t('state.bands')} icon="health_metrics">
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={bandData} layout="vertical" margin={{ left: 0, right: 8 }}><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 11 }} interval={0} /><Tooltip />
                      <Bar dataKey="n" radius={[0, 6, 6, 0]} name={t('state.facilities')}>{bandData.map(b => <Cell key={b.b} fill={BAND_COLORS[b.b]} />)}</Bar></BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </Stack>
              <ChartCard title={t('state.checkinsTrend')} icon="trending_up">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
                    <Line dataKey="female" name={t('state.female')} stroke={C.orange} strokeWidth={3} />
                    <Line dataKey="male" name={t('state.male')} stroke={C.blue} strokeWidth={3} />
                    <Line dataKey="other" name={t('state.otherNa')} stroke={C.grey} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title={t('state.gByCat')} icon="report">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={gData} layout="vertical" margin={{ left: 0, right: 8 }}><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 10 }} /><Tooltip /><Legend />
                    <Bar dataKey="overdue" stackId="a" fill="#C62828" name={t('dso.overdue')} />
                    <Bar dataKey="open" stackId="a" fill={C.orange} name={t('dso.open')} />
                    <Bar dataKey="resolved" stackId="a" fill={C.green} name={t('dso.resolved')} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Stack>
          </Stack>
        )}

        {tab === 2 && (
          <Stack gap={2} sx={{ '& > .MuiCard-root': { flex: 'none' } }}>
            <ChartCard title={t('state.cwgReady')} icon="emoji_events" note={t('state.cwgNote')}>
              <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
                {cwg.map(row => (
                  <Stack key={row.s} direction="row" alignItems="center" gap={1} sx={{ py: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={500}>{t(`sport.${row.s}`)}</Typography>
                      <Typography variant="caption" color="text.secondary">{t('state.cwgRow', { total: row.total, good: row.good, poor: row.poor })}</Typography>
                    </Box>
                    {row.total === 0 ? <Chip size="small" color="error" label={t('state.gap')} /> : row.good === 0 ? <Chip size="small" color="warning" label={t('state.poor')} /> : <Chip size="small" color="success" label={t('state.good')} />}
                  </Stack>
                ))}
              </Stack>
            </ChartCard>
            <Stack direction="row" gap={2} flexWrap="wrap">
              <ChartCard title={t('state.repairList')} icon="construction">
                <Stack spacing={1}>
                  {repair.length === 0 && <Typography color="text.secondary">—</Typography>}
                  {repair.map(({ f, r }) => <ListRow key={f.id} name={f.name} r={r} onClick={() => nav(`/state/review/${f.id}`)} />)}
                </Stack>
              </ChartCard>
              <ChartCard title={t('state.underusedList')} icon="trending_down">
                <Stack spacing={1}>
                  {underused.length === 0 && <Typography color="text.secondary">—</Typography>}
                  {underused.map(({ f, r }) => <ListRow key={f.id} name={f.name} r={r} onClick={() => nav(`/state/review/${f.id}`)} />)}
                </Stack>
              </ChartCard>
            </Stack>
          </Stack>
        )}

        {tab === 3 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.25 }}>
            {[...db.grievances].sort((a, b) => (a.status === b.status ? a.at.localeCompare(b.at) : a.status === 'open' ? -1 : 1)).map(g => {
              const d = daysSince(g.at)
              const od = g.status === 'open' && d > ESCALATE_AFTER_DAYS
              const fac = db.facilities.find(x => x.id === g.facilityId)
              return (
                <Card key={g.id} sx={{ borderColor: od ? 'error.main' : undefined, bgcolor: od ? '#FFF7F7' : undefined }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
                      <Typography fontWeight={500} sx={{ flex: 1, minWidth: 0 }}>{t(`gcat.${g.category}`)}</Typography>
                      {g.status === 'resolved' ? <Chip size="small" color="success" label={t('dso.resolved')} /> : <Chip size="small" color={od ? 'error' : 'warning'} label={od ? t('dso.overdue') : t('dso.open')} />}
                    </Stack>
                    <Typography variant="body2">{fname(g.facilityId)}</Typography>
                    <Typography variant="caption" color="text.secondary">{g.ref} · {fac ? placeName(districtOf(fac.district), i18n.language) : ''} · {t('dso.daysOpen', { count: d })}</Typography>
                    {g.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{g.description}</Typography>}
                  </CardContent>
                </Card>
              )
            })}
          </Box>
        )}

        {tab === 4 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 1.25 }}>
            {progress.map(p => {
              const fig = (label: string, value: string | number) => (
                <Box><Typography sx={{ fontSize: 20, fontWeight: 500, lineHeight: 1.2 }}>{value}</Typography><Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>{label}</Typography></Box>
              )
              return (
                <Card key={p.tal.id}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography fontWeight={500} sx={{ mb: 1 }}>{i18n.language === 'gu' ? p.tal.gu : p.tal.en}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25 }}>
                      {fig(t('state.mapped'), p.mapped)}
                      {fig(t('state.approved'), p.approved)}
                      {fig(t('state.returnRate'), p.returnedCount)}
                      {fig(t('state.onTime'), p.gTotal ? `${p.onTime}/${p.gTotal}` : '—')}
                      {fig(t('state.lastActivity'), p.last ? `${daysSince(p.last)} ${t('common.days')}` : '—')}
                    </Box>
                  </CardContent>
                </Card>
              )
            })}
          </Box>
        )}

        <Box sx={{ mt: 4, textAlign: 'right' }}>
          <Button size="small" color="inherit" startIcon={<Icon name="restart_alt" />} onClick={() => { if (confirm(t('common.resetDemo') + '?')) resetDemo() }}>{t('common.resetDemo')}</Button>
        </Box>
      </Container>
    </>
  )
}

function ListRow({ name, r, onClick }: { name: string; r: ReturnType<typeof computeScore>; onClick: () => void }) {
  const { t } = useTranslation()
  const c = r.pillars[0].value, u = r.pillars[1].value
  return (
    <Card variant="outlined">
      <CardActionArea onClick={onClick} sx={{ p: 1.25, display: 'flex', gap: 1.5, justifyContent: 'flex-start' }}>
        <ScoreBadge r={r} size={38} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={500} noWrap>{name}</Typography>
          <Typography variant="caption" color="text.secondary">{t('state.condition')} {c != null ? Math.round(c) : '–'} · {t('state.use')} {u != null ? Math.round(u) : '–'}</Typography>
        </Box>
        <TagChips r={{ ...r, tags: r.tags.filter(x => x !== 'not_women_friendly') }} />
      </CardActionArea>
    </Card>
  )
}

export { Section }
