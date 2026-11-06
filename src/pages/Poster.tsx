import { useEffect, useState } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Icon, TopBar } from '../components/ui'
import { useDb } from '../data/store'
import gu from '../locales/gu.json'
import en from '../locales/en.json'

export function qrUrl(id: string) {
  return `${location.origin}${location.pathname}#/q/${id}`
}

// Printable A4 poster with the facility's QR code (bilingual).
export default function Poster() {
  const { id } = useParams()
  const db = useDb()
  const f = db.facilities.find(x => x.id === id)
  const [src, setSrc] = useState('')
  // A4 is 794 css px wide; shrink to fit the phone screen (print stays full size)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 16) / 794))
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [])
  useEffect(() => {
    if (f) QRCode.toDataURL(qrUrl(f.id), { width: 600, margin: 1, color: { dark: '#0D4A80' } }).then(setSrc)
  }, [f?.id]) // eslint-disable-line
  if (!f) return null
  return (
    <>
      <TopBar back title={en.qr.poster} actions={<Button variant="contained" startIcon={<Icon name="print" />} onClick={() => window.print()} className="no-print" sx={{ px: 1.5, flexShrink: 0 }}>PDF</Button>} />
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, height: 1123 * scale + 24, overflow: 'hidden', '@media print': { pt: 0, height: 'auto', overflow: 'visible' } }}>
        <Box sx={{ transform: `scale(${scale})`, transformOrigin: 'top center', flexShrink: 0, '@media print': { transform: 'none' } }}>
        <Box sx={{ width: '210mm', minHeight: '297mm', bgcolor: '#fff', boxShadow: 3, p: '14mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', '@media print': { boxShadow: 'none' } }}>
          <Stack direction="row" alignItems="center" gap={2} sx={{ alignSelf: 'stretch', justifyContent: 'center' }}>
            <Box component="img" src="./brand/sag-logo.png" alt="" sx={{ height: 70 }} />
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="h3" color="primary.dark">{gu.app.name}</Typography>
              <Typography variant="h4" color="text.secondary">{en.app.name}</Typography>
            </Box>
          </Stack>
          <Box sx={{ height: 6, alignSelf: 'stretch', my: 3, borderRadius: '12px', background: 'linear-gradient(90deg,#1B6FB8 0 33%,#F08A1C 33% 66%,#2E9447 66%)' }} />
          <Typography sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>{f.name}</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>{f.address}</Typography>
          {src && <Box component="img" src={src} alt="QR" sx={{ width: '115mm', height: '115mm' }} />}
          <Typography sx={{ fontSize: 26, fontWeight: 700, mt: 3 }}>{gu.qr.scanToCheckIn}</Typography>
          <Typography sx={{ fontSize: 20, color: 'text.secondary' }}>{en.qr.scanToCheckIn}</Typography>
          <Stack direction="row" gap={4} sx={{ mt: 4 }}>
            {[['how_to_reg', gu.qr.checkIn, en.qr.checkIn, '#1B6FB8'], ['report', gu.qr.report, en.qr.report, '#C62828'], ['star', gu.qr.rate, en.qr.rate, '#F08A1C']].map(([ic, g, e, c]) => (
              <Stack key={ic} alignItems="center" sx={{ width: 140 }}>
                <Box sx={{ width: 64, height: 64, borderRadius: '16px', bgcolor: c, display: 'grid', placeItems: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}><Icon name={ic} size={38} color="#fff" fill /></Box>
                <Typography fontWeight={700} sx={{ mt: 1 }}>{g}</Typography>
                <Typography variant="body2" color="text.secondary">{e}</Typography>
              </Stack>
            ))}
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">ID: {f.id} · {gu.app.dept} / {en.app.dept}</Typography>
        </Box>
        </Box>
      </Box>
    </>
  )
}
