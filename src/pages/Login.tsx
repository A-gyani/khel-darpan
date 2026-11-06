import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Divider, Stack, Tab, Tabs, TextField, Typography, InputAdornment } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui'
import { toggleLang } from '../i18n'
import { login, findUserByPhone } from '../data/store'
import { DEMO_OTP } from '../lib/constants'
import { home } from '../lib/routes'

// Put the login photo at public/brand/login-photo.jpg — until then a placeholder is shown.
function PhotoSpace() {
  const { t } = useTranslation()
  const [missing, setMissing] = useState(false)
  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: { xs: 240, md: '100vh' }, bgcolor: '#E3ECF6', overflow: 'hidden' }}>
      {!missing && (
        <Box component="img" src="./brand/login-photo.jpg" alt="" onError={() => setMissing(true)}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {missing && (
        <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, color: '#5B6B7E', border: '2px dashed #A9BBD0', m: 2, borderRadius: 4 }}>
          <Icon name="add_photo_alternate" size={56} />
          <Typography sx={{ mt: 1 }} fontWeight={500}>{t('login.photoSpace')}</Typography>
          <Typography variant="body2">{t('login.photoHint')}</Typography>
        </Stack>
      )}
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: { xs: 2, md: 4 }, background: 'linear-gradient(transparent, rgba(0,0,0,.55))', color: '#fff' }}>
        <Typography variant="h2" sx={{ fontSize: { xs: '1.4rem', md: '2.2rem' } }}>{t('app.name')}</Typography>
        <Typography sx={{ opacity: 0.9 }}>{t('app.tagline')}</Typography>
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

  function doEmail(e: React.FormEvent) {
    e.preventDefault()
    const u = login(email.trim(), password)
    if (!u) return setErr(t('login.error'))
    nav(home(u.role))
  }
  function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!findUserByPhone(phone.trim())) return setErr(t('login.noUser'))
    setErr(''); setOtpSent(true)
  }
  function verify(e: React.FormEvent) {
    e.preventDefault()
    if (otp !== DEMO_OTP) return setErr(t('login.otpError'))
    const u = login(phone.trim())
    if (u) nav(home(u.role))
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: '100vh' }}>
      <PhotoSpace />
      <Stack sx={{ width: { xs: '100%', md: 480 }, p: { xs: 2, md: 5 }, justifyContent: 'center', bgcolor: 'background.default' }}>
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 3 }}>
          <Box component="img" src="./brand/sag-logo.png" alt="Sports Authority of Gujarat" sx={{ height: 56 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">{t('app.dept')}</Typography>
            <Box sx={{ height: 40, width: 120, border: '1px dashed #C4CFDB', borderRadius: 2, display: 'grid', placeItems: 'center', mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Govt. logo</Typography>
            </Box>
          </Box>
          <Button size="small" onClick={toggleLang} startIcon={<Icon name="translate" />}>{t('common.language')}</Button>
        </Stack>

        <Card>
          <CardContent sx={{ p: 3 }}>
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
                <Button type="submit" variant="contained" size="large" endIcon={<Icon name="arrow_forward" />}>{t('login.title')}</Button>
              </Stack>
            )}
            {tab === 1 && !otpSent && (
              <Stack component="form" spacing={2} onSubmit={sendOtp}>
                <TextField label={t('login.mobile')} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  inputMode="numeric" InputProps={{ startAdornment: <InputAdornment position="start">+91</InputAdornment> }} />
                <Button type="submit" variant="contained" size="large" disabled={phone.length !== 10} endIcon={<Icon name="sms" />}>{t('login.sendOtp')}</Button>
              </Stack>
            )}
            {tab === 1 && otpSent && (
              <Stack component="form" spacing={2} onSubmit={verify}>
                <Alert severity="info" icon={<Icon name="info" />}>{t('login.demoOtp', { otp: DEMO_OTP })}</Alert>
                <TextField label={t('login.otp')} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus
                  inputProps={{ style: { letterSpacing: 8, fontSize: 22, textAlign: 'center' } }} />
                <Button type="submit" variant="contained" size="large" disabled={otp.length !== 6} endIcon={<Icon name="arrow_forward" />}>{t('login.verify')}</Button>
                <Button variant="text" onClick={() => { setOtpSent(false); setOtp('') }}>{t('common.back')}</Button>
              </Stack>
            )}
          </CardContent>
        </Card>

        <Divider sx={{ my: 3 }} />
        <Button variant="outlined" size="large" color="secondary" startIcon={<Icon name="map" />} onClick={() => nav('/map')}>{t('login.public')}</Button>
        <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 1 }}>{t('login.publicHint')}</Typography>
      </Stack>
    </Box>
  )
}
