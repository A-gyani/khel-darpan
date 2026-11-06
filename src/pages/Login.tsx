import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Stack, Tab, Tabs, TextField, Typography, InputAdornment } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, LangButton } from '../components/ui'
import { login, phoneRegistered } from '../data/store'
import { DEMO_OTP } from '../lib/constants'
import { home } from '../lib/routes'

// Put the login photo at public/brand/login-photo.jpg — until then a placeholder is shown.
function PhotoSpace() {
  const { t } = useTranslation()
  const [missing, setMissing] = useState(false)
  return (
    <Box sx={{ position: 'relative', flex: { md: 1 }, height: { xs: '30dvh', md: 'auto' }, minHeight: { xs: 180, md: '100vh' }, maxHeight: { xs: 280, md: 'none' }, bgcolor: '#E3ECF6', overflow: 'hidden', flexShrink: 0 }}>
      {!missing && (
        <Box component="img" src="./brand/login-photo.jpg" alt="" onError={() => setMissing(true)}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {missing && (
        <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, color: '#5B6B7E', border: '2px dashed #A9BBD0', m: 2, borderRadius: '16px' }}>
          <Icon name="add_photo_alternate" size={44} />
          <Typography sx={{ mt: 1 }} fontWeight={500}>{t('login.photoSpace')}</Typography>
          <Typography variant="body2">{t('login.photoHint')}</Typography>
        </Stack>
      )}
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: { xs: 1.5, md: 4 }, background: 'linear-gradient(transparent, rgba(0,0,0,.55))', color: '#fff' }}>
        <Typography sx={{ fontSize: { xs: '1.25rem', md: '2.2rem' }, fontWeight: 600, lineHeight: 1.2 }}>{t('app.name')}</Typography>
        <Typography sx={{ opacity: 0.9, fontSize: { xs: 13, md: 16 } }}>{t('app.tagline')}</Typography>
      </Box>
    </Box>
  )
}

export default function Login() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [tab, setTab] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [err, setErr] = useState('')

  const [busy, setBusy] = useState(false)
  async function doEmail(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    const u = await login(email.trim(), password)
    setBusy(false)
    if (!u) return setErr(t('login.error'))
    nav(home(u.role))
  }
  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const ok = await phoneRegistered(phone.trim())
    setBusy(false)
    if (!ok) return setErr(t('login.noUser'))
    setErr(''); setOtpSent(true)
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (otp !== DEMO_OTP) return setErr(t('login.otpError'))
    setBusy(true)
    const u = await login(phone.trim())
    setBusy(false)
    if (u) nav(home(u.role)); else setErr(t('login.error'))
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box sx={{ position: { xs: 'relative', md: 'static' }, display: 'flex', flex: { md: 1 } }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}><PhotoSpace /></Box>
        <Stack direction="row" sx={{ position: 'absolute', top: 'calc(8px + env(safe-area-inset-top))', left: 8, right: 8, zIndex: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => nav('/map')} startIcon={<Icon name="arrow_back" />} sx={{ bgcolor: 'rgba(255,255,255,.92)', '&:hover': { bgcolor: '#fff' }, px: 1.5 }}>{t('login.backToSearch')}</Button>
          <Box sx={{ bgcolor: 'rgba(255,255,255,.92)', borderRadius: 100 }}><LangButton /></Box>
        </Stack>
      </Box>
      <Stack sx={{ width: { xs: '100%', md: 480 }, px: { xs: 2, md: 5 }, py: { xs: 2, md: 5 }, pb: 'calc(16px + env(safe-area-inset-bottom))', justifyContent: { md: 'center' }, mx: 'auto', maxWidth: 520, bgcolor: 'background.default' }}>
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
          <Box component="img" src="./brand/sag-logo.png" alt="Sports Authority of Gujarat" sx={{ height: { xs: 44, md: 56 }, flexShrink: 0 }} />
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1, lineHeight: 1.3 }}>{t('app.dept')}</Typography>
          <Box sx={{ height: 44, width: 64, flexShrink: 0, border: '1px dashed #C4CFDB', borderRadius: '10px', display: 'grid', placeItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" align="center" sx={{ fontSize: 10, lineHeight: 1.1 }}>Govt.<br />logo</Typography>
          </Box>
        </Stack>

        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h3">{t('login.title')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('login.subtitle')}</Typography>
            <Tabs value={tab} onChange={(_, v) => { setTab(v); setErr('') }} variant="fullWidth" sx={{ mb: 2 }}>
              <Tab icon={<Icon name="mail" />} iconPosition="start" label={t('login.tabEmail')} />
              <Tab icon={<Icon name="smartphone" />} iconPosition="start" label={t('login.tabOtp')} />
            </Tabs>
            {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
            {tab === 0 && (
              <Stack component="form" spacing={2} onSubmit={doEmail}>
                <TextField label={t('login.email')} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
                <TextField label={t('login.password')} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                <Button type="submit" variant="contained" size="large" disabled={busy} endIcon={<Icon name="arrow_forward" />}>{t('login.title')}</Button>
              </Stack>
            )}
            {tab === 1 && !otpSent && (
              <Stack component="form" spacing={2} onSubmit={sendOtp}>
                <TextField label={t('login.mobile')} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  inputMode="numeric" InputProps={{ startAdornment: <InputAdornment position="start">+91</InputAdornment> }} />
                <Button type="submit" variant="contained" size="large" disabled={busy || phone.length !== 10} endIcon={<Icon name="sms" />}>{t('login.sendOtp')}</Button>
              </Stack>
            )}
            {tab === 1 && otpSent && (
              <Stack component="form" spacing={2} onSubmit={verify}>
                <Alert severity="info" icon={<Icon name="info" />}>{t('login.demoOtp', { otp: DEMO_OTP })}</Alert>
                <TextField label={t('login.otp')} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus
                  inputProps={{ style: { letterSpacing: 8, fontSize: 22, textAlign: 'center' } }} />
                <Button type="submit" variant="contained" size="large" disabled={busy || otp.length !== 6} endIcon={<Icon name="arrow_forward" />}>{t('login.verify')}</Button>
                <Button variant="text" onClick={() => { setOtpSent(false); setOtp('') }}>{t('common.back')}</Button>
              </Stack>
            )}
          </CardContent>
        </Card>

        <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 2 }}>{t('login.publicHint')}</Typography>
      </Stack>
    </Box>
  )
}
