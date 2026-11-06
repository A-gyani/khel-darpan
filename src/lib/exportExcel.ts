// Excel export of facilities. Always English. Exports exactly the rows passed in (the list the officer
// is looking at, after filters), so permissions are the same as the app: the rows come from what the
// database already lets this officer read.
import i18n from '../i18n'
import type { CheckIn, DayTiming, Facility, Grievance, Rating } from './types'
import { CONDITION_KEYS, DAYS, ESCALATE_AFTER_DAYS, TALUKAS, districtOf } from './constants'
import { computeScore } from './score'

const yes = (b: boolean) => (b ? 'Yes' : 'No')
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '')
const hours = (d: DayTiming) => (!d ? 'Closed' : [`${d.open}-${d.close}`, d.open2 && d.close2 ? `${d.open2}-${d.close2}` : ''].filter(Boolean).join(', '))

export interface ExportData { checkins: CheckIn[]; grievances: Grievance[]; ratings: Rating[] }

export function facilityRows(facilities: Facility[], data: ExportData, now = new Date()) {
  const tt = i18n.getFixedT('en')
  // unknown codes (e.g. old demo values) print as they are rather than as 'surface.xyz'
  const t = (k: string) => tt(k, { defaultValue: k.split('.').slice(1).join('.').replace(/_/g, ' ') })
  const since30 = now.getTime() - 30 * 864e5
  return facilities.map(f => {
    const r = computeScore(f, data.checkins, now)
    const ci = data.checkins.filter(c => c.facilityId === f.id && new Date(c.at).getTime() >= since30)
    const people = (g?: string) => ci.filter(c => !g || c.gender === g).reduce((s, c) => s + (c.groupSize || 1), 0)
    const gs = data.grievances.filter(g => g.facilityId === f.id && g.status === 'open')
    const overdue = gs.filter(g => now.getTime() - new Date(g.at).getTime() > ESCALATE_AFTER_DAYS * 864e5).length
    const rs = data.ratings.filter(x => x.facilityId === f.id)
    const avg = rs.length ? Math.round((rs.reduce((s, x) => s + x.overall, 0) / rs.length) * 10) / 10 : ''
    const row: Record<string, string | number> = {
      'Facility ID': f.id,
      'Name': f.name,
      'Status': t(`status.${f.status}`),
      'District': districtOf(f.district)?.en || f.district,
      'Taluka': TALUKAS.find(x => x.id === f.taluka)?.en || f.taluka,
      'Ward / village': f.ward,
      'Address': f.address,
      'Latitude': f.lat ?? '',
      'Longitude': f.lng ?? '',
      'Type': t(`type.${f.type}`),
      'Ownership': t(`own.${f.ownership}`),
      'Sports': f.sports.map(s => t(`sport.${s}`)).join(', '),
      'Amenities': f.amenities.map(a => t(`amenity.${a}`)).join(', '),
      'Surface': f.surface ? t(`surface.${f.surface}`) : '',
      'Capacity': f.capacity ?? '',
      'Year built': f.yearBuilt ?? '',
      'Fee': t(`fee.${f.feeType}`),
      'Fee amount (Rs)': f.feeType === 'free' ? '' : f.feeAmount ?? '',
      'Fee per': f.feeType === 'free' ? '' : t(`fee.${f.feeUnit}`),
      'Booking contact': f.bookingName,
      'Booking phone': f.bookingPhone,
    }
    for (const d of DAYS) row[`Hours ${t(`day.${d}`)}`] = hours(f.timings?.[d] ?? null)
    Object.assign(row, {
      'Coach available': yes(f.coachAvailable),
      'Number of coaches': f.coachAvailable ? f.coachCount ?? '' : '',
      'Women-only slots': yes(f.womenOnlySlots),
      'Para sports': yes(f.paraSports),
      'Open to schools': yes(f.openToSchools),
    })
    // Condition: 1-5 stars as entered by the DSO; 0 in the app means "not available at this facility".
    for (const k of CONDITION_KEYS) {
      const v = f.condition[k]
      row[`Condition: ${t(`cond.${k}`)} (1-5)`] = v === undefined ? '' : v === 0 ? 'Not available' : v
    }
    Object.assign(row, {
      'Last maintenance': f.lastMaintenance,
      'Weekly users (DSO estimate)': f.weeklyUsersEstimate ?? '',
      'Athletes trained last year': f.athletesTrainedLastYear ?? '',
      'CWG 2030': t(`cwg.${f.cwg}`),
      'Health Score (0-100)': r.score ?? '',
      'Health band': t(`band.${r.band}`),
      'Tags': r.tags.map(x => t(`tag.${x}`)).join(', '),
      'QR check-ins last 30 days: people': people(),
      'QR check-ins last 30 days: women': people('female'),
      'QR check-ins last 30 days: men': people('male'),
      'Open complaints': gs.length,
      [`Open complaints older than ${ESCALATE_AFTER_DAYS} days`]: overdue,
      'Average star rating (1-5)': avg,
      'Number of ratings': rs.length,
      'Photos': f.photos.length,
      'Submitted on': day(f.submittedAt),
      'Approved on': day(f.approvedAt),
      'Last verified on': day(f.lastVerifiedAt),
      'Last updated': day(f.updatedAt),
    })
    return row
  })
}

/** Builds and downloads the .xlsx. `filters` is a plain-English list written on a second sheet. */
export async function downloadFacilitiesExcel(facilities: Facility[], data: ExportData, fileTag: string, filters: [string, string][]) {
  const XLSX = await import('xlsx') // loaded only when someone exports
  const rows = facilityRows(facilities, data)
  const ws = XLSX.utils.json_to_sheet(rows)
  const headers = rows.length ? Object.keys(rows[0]) : ['Name']
  ws['!cols'] = headers.map(h => ({ wch: Math.min(40, Math.max(10, h.length + 2, ...rows.slice(0, 200).map(r => String(r[h] ?? '').length))) }))
  ws['!autofilter'] = { ref: ws['!ref'] || 'A1' }
  ws['!freeze'] = { xSplit: 2, ySplit: 1 }
  const now = new Date()
  const about = XLSX.utils.aoa_to_sheet([
    ['Khel Darpan Gujarat — facilities export'],
    ['Downloaded on', now.toLocaleString('en-IN')],
    ['Facilities in this file', rows.length],
    [],
    ['Filters used'],
    ...(filters.length ? filters : [['(none)', '']]),
    [],
    ['Notes'],
    ['Health Score', 'Internal score, not shown to the public. Weights: condition 30, use 25, access 15, inclusivity 15, performance 15.'],
    ['QR check-ins', 'People counted from QR check-ins at the facility in the 30 days before the download date.'],
    ['Condition', '1-5 stars entered by the DSO on site. "Not available" = the facility does not have this item.'],
  ])
  about['!cols'] = [{ wch: 26 }, { wch: 90 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Facilities')
  XLSX.utils.book_append_sheet(wb, about, 'About this file')
  const stamp = now.toISOString().slice(0, 10)
  XLSX.writeFile(wb, `KhelDarpan_${fileTag}_${stamp}.xlsx`, { compression: true })
}
