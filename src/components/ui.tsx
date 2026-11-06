import { AppBar, Box, Button, Chip, IconButton, Toolbar, Typography, Stack, Tooltip, Rating as MuiRating } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { toggleLang } from '../i18n'
import { logout, useDb, currentUserId } from '../data/store'
import type { Status, User } from '../lib/types'
import type { ScoreResult } from '../lib/score'
import { BAND_COLORS } from '../lib/score'

export function Icon({ name, fill, size, color, style }: { name: string; fill?: boolean; size?: number; color?: string; style?: React.CSSProperties }) {
  return <span className={'ms' + (fill ? ' fill' : '')} aria-hidden style={{ fontSize: size, color, ...style }}>{name}</span>
}

export function useCurrentUser(): User | null {
  const db = useDb()
  const id = currentUserId()
  return db.users.find(u => u.id === id) || null
}

export function TopBar({ title, back, actions }: { title?: string; back?: string | boolean; actions?: ReactNode }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const user = useCurrentUser()
  return (
    <AppBar position="sticky" className="no-print" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Toolbar sx={{ gap: 1, minHeight: 64 }}>
        {back ? (
          <IconButton aria-label={t('common.back')} onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}><Icon name="arrow_back" /></IconButton>
        ) : (
          <Box component="img" src="./brand/sag-logo.png" alt="SAG" sx={{ height: 36, width: 'auto' }} />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" noWrap>{title || t('app.name')}</Typography>
          {user && <Typography variant="caption" color="text.secondary" noWrap display="block">{t(`role.${user.role}`)} · {user.fullName}</Typography>}
        </Box>
        {actions}
        <Tooltip title="Language / ભાષા">
          <Button size="small" variant="text" onClick={toggleLang} startIcon={<Icon name="translate" />} sx={{ minWidth: 0, px: 1.5 }}>
            {t('common.language')}
          </Button>
        </Tooltip>
        {user && (
          <Tooltip title={t('common.logout')}>
            <IconButton onClick={() => { logout(); nav('/login') }}><Icon name="logout" /></IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  )
}

const STATUS_STYLE: Record<Status, { bg: string; fg: string; icon: string }> = {
  draft: { bg: '#ECEFF3', fg: '#43474E', icon: 'edit_note' },
  submitted: { bg: '#DDEBFA', fg: '#0D4A80', icon: 'schedule_send' },
  approved: { bg: '#DCF2E1', fg: '#1D6B33', icon: 'verified' },
  returned: { bg: '#FFE7CC', fg: '#8A4B00', icon: 'undo' },
  rejected: { bg: '#FBDADA', fg: '#8C1D18', icon: 'block' },
}

export function StatusChip({ status }: { status: Status }) {
  const { t } = useTranslation()
  const s = STATUS_STYLE[status]
  return <Chip size="small" icon={<Icon name={s.icon} size={18} color={s.fg} />} label={t(`status.${status}`)} sx={{ bgcolor: s.bg, color: s.fg, height: 28 }} />
}

export function ScoreBadge({ r, size = 44 }: { r: ScoreResult; size?: number }) {
  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', bgcolor: BAND_COLORS[r.band], color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
      {r.score ?? '–'}
    </Box>
  )
}

export function ScoreBars({ r }: { r: ScoreResult }) {
  const { t } = useTranslation()
  return (
    <Stack spacing={1.25}>
      {r.pillars.map(p => (
        <Box key={p.key}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2">{t(`pillar.${p.key}`)} <Typography component="span" variant="caption" color="text.secondary">· {p.weight}%{p.source ? ` · ${t(`pillar.${p.source}`)}` : ''}</Typography></Typography>
            <Typography variant="body2" fontWeight={500}>{p.value == null ? t('common.noData') : Math.round(p.value)}</Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: '#E6EBF1', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${p.value ?? 0}%`, bgcolor: p.value == null ? 'transparent' : p.value >= 75 ? BAND_COLORS.green : p.value >= 50 ? BAND_COLORS.amber : BAND_COLORS.red, borderRadius: 4 }} />
          </Box>
        </Box>
      ))}
    </Stack>
  )
}

export function TagChips({ r }: { r: ScoreResult }) {
  const { t } = useTranslation()
  const style: Record<string, { bg: string; fg: string; icon: string }> = {
    underused: { bg: '#E8EAF6', fg: '#303F9F', icon: 'trending_down' },
    repair_priority: { bg: '#FBDADA', fg: '#8C1D18', icon: 'construction' },
    not_women_friendly: { bg: '#FCE4EC', fg: '#880E4F', icon: 'wc' },
  }
  return (
    <Stack direction="row" gap={0.75} flexWrap="wrap">
      {r.tags.map(tag => (
        <Chip key={tag} size="small" icon={<Icon name={style[tag].icon} size={16} color={style[tag].fg} />} label={t(`tag.${tag}`)} sx={{ bgcolor: style[tag].bg, color: style[tag].fg, height: 26 }} />
      ))}
    </Stack>
  )
}

export function Stars({ value, onChange, size = 'medium' }: { value: number; onChange?: (v: number) => void; size?: 'small' | 'medium' | 'large' }) {
  return (
    <MuiRating value={value} precision={onChange ? 1 : 0.5} readOnly={!onChange} size={size}
      onChange={(_, v) => onChange && onChange(v || 0)}
      icon={<Icon name="star" fill color="#F08A1C" size={size === 'large' ? 36 : size === 'small' ? 18 : 26} />}
      emptyIcon={<Icon name="star" color="#B8C1CC" size={size === 'large' ? 36 : size === 'small' ? 18 : 26} />} />
  )
}

export function Section({ title, icon, children, action }: { title: string; icon?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
        {icon && <Icon name={icon} color="#1B6FB8" />}
        <Typography variant="h4" sx={{ flex: 1 }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </Box>
  )
}

export function DemoBadge() {
  const { t } = useTranslation()
  return <Chip size="small" label={t('app.demo')} sx={{ height: 22, fontSize: 11, bgcolor: '#FFF3E0', color: '#8A4B00' }} />
}
