// State officer home. Built for all 34 districts: one district dropdown, short filtered lists, three charts in their own tab.
import { useMemo, useState } from 'react'
import { Alert, Box, Button, Card, CardActionArea, Chip, Container, FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, TopBar } from '../components/ui'
import { useDb, resetDemo, REMOTE } from '../data/store'
import { computeScore, BAND_COLORS, weeklyUsersFromQr, MIN_SCANS_FOR_QR } from '../lib/score'
import type { ScoreResult } from '../lib/score'
import { CWG_SPORTS, ESCALATE_AFTER_DAYS, FACILITY_TYPES, GRIEVANCE_CATEGORIES, SPORTS, DISTRICTS, TALUKAS, talukasOf, districtOf, placeName } from '../lib/constants'
import type { DB, Facility } from '../lib/types'
import { brand } from '../theme'
import { daysSince } from './DsoHome'
import { StateCharts } from '../components/stateCharts'
import { ExportButton } from '../components/ExportButton'

type Scored = { f: Facility; r: ScoreResult }
const PAGE = 20

/** Limit all data to one district ('' = whole state). */
function scope(db: DB, dist: string): DB {
  if (!dist) return db
  const facilities = db.facilities.filter(f => f.district === dist)
  const ids = new Set(facilities.map(f => f.id))
  const by = <T extends { facilityId: string }>(xs: T[]) => xs.filter(x => ids.has(x.facilityId))
  return { ...db, facilities, checkins: by(db.checkins), grievances: by(db.grievances), ratings: by(db.ratings), reviews: by(db.reviews), audit: by(db.audit) }
}

function useLS(key: string, init: string): [string, (v: string) => void] {
  const [v, setV] = useState<string>(() => { try { return localStorage.getItem(key) ?? init } catch { return init } })
  return [v, (x: string) => { setV(x); try { localStorage.setItem(key, x) } catch { /* ignore */ } }]
}

function Pick({ label, value, onChange, options, width = 160 }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; width?: number }) {
  return (
    <FormControl size="small" sx={{ minWidth: width, flexShrink: 0 }}>
      <InputLabel shrink>{label}</InputLabel>
      <Select label={label} value={value} displayEmpty notched onChange={e => onChange(e.target.value)}>
        {options.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
      </Select>
    </FormControl>
  )
}

/** Filters sit in one horizontally scrolling row so the list starts on the first screen. */
function FilterRow({ children }: { children: React.ReactNode }) {
  return <Stack direction="row" gap={1} sx={{ overflowX: 'auto', py: 1, mb: 1, mx: -0.5, px: 0.5, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>{children}</Stack>
}

function More({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  const { t } = useTranslation()
  if (shown >= total) return null
  return <Button fullWidth variant="text" onClick={onMore} sx={{ mt: 1 }}>{t('sd.showMore', { count: total - shown })}</Button>
}

function BandChip({ r }: { r: ScoreResult }) {
  const { t } = useTranslation()
  return <Chip size="small" label={t(`sd.band.${r.band}`)} sx={{ bgcolor: BAND_COLORS[r.band], color: '#fff', height: 24, fontWeight: 500 }} />
}

function Row({ title, sub, right, onClick, alert }: { title: string; sub?: string; right?: React.ReactNode; onClick?: () => void; alert?: boolean }) {
  return (
    <Card sx={{ borderColor: alert ? 'error.light' : undefined }}>
      <CardActionArea onClick={onClick} disabled={!onClick} sx={{ px: 1.5, py: 1.1, display: 'flex', gap: 1, justifyContent: 'flex-start', alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={500} sx={{ lineHeight: 1.3 }}>{title}</Typography>
          {sub && <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.3 }}>{sub}</Typography>}
        </Box>
        {right}
      </CardActionArea>
    </Card>
  )
}

function Empty({ text }: { text: string }) {
  return <Alert severity="success" icon={<Icon name="check_circle" />}>{text}</Alert>
}

export default function StateDashboard() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const fullDb = useDb()
  const [dist, setDist] = useLS('ks_state_dist', '')
  const [tabS, setTabS] = useLS('ks_state_tab', '0')
  const tab = Number(tabS)
  const db = useMemo(() => scope(fullDb, dist), [fullDb, dist])
  const L = (p: { en: string; gu: string } | undefined) => placeName(p, i18n.language)
  const talName = (id: string) => L(TALUKAS.find(x => x.id === id))
  const where = (f: Facility) => [dist ? '' : L(districtOf(f.district)), talName(f.taluka)].filter(Boolean).join(' · ')

  const scored: Scored[] = useMemo(() => db.facilities.map(f => ({ f, r: computeScore(f, db.checkins) })), [db])
  const approved = scored.filter(x => x.f.status === 'approved')
  const queueAll = scored.filter(x => x.f.status === 'submitted').sort((a, b) => (a.f.submittedAt || '').localeCompare(b.f.submittedAt || ''))
  const openG = db.grievances.filter(g => g.status === 'open')
  const overdueG = openG.filter(g => daysSince(g.at) > ESCALATE_AFTER_DAYS)
  const weekPeople = db.checkins.filter(c => Date.now() - new Date(c.at).getTime() <= 7 * 864e5).reduce((s, c) => s + c.groupSize, 0)

  // ---- filters (each tab keeps its own) ----
  const [qFlag, setQFlag] = useState('all')
  const [qSort, setQSort] = useState('oldest')
  const [qN, setQN] = useState(PAGE)
  const [fSearch, setFSearch] = useState('')
  const [fTal, setFTal] = useState('')
  const [fType, setFType] = useState('')
  const [fSport, setFSport] = useState('')
  const [fBand, setFBand] = useState('')
  const [fNeed, setFNeed] = useState('')
  const [fN, setFN] = useState(PAGE)
  const [dShow, setDShow] = useState('all')
  const [dSort, setDSort] = useState('pending')
  const [gStatus, setGStatus] = useState('open')
  const [gCat, setGCat] = useState('')
  const [gN, setGN] = useState(PAGE)
  const [cStatus, setCStatus] = useState('')
  const [cOpen, setCOpen] = useState<string | null>(null)

  const chooseDistrict = (d: string) => { setDist(d); setFTal('') }
  const distOptions: [string, string][] = [['', t('sd.allGujarat', { count: DISTRICTS.length })], ...[...DISTRICTS].sort((a, b) => L(a).localeCompare(L(b))).map(d => [d.id, L(d)] as [string, string])]

  // Review queue
  const queue = queueAll
    .filter(x => qFlag === 'all' || x.f.photos.some(p => p.flagFar || p.flagDuplicate || p.flagPoorGps))
    .sort((a, b) => qSort === 'oldest' ? 0 : (a.r.score ?? 0) - (b.r.score ?? 0))

  // Facilities
  const stale = (f: Facility) => !f.lastVerifiedAt || Date.now() - new Date(f.lastVerifiedAt).getTime() > 182 * 864e5
  const fewScans = (f: Facility) => weeklyUsersFromQr(db.checkins, f.id).scans < MIN_SCANS_FOR_QR
  const fac = approved.filter(({ f, r }) => {
    if (fSearch && !f.name.toLowerCase().includes(fSearch.toLowerCase())) return false
    if (fTal && f.taluka !== fTal) return false
    if (fType && f.type !== fType) return false
    if (fSport && !f.sports.includes(fSport)) return false
    if (fBand && r.band !== fBand) return false
    if (fNeed === 'repair_priority' || fNeed === 'underused' || fNeed === 'not_women_friendly') return r.tags.includes(fNeed)
    if (fNeed === 'few_scans') return fewScans(f)
    if (fNeed === 'stale') return stale(f)
    return true
  }).sort((a, b) => (a.r.score ?? 0) - (b.r.score ?? 0))

  // Districts / talukas
  const unitRows = (dist ? talukasOf(dist).map(x => ({ id: x.id, name: L(x), match: (f: Facility) => f.taluka === x.id, talukas: 0 }))
    : DISTRICTS.map(d => ({ id: d.id, name: L(d), match: (f: Facility) => f.district === d.id, talukas: talukasOf(d.id).length })))
    .map(u => {
      const fs = fullDb.facilities.filter(u.match)
      const ap = fs.filter(f => f.status === 'approved')
      const ids = new Set(fs.map(f => f.id))
      const od = fullDb.grievances.filter(g => ids.has(g.facilityId) && g.status === 'open' && daysSince(g.at) > ESCALATE_AFTER_DAYS).length
      const pend = fs.filter(f => f.status === 'submitted').length
      const empty = dist ? 0 : talukasOf(u.id).filter(tl => !ap.some(f => f.taluka === tl.id)).length
      const goodOrFair = ap.filter(f => ['green', 'amber'].includes(computeScore(f, fullDb.checkins).band)).length
      const state = fs.length === 0 ? 'notStarted' : dist ? (ap.length === 0 ? 'none' : goodOrFair === 0 ? 'onlyPoor' : 'ok') : 'ok'
      return { ...u, approved: ap.length, pending: pend, overdue: od, empty, state }
    })
    .filter(u => dShow === 'all' || (dShow === 'notStarted' ? u.state === 'notStarted' : dShow === 'pending' ? u.pending > 0 : dShow === 'overdue' ? u.overdue > 0 : dShow === 'gaps' ? (u.state === 'none' || u.state === 'onlyPoor' || u.empty > 0) : true))
    .sort((a, b) => dSort === 'name' ? a.name.localeCompare(b.name) : dSort === 'pending' ? b.pending - a.pending : dSort === 'overdue' ? b.overdue - a.overdue : a.approved - b.approved)

  // Complaints
  const fname = (id: string) => db.facilities.find(f => f.id === id)
  const gList = db.grievances
    .filter(g => gStatus === 'all' || (gStatus === 'open' ? g.status === 'open' : gStatus === 'overdue' ? g.status === 'open' && daysSince(g.at) > ESCALATE_AFTER_DAYS : g.status === 'resolved'))
    .filter(g => !gCat || g.category === gCat)
    .sort((a, b) => a.at.localeCompare(b.at))

  // CWG 2030 (whole state; venues are tagged facilities)
  const allApproved = useMemo(() => fullDb.facilities.filter(f => f.status === 'approved').map(f => ({ f, r: computeScore(f, fullDb.checkins) })), [fullDb])
  const cwgAll = CWG_SPORTS.map(s => {
    const venues = allApproved.filter(x => x.f.cwg !== 'none' && x.f.sports.includes(s))
    const status = venues.length === 0 ? 'gap' : venues.some(v => v.r.band === 'green') ? 'ready' : 'repair'
    return { s, venues, status }
  })
  const cwgRows = cwgAll.filter(r => !cStatus || r.status === cStatus)
  const cwgCount = (s: string) => cwgAll.filter(r => r.status === s).length
  const cwgStyle: Record<string, 'success' | 'warning' | 'error'> = { ready: 'success', repair: 'warning', gap: 'error' }

  const Kpi = ({ icon, label, value, color, to }: { icon: string; label: string; value: number | string; color: string; to: number }) => (
    <Card><CardActionArea onClick={() => setTabS(String(to))} sx={{ p: 1.25, display: 'flex', gap: 1, justifyContent: 'flex-start', alignItems: 'center' }}>
      <Icon name={icon} color={color} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 500, lineHeight: 1.1 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>{label}</Typography>
      </Box>
    </CardActionArea></Card>
  )

  return (
    <>
      <TopBar title={t('state.dashboard')} />
      <Container maxWidth="lg" sx={{ py: 1.5, pb: 6, px: { xs: 1.5, sm: 3 } }}>
        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel shrink>{t('public.district')}</InputLabel>
          <Select label={t('public.district')} value={dist} displayEmpty notched onChange={e => chooseDistrict(e.target.value)} MenuProps={{ PaperProps: { sx: { maxHeight: 420 } } }}
            startAdornment={<InputAdornment position="start"><Icon name="location_city" size={20} /></InputAdornment>}>
            {distOptions.map(([v, l]) => <MenuItem key={v || 'all'} value={v}>{l}</MenuItem>)}
          </Select>
        </FormControl>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1, mb: 1.5 }}>
          <Kpi icon="pending_actions" label={t('state.pending')} value={queueAll.length} color={brand.orange} to={0} />
          <Kpi icon="location_on" label={t('sd.approved')} value={approved.length} color={brand.blue} to={1} />
          <Kpi icon="warning" label={t('state.overdueG')} value={overdueG.length} color="#C62828" to={3} />
          <Kpi icon="how_to_reg" label={t('sd.peopleWeek')} value={weekPeople.toLocaleString('en-IN')} color={brand.green} to={1} />
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTabS(String(v))} variant="scrollable" sx={{ mb: 0.5, minHeight: 44, '& .MuiTab-root': { minHeight: 44, px: 1.5 } }}>
          <Tab label={`${t('sd.tabReview')} (${queueAll.length})`} />
          <Tab label={t('sd.tabFacilities')} />
          <Tab label={dist ? t('sd.tabTalukas') : t('sd.tabDistricts')} />
          <Tab label={`${t('sd.tabComplaints')} (${openG.length})`} />
          <Tab label="CWG 2030" />
          <Tab label={t('ch.tab')} />
        </Tabs>

        {tab === 0 && (
          <>
            <FilterRow>
              <Pick label={t('sd.show')} value={qFlag} onChange={setQFlag} options={[['all', t('sd.allEntries')], ['flagged', t('sd.flaggedOnly')]]} />
              <Pick label={t('sd.sort')} value={qSort} onChange={setQSort} options={[['oldest', t('sd.oldestFirst')], ['score', t('sd.lowestScore')]]} />
            </FilterRow>
            <Stack spacing={1}>
              {queue.length === 0 && <Empty text={t('state.allClear')} />}
              {queue.slice(0, qN).map(({ f, r }) => {
                const flags = f.photos.filter(p => p.flagFar || p.flagDuplicate || p.flagPoorGps).length
                return <Row key={f.id} title={f.name} onClick={() => nav(`/state/review/${f.id}`)}
                  sub={`${where(f)} · ${t('dso.daysOpen', { count: daysSince(f.submittedAt || f.updatedAt) })}${f.published ? ` · ${t('sd.edit')}` : ''}`}
                  right={<Stack alignItems="flex-end" gap={0.5}><BandChip r={r} />{flags > 0 && <Chip size="small" color="warning" icon={<Icon name="flag" size={14} />} label={flags} sx={{ height: 22 }} />}</Stack>} />
              })}
            </Stack>
            <More shown={qN} total={queue.length} onMore={() => setQN(qN + PAGE)} />
          </>
        )}

        {tab === 1 && (
          <>
            <TextField size="small" placeholder={t('sd.searchName')} value={fSearch} onChange={e => { setFSearch(e.target.value); setFN(PAGE) }} sx={{ mt: 1 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="search" size={20} /></InputAdornment> }} />
            <FilterRow>
              <Pick label={t('sd.needs')} value={fNeed} width={190} onChange={v => { setFNeed(v); setFN(PAGE) }} options={[['', t('common.all')], ['repair_priority', t('tag.repair_priority')], ['underused', t('tag.underused')], ['not_women_friendly', t('tag.not_women_friendly')], ['few_scans', t('sd.fewScans')], ['stale', t('sd.stale')]]} />
              <Pick label={t('sd.condition')} value={fBand} width={130} onChange={v => { setFBand(v); setFN(PAGE) }} options={[['', t('common.all')], ['green', t('sd.band.green')], ['amber', t('sd.band.amber')], ['red', t('sd.band.red')]]} />
              {dist && <Pick label={t('public.taluka')} value={fTal} width={150} onChange={v => { setFTal(v); setFN(PAGE) }} options={[['', t('common.all')], ...talukasOf(dist).map(x => [x.id, L(x)] as [string, string])]} />}
              <Pick label={t('public.sport')} value={fSport} width={140} onChange={v => { setFSport(v); setFN(PAGE) }} options={[['', t('common.all')], ...SPORTS.map(s => [s, t(`sport.${s}`)] as [string, string])]} />
              <Pick label={t('public.type')} value={fType} width={150} onChange={v => { setFType(v); setFN(PAGE) }} options={[['', t('common.all')], ...FACILITY_TYPES.map(s => [s, t(`type.${s}`)] as [string, string])]} />
            </FilterRow>
            <Stack direction="row" alignItems="center" sx={{ mb: 1 }} gap={1}>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{t('sd.found', { count: fac.length })}</Typography>
              <ExportButton facilities={fac.map(x => x.f)} db={db} fileTag={dist ? districtOf(dist)?.en || dist : 'Gujarat'} filters={([
                [t('public.district', { lng: 'en' }), dist ? districtOf(dist)?.en || dist : 'All Gujarat'],
                ['Status', 'Approved'],
                ...(fSearch ? [['Name contains', fSearch]] : []),
                ...(fNeed ? [[t('sd.needs', { lng: 'en' }), fNeed === 'few_scans' ? t('sd.fewScans', { lng: 'en' }) : fNeed === 'stale' ? t('sd.stale', { lng: 'en' }) : t(`tag.${fNeed}`, { lng: 'en' })]] : []),
                ...(fBand ? [[t('sd.condition', { lng: 'en' }), t(`sd.band.${fBand}`, { lng: 'en' })]] : []),
                ...(fTal ? [[t('public.taluka', { lng: 'en' }), TALUKAS.find(x => x.id === fTal)?.en || fTal]] : []),
                ...(fSport ? [[t('public.sport', { lng: 'en' }), t(`sport.${fSport}`, { lng: 'en' })]] : []),
                ...(fType ? [[t('public.type', { lng: 'en' }), t(`type.${fType}`, { lng: 'en' })]] : []),
              ] as [string, string][])} />
            </Stack>
            <Stack spacing={1}>
              {fac.slice(0, fN).map(({ f, r }) => (
                <Row key={f.id} title={f.name} onClick={() => nav(`/state/review/${f.id}`)} sub={`${where(f)} · ${t(`type.${f.type}`)}`}
                  right={<Stack alignItems="flex-end" gap={0.5}><BandChip r={r} />{r.tags.filter(x => x !== 'not_women_friendly').map(x => <Typography key={x} variant="caption" color="text.secondary">{t(`tag.${x}`)}</Typography>)}</Stack>} />
              ))}
            </Stack>
            <More shown={fN} total={fac.length} onMore={() => setFN(fN + PAGE)} />
          </>
        )}

        {tab === 2 && (
          <>
            <FilterRow>
              <Pick label={t('sd.show')} value={dShow} width={180} onChange={setDShow} options={[['all', t('common.all')], ...(dist ? [] : [['notStarted', t('sd.notStarted')] as [string, string]]), ['gaps', dist ? t('sd.talukaGaps') : t('sd.hasGaps')], ['pending', t('sd.hasPending')], ['overdue', t('sd.hasOverdue')]]} />
              <Pick label={t('sd.sort')} value={dSort} width={170} onChange={setDSort} options={[['name', t('sd.byName')], ['pending', t('sd.mostPending')], ['overdue', t('sd.mostOverdue')], ['fewest', t('sd.fewestFacilities')]]} />
            </FilterRow>
            <Stack direction="row" sx={{ px: 1.5, pb: 0.5 }} gap={1}>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{dist ? t('public.taluka') : t('public.district')}</Typography>
              {[t('sd.colApproved'), t('sd.colPending'), t('sd.colOverdue')].map(h => <Typography key={h} variant="caption" color="text.secondary" sx={{ width: 58, textAlign: 'center', lineHeight: 1.2 }}>{h}</Typography>)}
            </Stack>
            <Stack spacing={0.75}>
              {unitRows.map(u => (
                <Card key={u.id} sx={{ borderColor: u.overdue ? 'error.light' : undefined }}>
                  <CardActionArea onClick={dist ? undefined : () => chooseDistrict(u.id)} disabled={!!dist} sx={{ px: 1.5, py: 1, display: 'flex', gap: 1, justifyContent: 'flex-start', alignItems: 'center' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={500} sx={{ lineHeight: 1.25 }}>{u.name}</Typography>
                      {u.state === 'notStarted' && <Typography variant="caption" color="text.secondary">{t('sd.notStarted')}</Typography>}
                      {u.state === 'none' && <Typography variant="caption" color="error.main">{t('cov.none')}</Typography>}
                      {u.state === 'onlyPoor' && <Typography variant="caption" color="warning.dark">{t('cov.onlyPoor')}</Typography>}
                      {!dist && u.state !== 'notStarted' && u.empty > 0 && <Typography variant="caption" color="error.main">{t('sd.talukasWithout', { count: u.empty, total: u.talukas })}</Typography>}
                    </Box>
                    {[u.approved, u.pending, u.overdue].map((n, i) => (
                      <Typography key={i} sx={{ width: 58, textAlign: 'center', fontWeight: n && i === 2 ? 700 : 500, color: !n ? 'text.disabled' : i === 2 ? 'error.main' : 'text.primary' }}>{n}</Typography>
                    ))}
                  </CardActionArea>
                </Card>
              ))}
              {unitRows.length === 0 && <Empty text={t('sd.nothing')} />}
            </Stack>
          </>
        )}

        {tab === 3 && (
          <>
            <FilterRow>
              <Pick label={t('sd.show')} value={gStatus} width={150} onChange={v => { setGStatus(v); setGN(PAGE) }} options={[['open', t('sd.openAll')], ['overdue', t('dso.overdue')], ['resolved', t('dso.resolved')], ['all', t('common.all')]]} />
              <Pick label={t('qr.category')} value={gCat} width={190} onChange={v => { setGCat(v); setGN(PAGE) }} options={[['', t('common.all')], ...GRIEVANCE_CATEGORIES.map(c => [c, t(`gcat.${c}`)] as [string, string])]} />
            </FilterRow>
            <Stack spacing={1}>
              {gList.length === 0 && <Empty text={t('sd.nothing')} />}
              {gList.slice(0, gN).map(g => {
                const d = daysSince(g.at)
                const od = g.status === 'open' && d > ESCALATE_AFTER_DAYS
                const f = fname(g.facilityId)
                return <Row key={g.id} alert={od} title={t(`gcat.${g.category}`)} onClick={f ? () => nav(`/state/review/${f.id}`) : undefined}
                  sub={`${f?.name || ''} · ${f ? where(f) : ''} · ${g.status === 'resolved' ? t('dso.resolved') : t('dso.daysOpen', { count: d })}`}
                  right={g.status === 'resolved' ? <Chip size="small" color="success" label={t('dso.resolved')} /> : <Chip size="small" color={od ? 'error' : 'warning'} label={od ? t('dso.overdue') : t('dso.open')} />} />
              })}
            </Stack>
            <More shown={gN} total={gList.length} onMore={() => setGN(gN + PAGE)} />
          </>
        )}

        {tab === 4 && (
          <>
            <FilterRow>
              <Pick label={t('sd.show')} value={cStatus} width={170} onChange={setCStatus} options={[['', `${t('common.all')} (${CWG_SPORTS.length})`], ['ready', `${t('sd.cwg.ready')} (${cwgCount('ready')})`], ['repair', `${t('sd.cwg.repair')} (${cwgCount('repair')})`], ['gap', `${t('sd.cwg.gap')} (${cwgCount('gap')})`]]} />
            </FilterRow>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('sd.cwg.howTo')}</Typography>
            <Stack spacing={0.75}>
              {cwgRows.map(row => (
                <Card key={row.s}>
                  <CardActionArea onClick={() => setCOpen(cOpen === row.s ? null : row.s)} disabled={!row.venues.length} sx={{ px: 1.5, py: 1.1, display: 'flex', gap: 1, justifyContent: 'flex-start', alignItems: 'center' }}>
                    <Typography fontWeight={500} sx={{ flex: 1 }}>{t(`sport.${row.s}`)}</Typography>
                    <Typography variant="body2" color="text.secondary">{t('sd.cwg.venues', { count: row.venues.length })}</Typography>
                    <Chip size="small" color={cwgStyle[row.status]} label={t(`sd.cwg.${row.status}`)} sx={{ minWidth: 92 }} />
                    {row.venues.length > 0 && <Icon name={cOpen === row.s ? 'expand_less' : 'expand_more'} color="#5B6B7E" />}
                  </CardActionArea>
                  {cOpen === row.s && (
                    <Stack sx={{ px: 1.5, pb: 1.25 }} spacing={0.75}>
                      {row.venues.map(v => (
                        <Stack key={v.f.id} direction="row" alignItems="center" gap={1} onClick={() => nav(`/state/review/${v.f.id}`)} sx={{ cursor: 'pointer', p: 1, borderRadius: '10px', bgcolor: '#F3F6FA' }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={500}>{v.f.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{t(`cwg.${v.f.cwg}`)}</Typography>
                          </Box>
                          <BandChip r={v.r} />
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Card>
              ))}
            </Stack>
          </>
        )}

        {tab === 5 && <StateCharts db={db} dist={dist} />}

        <Box sx={{ mt: 4, textAlign: 'right' }}>
          <Button size="small" color="inherit" startIcon={<Icon name="restart_alt" />} onClick={() => { if (confirm(REMOTE ? t('sd.loadDemoConfirm') : t('common.resetDemo') + '?')) resetDemo() }}>{REMOTE ? t('sd.loadDemo') : t('common.resetDemo')}</Button>
        </Box>
      </Container>
    </>
  )
}
