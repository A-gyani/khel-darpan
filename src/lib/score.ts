import type { CheckIn, Facility } from './types'
import { CONDITION_KEYS, DAYS } from './constants'

export type PillarKey = 'condition' | 'utilisation' | 'accessibility' | 'inclusivity' | 'performance'

export const WEIGHTS: Record<PillarKey, number> = {
  condition: 30,
  utilisation: 25,
  accessibility: 15,
  inclusivity: 15,
  performance: 15,
}

export interface Pillar {
  key: PillarKey
  weight: number
  value: number | null // 0-100, null = no data
  source?: 'qr' | 'estimate'
}

export interface ScoreResult {
  score: number | null // null = not enough data
  band: 'green' | 'amber' | 'red' | 'grey'
  pillars: Pillar[]
  tags: ('underused' | 'repair_priority' | 'not_women_friendly')[]
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

function hoursOpenPerWeek(f: Facility): number {
  let h = 0
  for (const d of DAYS) {
    const t = f.timings?.[d]
    if (!t) continue
    const [oh, om] = t.open.split(':').map(Number)
    const [ch, cm] = t.close.split(':').map(Number)
    const diff = ch + cm / 60 - (oh + om / 60)
    if (diff > 0) h += diff
  }
  return h
}

/** Weekly users from QR check-ins in the last 30 days (sum of group sizes). */
export function weeklyUsersFromQr(checkins: CheckIn[], facilityId: string, now = new Date()): { weekly: number; scans: number } {
  const since = now.getTime() - 30 * 864e5
  const recent = checkins.filter(c => c.facilityId === facilityId && new Date(c.at).getTime() >= since)
  const people = recent.reduce((s, c) => s + (c.groupSize || 1), 0)
  return { weekly: (people / 30) * 7, scans: recent.length }
}

export const MIN_SCANS_FOR_QR = 10

export function computeScore(f: Facility, checkins: CheckIn[] = [], now = new Date()): ScoreResult {
  // Condition
  const ratings = CONDITION_KEYS.map(k => f.condition?.[k]).filter((r): r is number => typeof r === 'number' && r > 0)
  let condition: number | null = null
  if (ratings.length >= 4) {
    condition = (ratings.reduce((a, b) => a + b, 0) / ratings.length - 1) / 4 * 100
    if (f.lastMaintenance) {
      const years = (now.getTime() - new Date(f.lastMaintenance).getTime()) / (365.25 * 864e5)
      if (years > 2) condition -= 10
    }
    condition = clamp(condition)
  }

  // Utilisation: QR check-ins first, DSO estimate as fallback
  let utilisation: number | null = null
  let utilSource: 'qr' | 'estimate' | undefined
  const qr = weeklyUsersFromQr(checkins, f.id, now)
  const capacity = f.capacity && f.capacity > 0 ? f.capacity : null
  if (capacity) {
    const target = capacity * 7 // one full turnover per day
    if (qr.scans >= MIN_SCANS_FOR_QR) {
      utilisation = clamp((qr.weekly / target) * 100)
      utilSource = 'qr'
    } else if (f.weeklyUsersEstimate != null) {
      utilisation = clamp((f.weeklyUsersEstimate / target) * 100)
      utilSource = 'estimate'
    }
  }

  // Accessibility
  const feePts = f.feeType === 'free' ? 40 : f.feeType === 'subsidised' ? 20 : 0
  const hourPts = Math.min(hoursOpenPerWeek(f), 70) / 70 * 40
  const phonePts = f.bookingPhone ? 20 : 0
  const accessibility = clamp(feePts + hourPts + phonePts)

  // Inclusivity
  const a = new Set(f.amenities || [])
  const inclusivity = clamp(
    (a.has('toilets_women') ? 20 : 0) +
    (a.has('changing_room_women') ? 20 : 0) +
    (f.womenOnlySlots ? 15 : 0) +
    (a.has('ramp_access') ? 15 : 0) +
    (a.has('accessible_toilet') ? 10 : 0) +
    (f.paraSports ? 10 : 0) +
    (f.openToSchools ? 10 : 0),
  )

  // Performance
  let performance: number | null = null
  if (f.coachAvailable || f.athletesTrainedLastYear != null) {
    performance = clamp(
      (f.coachAvailable ? 40 : 0) +
      (Math.min(f.coachCount || 0, 4) / 4) * 30 +
      (Math.min(f.athletesTrainedLastYear || 0, 50) / 50) * 30,
    )
  }

  const pillars: Pillar[] = [
    { key: 'condition', weight: WEIGHTS.condition, value: condition },
    { key: 'utilisation', weight: WEIGHTS.utilisation, value: utilisation, source: utilSource },
    { key: 'accessibility', weight: WEIGHTS.accessibility, value: accessibility },
    { key: 'inclusivity', weight: WEIGHTS.inclusivity, value: inclusivity },
    { key: 'performance', weight: WEIGHTS.performance, value: performance },
  ]

  // Re-weight across pillars that have data
  const withData = pillars.filter(p => p.value != null)
  let score: number | null = null
  if (condition != null && withData.length >= 3) {
    const totalW = withData.reduce((s, p) => s + p.weight, 0)
    score = Math.round(withData.reduce((s, p) => s + (p.value as number) * p.weight, 0) / totalW)
  }

  const band: ScoreResult['band'] = score == null ? 'grey' : score >= 75 ? 'green' : score >= 50 ? 'amber' : 'red'

  const tags: ScoreResult['tags'] = []
  if (condition != null && utilisation != null && condition >= 70 && utilisation < 30) tags.push('underused')
  if (condition != null && utilisation != null && utilisation >= 60 && condition < 50) tags.push('repair_priority')
  if (!a.has('toilets_women') || !a.has('changing_room_women')) tags.push('not_women_friendly')

  return { score, band, pillars, tags }
}

export const BAND_COLORS: Record<ScoreResult['band'], string> = {
  green: '#2E7D32',
  amber: '#F9A825',
  red: '#C62828',
  grey: '#9E9E9E',
}
