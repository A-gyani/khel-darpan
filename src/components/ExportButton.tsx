import { useState } from 'react'
import { Button, CircularProgress } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Icon } from './ui'
import { downloadFacilitiesExcel } from '../lib/exportExcel'
import type { DB, Facility } from '../lib/types'

/** "Excel" button: downloads exactly the facilities passed in (the filtered list on screen). */
export function ExportButton({ facilities, db, fileTag, filters }: { facilities: Facility[]; db: DB; fileTag: string; filters: [string, string][] }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try { await downloadFacilitiesExcel(facilities, db, fileTag, filters) }
    catch (e) { alert(t('ex.failed') + ' ' + (e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Button size="small" variant="outlined" onClick={go} disabled={busy || facilities.length === 0}
      startIcon={busy ? <CircularProgress size={16} /> : <Icon name="download" size={18} />} sx={{ flexShrink: 0 }}>
      {t('ex.excel')}
    </Button>
  )
}
