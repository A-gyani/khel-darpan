// Thin bar at the top of every screen:
// - offline: tells the user changes are kept on this phone (and how many are waiting)
// - back online with changes waiting: shows they are uploading
// - officers on a phone that can install the app: offers "Install app" (once dismissed, it stays hidden)
import { useEffect, useState } from 'react'
import { Box, Button, IconButton, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Icon, useCurrentUser } from './ui'
import { useSyncStatus } from '../data/store'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null
const installListeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; installListeners.forEach(l => l()) })
  window.addEventListener('appinstalled', () => { deferred = null; installListeners.forEach(l => l()) })
}

function Bar({ tone, icon, children, action }: { tone: 'warn' | 'info'; icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  const c = tone === 'warn' ? { bg: '#FFF4E5', fg: '#8A4B00' } : { bg: '#E8F1FB', fg: '#0B4F8A' }
  return (
    <Box className="no-print" role="status" sx={{ bgcolor: c.bg, color: c.fg, px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1, pt: 'calc(6px + env(safe-area-inset-top))' }}>
      <Icon name={icon} size={18} />
      <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.3 }}>{children}</Typography>
      {action}
    </Box>
  )
}

export function OfflineBar() {
  const { t } = useTranslation()
  const { online, pending, uploading } = useSyncStatus()
  const user = useCurrentUser()
  const [, force] = useState(0)
  const [hideInstall, setHideInstall] = useState(() => { try { return !!localStorage.getItem('ks_hide_install') } catch { return false } })
  useEffect(() => { const l = () => force(x => x + 1); installListeners.add(l); return () => { installListeners.delete(l) } }, [])

  if (!online) {
    return <Bar tone="warn" icon="cloud_off">{t('off.offline')}{pending ? ` ${t('off.pending', { count: pending })}` : ''}</Bar>
  }
  if (pending) {
    return <Bar tone="info" icon="cloud_upload">{uploading ? t('off.uploading', { count: pending }) : t('off.pending', { count: pending })}</Bar>
  }
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
  if (user && deferred && !hideInstall && !standalone) {
    return (
      <Bar tone="info" icon="install_mobile"
        action={<>
          <Button size="small" variant="contained" onClick={async () => { const d = deferred; if (!d) return; await d.prompt(); await d.userChoice; deferred = null; force(x => x + 1) }}>{t('off.installBtn')}</Button>
          <IconButton size="small" aria-label={t('common.close')} onClick={() => { setHideInstall(true); try { localStorage.setItem('ks_hide_install', '1') } catch { /* ignore */ } }}><Icon name="close" size={18} /></IconButton>
        </>}>
        {t('off.install')}
      </Bar>
    )
  }
  return null
}
