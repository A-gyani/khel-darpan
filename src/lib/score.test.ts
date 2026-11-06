import { describe, it, expect } from 'vitest'
import { computeScore } from './score'
import type { Facility, CheckIn } from './types'

const base: Facility = {
  id: 'f1', name: 'Test', type: 'open_ground', ownership: 'municipal', district: 'ahmedabad', taluka: 'sanand', ward: '',
  address: '', lat: 23, lng: 72.5, gpsLat: 23, gpsLng: 72.5, gpsAccuracy: 10, sports: ['football'],
  amenities: ['toilets_women', 'changing_room_women'],
  timings: { mon: { open: '06:00', close: '20:00' }, tue: { open: '06:00', close: '20:00' }, wed: { open: '06:00', close: '20:00' }, thu: { open: '06:00', close: '20:00' }, fri: { open: '06:00', close: '20:00' }, sat: { open: '06:00', close: '20:00' }, sun: null },
  feeType: 'free', feeAmount: null, feeUnit: 'per_hour', bookingName: '', bookingPhone: '9999999999', capacity: 50,
  surface: 'grass', coachAvailable: false, coachCount: null, womenOnlySlots: false, paraSports: false, openToSchools: true,
  condition: { surface: 5, lighting: 5, toilets: 5, changing_rooms: 5, water: 5, seating: 5, safety_equipment: 5, overall_cleanliness: 5 },
  lastMaintenance: '', yearBuilt: 2015, weeklyUsersEstimate: 50, athletesTrainedLastYear: null, cwg: 'none', photos: [],
  status: 'approved', createdBy: 'u', createdAt: '', updatedAt: '', submittedAt: null, approvedAt: null, lastVerifiedAt: null,
}

describe('computeScore', () => {
  it('gives full condition for all-5 ratings', () => {
    const r = computeScore(base)
    expect(r.pillars.find(p => p.key === 'condition')!.value).toBe(100)
  })
  it('re-weights when performance has no data', () => {
    const r = computeScore(base)
    expect(r.pillars.find(p => p.key === 'performance')!.value).toBeNull()
    expect(r.score).not.toBeNull()
  })
  it('tags underused when condition high and use low', () => {
    expect(computeScore(base).tags).toContain('underused')
  })
  it('uses QR check-ins once enough scans exist', () => {
    const now = new Date('2026-11-06T10:00:00Z')
    const cis: CheckIn[] = Array.from({ length: 30 }, (_, i) => ({
      id: 'c' + i, facilityId: 'f1', at: new Date(now.getTime() - i * 864e5).toISOString(), sport: 'football',
      role: 'player', gender: 'male', ageGroup: '14_18', groupSize: 10,
    }))
    const u = computeScore(base, cis, now).pillars.find(p => p.key === 'utilisation')!
    expect(u.source).toBe('qr')
    expect(u.value).toBeCloseTo(20, 0) // 70 people/week vs 350 target
  })
  it('tags not women-friendly when no women toilet', () => {
    expect(computeScore({ ...base, amenities: [] }).tags).toContain('not_women_friendly')
  })
  it('grey band when condition missing', () => {
    expect(computeScore({ ...base, condition: {} }).band).toBe('grey')
  })
})
