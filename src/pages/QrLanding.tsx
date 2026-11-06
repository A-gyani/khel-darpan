import { useEffect, useState } from 'react'
import { Alert, Box, Button, Card, CardActionArea, Chip, Container, Stack, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon, TopBar, Stars, NotFound } from '../components/ui'
import { useDb, publicFacilities, addCheckIn, addGrievance, addRating, checkInsLeftToday, ratedToday } from '../data/store'
import { GRIEVANCE_CATEGORIES } from '../lib/constants'
import type { CheckIn, GrievanceCategory } from '../lib/types'

function ChipPick<T extends string | number>({ label, options, value, onChange, render }: { label: string; options: T[]; value: T | ''; onChange: (v: T) => void; render: (v: T) => string }) {
  return (
    <Box>
      <Typography fontWeight={500} sx={{ mb: 1 }}>{label}</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap">
        {options.map(o => (
          <Chip key={String(o)} label={render(o)} onClick={() => onChange(o)} color={o === value ? 'primary' : 'default'}
            variant={o === value ? 'filled' : 'outlined'} sx={{ height: 40, fontSize: 15, px: 0.5 }}
            icon={o === value ? <Icon name="check" size={18} color="#fff" /> : undefined} />
        ))}
      </Stack>
    </Box>
  )
}

const ICONS: Record<string, string> = {
  closed_when_should_be_open: 'door_front', damaged: 'construction', unsafe: 'warning', wrong_info: 'info',
  fee_issue: 'currency_rupee', staff: 'person_alert', other: 'more_horiz',
}

export default function QrLanding() {
  const { id, mode } = useParams()
  const { t } = useTranslation()
  const nav = useNavigate()
  const db = useDb()
  const f = publicFacilities(db).find(x => x.id === id)

  const [ci, setCi] = useState<Partial<Omit<CheckIn, 'id' | 'at' | 'facilityId'>>>({ groupSize: 1 })
  const [done, setDone] = useState<'' | 'checkin' | 'limit' | 'report' | 'rate'>('')
  const [ref, setRef] = useState('')
  const [cat, setCat] = useState<GrievanceCategory | ''>('')
  const [desc, setDesc] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [rt, setRt] = useState({ overall: 0, cleanliness: 0, onTime: 0, staff: 0, comment: '' })

  // Start each screen fresh: the same page component is reused when moving between QR home, check-in, report and rate
  useEffect(() => {
    setDone(''); setCi({ groupSize: 1 }); setRef(''); setCat(''); setDesc(''); setPhoto(null)
    setRt({ overall: 0, cleanliness: 0, onTime: 0, staff: 0, comment: '' })
    window.scrollTo(0, 0)
  }, [id, mode])

  if (!f) return <NotFound />
  const base = `/q/${f.id}`

  function readPhoto(file: File) {
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => {
        const s = Math.min(1, 1024 / Math.max(img.width, img.height))
        const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        setPhoto(c.toDataURL('image/jpeg', 0.7))
      }
      img.src = r.result as string
    }
    r.readAsDataURL(file)
  }

  const header = (
    <Stack direction="row" gap={1.5} alignItems="center" sx={{ mb: 3 }}>
      <Box component="img" src={f.photos[1]?.thumbUrl || f.photos[0]?.thumbUrl} alt="" sx={{ width: 72, height: 72, borderRadius: '12px', objectFit: 'cover' }} />
      <Box>
        <Typography variant="body2" color="text.secondary">{t('qr.welcome')}</Typography>
        <Typography variant="h3">{f.name}</Typography>
      </Box>
    </Stack>
  )

  const doneScreen = (icon: string, title: string, body?: React.ReactNode) => (
    <Stack alignItems="center" spacing={2} sx={{ py: 6, textAlign: 'center' }}>
      <Box sx={{ width: 88, height: 88, borderRadius: '50%', bgcolor: '#DCF2E1', display: 'grid', placeItems: 'center' }}><Icon name={icon} size={48} color="#1D6B33" fill /></Box>
      <Typography variant="h2">{title}</Typography>
      {body}
      <Button variant="outlined" onClick={() => nav(`/f/${f.id}`)} endIcon={<Icon name="arrow_forward" />}>{t('qr.openPage')}</Button>
      <Button variant="text" onClick={() => nav(base)} startIcon={<Icon name="qr_code_2" />}>{t('qr.moreActions')}</Button>
    </Stack>
  )

  let content: React.ReactNode
  if (done === 'checkin') content = doneScreen('how_to_reg', t('qr.thanks'), <Typography>{t('qr.checkedIn')}</Typography>)
  else if (done === 'limit') content = doneScreen('info', t('qr.thanks'), <Alert severity="info">{t('qr.limit')}</Alert>)
  else if (done === 'report') content = doneScreen('task_alt', t('qr.sent'), (
    <Box>
      <Typography color="text.secondary">{t('qr.refNo')}</Typography>
      <Typography variant="h2" sx={{ letterSpacing: 1, my: 1, color: 'primary.main' }}>{ref}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>{t('qr.refHint')}</Typography>
    </Box>
  ))
  else if (done === 'rate') content = doneScreen('star', t('qr.rated'))
  else if (!mode) {
    const btn = (to: string, icon: string, title: string, sub: string, color: string) => (
      <Card sx={{ borderColor: color }}>
        <CardActionArea onClick={() => nav(`${base}/${to}`)} sx={{ p: 2.5, display: 'flex', justifyContent: 'flex-start', gap: 2 }}>
          <Box sx={{ width: 60, height: 60, borderRadius: '16px', bgcolor: color, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={icon} size={34} color="#fff" fill /></Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h3">{title}</Typography>
            <Typography variant="body2" color="text.secondary">{sub}</Typography>
          </Box>
          <Icon name="chevron_right" color="#5B6B7E" />
        </CardActionArea>
      </Card>
    )
    content = (
      <Stack spacing={2}>
        {btn('checkin', 'how_to_reg', t('qr.checkIn'), t('qr.checkInSub'), '#1B6FB8')}
        {btn('report', 'report', t('qr.report'), t('qr.reportSub'), '#C62828')}
        {btn('rate', 'star', t('qr.rate'), t('qr.rateSub'), '#F08A1C')}
      </Stack>
    )
  } else if (mode === 'checkin') {
    const left = checkInsLeftToday(f.id)
    const ok = ci.sport && ci.role && ci.gender && ci.ageGroup
    content = left <= 0 ? doneScreen('info', t('qr.thanks'), <Alert severity="info">{t('qr.limit')}</Alert>) : (
      <Stack spacing={3}>
        <ChipPick label={t('qr.sport')} options={f.sports} value={ci.sport || ''} onChange={v => setCi({ ...ci, sport: v })} render={v => t(`sport.${v}`)} />
        <ChipPick label={t('qr.role')} options={['player', 'coach', 'parent', 'visitor'] as const as unknown as CheckIn['role'][]} value={ci.role || ''} onChange={v => setCi({ ...ci, role: v })} render={v => t(`qr.roles.${v}`)} />
        <ChipPick label={t('qr.gender')} options={['female', 'male', 'other', 'na'] as CheckIn['gender'][]} value={ci.gender || ''} onChange={v => setCi({ ...ci, gender: v })} render={v => t(`qr.genders.${v}`)} />
        <ChipPick label={t('qr.age')} options={['u14', '14_18', '19_25', '26_40', '40plus', 'na'] as CheckIn['ageGroup'][]} value={ci.ageGroup || ''} onChange={v => setCi({ ...ci, ageGroup: v })} render={v => t(`qr.ages.${v}`)} />
        <ChipPick label={t('qr.group')} options={[1, 2, 3, 4, 5, 10, 15, 20]} value={ci.groupSize || 1} onChange={v => setCi({ ...ci, groupSize: v })} render={v => (v >= 10 ? `${v}+` : String(v))} />
        <Button size="large" variant="contained" disabled={!ok || left <= 0} startIcon={<Icon name="how_to_reg" />}
          onClick={() => setDone(addCheckIn({ facilityId: f.id, ...(ci as Omit<CheckIn, 'id' | 'at' | 'facilityId'>) }) ? 'checkin' : 'limit')}>
          {t('qr.checkIn')}
        </Button>
      </Stack>
    )
  } else if (mode === 'report') {
    content = (
      <Stack spacing={3}>
        <Box>
          <Typography fontWeight={500} sx={{ mb: 1 }}>{t('qr.category')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1 }}>
            {GRIEVANCE_CATEGORIES.map(c => (
              <Card key={c} sx={{ borderColor: cat === c ? 'error.main' : undefined, bgcolor: cat === c ? '#FDECEC' : undefined }}>
                <CardActionArea onClick={() => setCat(c)} sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, minHeight: 88 }}>
                  <Icon name={ICONS[c]} color={cat === c ? '#C62828' : '#5B6B7E'} />
                  <Typography variant="body2" align="center">{t(`gcat.${c}`)}</Typography>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Box>
        <TextField label={t('qr.describe')} multiline minRows={3} value={desc} onChange={e => setDesc(e.target.value)} />
        <Box>
          <Button component="label" variant="outlined" startIcon={<Icon name="add_a_photo" />}>
            {t('qr.addPhoto')}
            <input hidden type="file" accept="image/*" onChange={e => e.target.files?.[0] && readPhoto(e.target.files[0])} />
          </Button>
          {photo && <Box component="img" src={photo} alt="" sx={{ display: 'block', mt: 1, maxWidth: 220, borderRadius: '10px' }} />}
        </Box>
        <Button size="large" variant="contained" color="error" disabled={!cat} startIcon={<Icon name="send" />}
          onClick={() => { setRef(addGrievance({ facilityId: f.id, category: cat as GrievanceCategory, description: desc, photo })); setDone('report') }}>
          {t('qr.sendReport')}
        </Button>
      </Stack>
    )
  } else if (mode === 'rate' && ratedToday(f.id)) {
    content = doneScreen('star', t('qr.rated'), <Alert severity="info">{t('qr.rateLimit')}</Alert>)
  } else if (mode === 'rate') {
    const row = (k: 'overall' | 'cleanliness' | 'onTime' | 'staff', big = false) => (
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Typography fontWeight={big ? 500 : 400}>{t(`qr.${k}`)}</Typography>
        <Stars value={rt[k]} onChange={v => setRt({ ...rt, [k]: v })} size={big ? 'large' : 'medium'} />
      </Stack>
    )
    content = (
      <Stack spacing={2.5}>
        {row('overall', true)}
        {row('cleanliness')}
        {row('onTime')}
        {row('staff')}
        <TextField label={t('qr.comment')} multiline minRows={2} value={rt.comment} onChange={e => setRt({ ...rt, comment: e.target.value })} />
        <Button size="large" variant="contained" color="secondary" disabled={!rt.overall} startIcon={<Icon name="send" />}
          onClick={() => { addRating({ facilityId: f.id, ...rt }); setDone('rate') }}>{t('qr.sendRating')}</Button>
      </Stack>
    )
  }

  return (
    <>
      <TopBar back={mode && !done ? base : `/f/${f.id}`} title={mode === 'checkin' ? t('qr.checkIn') : mode === 'report' ? t('qr.report') : mode === 'rate' ? t('qr.rate') : t('app.name')} />
      <Container maxWidth="sm" sx={{ py: 3, pb: 8 }}>
        {header}
        {content}
      </Container>
    </>
  )
}
