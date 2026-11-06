// State dashboard "Charts" tab: three charts that follow the district dropdown.
// 1 approved facilities by sport · 2 Health Score bands per district (per taluka when one district is chosen)
// 3 people checking in by QR over time, women and men.
import { useMemo, useState } from 'react'
import { Box, Card, CardContent, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import { Icon } from './ui'
import { computeScore, BAND_COLORS } from '../lib/score'
import { DISTRICTS, SPORTS, talukasOf, placeName } from '../lib/constants'
import type { DB } from '../lib/types'
import { brand } from '../theme'

const BANDS = ['green', 'amber', 'red', 'grey'] as const
const axis = { fontSize: 11, fill: '#5B6B7E' }
const grid = '#E6EBF1'
const tip = { itemStyle: { color: '#1F2A37' }, labelStyle: { fontWeight: 500 } }

function ChartCard({ title, icon, note, children }: { title: string; icon: string; note?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: note ? 0.25 : 1 }}>
          <Icon name={icon} size={20} color="#5B6B7E" /><Typography fontWeight={500}>{title}</Typography>
        </Stack>
        {note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{note}</Typography>}
        {children}
      </CardContent>
    </Card>
  )
}

/** db = already limited to the chosen district ('' = whole state). */
export function StateCharts({ db, dist }: { db: DB; dist: string }) {
  const { t, i18n } = useTranslation()
  const L = (p: { en: string; gu: string } | undefined) => placeName(p, i18n.language)
  const [period, setPeriod] = useState('w12')
  const approved = useMemo(() => db.facilities.filter(f => f.status === 'approved').map(f => ({ f, r: computeScore(f, db.checkins) })), [db])

  // 1 · by sport (only sports that have at least one facility)
  const sportData = SPORTS.map(s => ({ name: t(`sport.${s}`), n: approved.filter(x => x.f.sports.includes(s)).length }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n)

  // 2 · bands per district / taluka (units with no approved facility are left out and counted in the note)
  const units = dist ? talukasOf(dist).map(x => ({ id: x.id, name: L(x), key: 'taluka' as const })) : DISTRICTS.map(d => ({ id: d.id, name: L(d), key: 'district' as const }))
  const bandAll = units.map(u => {
    const xs = approved.filter(x => x.f[u.key] === u.id)
    const row: Record<string, string | number> = { name: u.name, total: xs.length }
    for (const b of BANDS) row[b] = xs.filter(x => x.r.band === b).length
    return row
  })
  const bandData = bandAll.filter(r => (r.total as number) > 0).sort((a, b) => (b.total as number) - (a.total as number))
  const missing = bandAll.length - bandData.length

  // 3 · QR check-ins over time (people = group sizes added up)
  const trend = useMemo(() => {
    const monthly = period === 'm12'
    const n = period === 'w4' ? 4 : 12
    const fmt = (d: Date) => d.toLocaleDateString(i18n.language === 'gu' ? 'gu-IN' : 'en-IN', monthly ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
    const now = new Date()
    return Array.from({ length: n }, (_, i) => {
      const k = n - 1 - i
      let start: Date, end: Date
      if (monthly) { start = new Date(now.getFullYear(), now.getMonth() - k, 1); end = new Date(now.getFullYear(), now.getMonth() - k + 1, 1) }
      else { end = new Date(now.getTime() - k * 7 * 864e5); start = new Date(end.getTime() - 7 * 864e5) }
      const cs = db.checkins.filter(c => { const ts = new Date(c.at).getTime(); return ts >= start.getTime() && ts < end.getTime() })
      const sum = (g: string) => cs.filter(c => c.gender === g).reduce((s, c) => s + (c.groupSize || 1), 0)
      return { name: fmt(monthly ? start : new Date(end.getTime() - 864e5)), female: sum('female'), male: sum('male') }
    })
  }, [db.checkins, period, i18n.language])
  const anyCheckins = trend.some(x => x.female + x.male > 0)

  const empty = <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>{t('common.noData')}</Typography>
  const yW = 112

  return (
    <Stack spacing={1.5} sx={{ mt: 1 }}>
      <ChartCard title={t('ch.bySport')} icon="sports" note={t('ch.bySportNote')}>
        {sportData.length === 0 ? empty : (
          <ResponsiveContainer width="100%" height={sportData.length * 28 + 30}>
            <BarChart data={sportData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }} barCategoryGap={4}>
              <CartesianGrid horizontal={false} stroke={grid} />
              <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={yW} tick={axis} interval={0} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#F3F6FA' }} {...tip} />
              <Bar dataKey="n" fill={brand.blue} radius={[0, 4, 4, 0]} name={t('state.facilities')}><LabelList dataKey="n" position="right" fontSize={11} fill="#3A4A5C" /></Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title={dist ? t('ch.bandsTaluka') : t('ch.bandsDistrict')} icon="health_metrics"
        note={missing > 0 ? t(dist ? 'ch.talukasMissing' : 'ch.districtsMissing', { count: missing }) : undefined}>
        {bandData.length === 0 ? empty : (
          <ResponsiveContainer width="100%" height={bandData.length * 36 + 90}>
            <BarChart data={bandData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }} barCategoryGap={4}>
              <CartesianGrid horizontal={false} stroke={grid} />
              <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={yW} tick={axis} interval={0} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#F3F6FA' }} {...tip} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              {BANDS.map(b => <Bar key={b} dataKey={b} stackId="s" fill={BAND_COLORS[b]} name={t(`band.${b}`)} stroke="#fff" strokeWidth={1} />)}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title={t('ch.checkins')} icon="trending_up" note={t('ch.checkinsNote')}>
        <FormControl size="small" sx={{ minWidth: 170, mb: 1 }}>
          <InputLabel shrink>{t('ch.period')}</InputLabel>
          <Select label={t('ch.period')} value={period} notched onChange={e => setPeriod(e.target.value)}>
            <MenuItem value="w4">{t('ch.w4')}</MenuItem>
            <MenuItem value="w12">{t('ch.w12')}</MenuItem>
            <MenuItem value="m12">{t('ch.m12')}</MenuItem>
          </Select>
        </FormControl>
        {!anyCheckins ? empty : (
          <Box sx={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: -16, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={grid} />
                <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
                <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
                <Tooltip {...tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="female" name={t('ch.women')} stroke={brand.orange} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line dataKey="male" name={t('ch.men')} stroke={brand.blue} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </ChartCard>
    </Stack>
  )
}
