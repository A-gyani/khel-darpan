// Synthetic DEMO data for Ahmedabad, Surat and Gandhinagar districts. Not real facilities. Placeholder images only.
import type { DB, Facility, CheckIn, Grievance, Rating, Photo, PhotoCaption, Timings, User, FacilityType, Ownership, CwgTag, Status } from '../lib/types'
import { CONDITION_KEYS, SPORTS, districtOf } from '../lib/constants'

export const SEED_VERSION = 9

// Deterministic random so the demo looks the same every time
let s = 42
const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1))

export function placeholderPhoto(caption: string, hue: number, rawLabel: string): string {
  const label = rawLabel.replace(/&/g, "and").replace(/[<>]/g, "")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,62%)"/><stop offset="1" stop-color="hsl(${hue + 30},45%,38%)"/></linearGradient></defs>
<rect width="640" height="420" fill="url(#g)"/>
<path d="M0 330 Q160 270 320 320 T640 300 V420 H0Z" fill="rgba(255,255,255,.18)"/>
<text x="320" y="200" font-family="Roboto,Arial" font-size="34" fill="#fff" text-anchor="middle" font-weight="700">${caption}</text>
<text x="320" y="245" font-family="Roboto,Arial" font-size="20" fill="rgba(255,255,255,.85)" text-anchor="middle">${label}</text>
<rect x="16" y="16" rx="8" width="120" height="34" fill="rgba(0,0,0,.35)"/><text x="76" y="40" font-family="Roboto,Arial" font-size="18" fill="#fff" text-anchor="middle">DEMO</text>
</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

const fullWeek = (open: string, close: string, sundayClosed = false): Timings => ({
  mon: { open, close }, tue: { open, close }, wed: { open, close }, thu: { open, close },
  fri: { open, close }, sat: { open, close }, sun: sundayClosed ? null : { open, close },
})

interface Spec {
  name: string; type: FacilityType; own: Ownership; taluka: string; ward: string; lat: number; lng: number
  sports: string[]; cwg?: CwgTag; status: Status; cond: number; cap: number; use: number; district?: string
}

// cond = rough condition level 1-5; use = DSO weekly users estimate
const SPECS: Spec[] = [
  { name: 'Demo Sports Enclave – Motera', type: 'stadium', own: 'state_sag', taluka: 'ahmedabad_city', ward: 'Motera', lat: 23.0917, lng: 72.5975, sports: ['athletics', 'football', 'hockey', 'swimming'], cwg: 'venue', status: 'approved', cond: 5, cap: 400, use: 2200 },
  { name: 'Demo District Sports Complex – Naranpura', type: 'sports_complex', own: 'state_sag', taluka: 'ahmedabad_city', ward: 'Naranpura', lat: 23.0596, lng: 72.5525, sports: ['badminton', 'table_tennis', 'basketball', 'swimming', 'boxing'], cwg: 'training', status: 'approved', cond: 4, cap: 250, use: 1500 },
  { name: 'Demo Indoor Hall – Maninagar', type: 'indoor_hall', own: 'municipal', taluka: 'ahmedabad_city', ward: 'Maninagar', lat: 22.9962, lng: 72.6011, sports: ['badminton', 'table_tennis', 'judo'], cwg: 'training', status: 'approved', cond: 3, cap: 80, use: 520 },
  { name: 'Demo Aquatic Centre – Vastrapur', type: 'swimming_pool', own: 'municipal', taluka: 'ahmedabad_city', ward: 'Vastrapur', lat: 23.0395, lng: 72.5290, sports: ['swimming'], cwg: 'training', status: 'approved', cond: 2, cap: 60, use: 380 },
  { name: 'Demo Akhada – Kalupur', type: 'akhada', own: 'other', taluka: 'ahmedabad_city', ward: 'Kalupur', lat: 23.0300, lng: 72.6000, sports: ['wrestling'], status: 'approved', cond: 3, cap: 30, use: 150 },
  { name: 'Demo Cricket Ground – Sabarmati', type: 'open_ground', own: 'municipal', taluka: 'ahmedabad_city', ward: 'Sabarmati', lat: 23.0780, lng: 72.5880, sports: ['cricket', 'football'], status: 'approved', cond: 4, cap: 120, use: 90 },
  { name: 'Demo School Ground – Bopal', type: 'school_ground', own: 'school_college', taluka: 'daskroi', ward: 'Bopal', lat: 23.0330, lng: 72.4650, sports: ['kabaddi', 'kho_kho', 'athletics', 'volleyball'], status: 'approved', cond: 4, cap: 150, use: 120 },
  { name: 'Demo Shooting Range – Gota', type: 'sports_complex', own: 'state_sag', taluka: 'ahmedabad_city', ward: 'Gota', lat: 23.1000, lng: 72.5400, sports: ['shooting', 'archery'], cwg: 'training', status: 'approved', cond: 5, cap: 40, use: 60 },
  { name: 'Demo Weightlifting Gym – Odhav', type: 'gym', own: 'district', taluka: 'ahmedabad_city', ward: 'Odhav', lat: 23.0300, lng: 72.6650, sports: ['weightlifting', 'boxing'], status: 'approved', cond: 2, cap: 40, use: 260 },
  { name: 'Demo Taluka Sports Complex – Sanand', type: 'sports_complex', own: 'district', taluka: 'sanand', ward: 'Sanand town', lat: 22.9920, lng: 72.3810, sports: ['athletics', 'kabaddi', 'volleyball', 'kho_kho'], status: 'approved', cond: 3, cap: 200, use: 300 },
  { name: 'Demo Open Ground – Dholka', type: 'open_ground', own: 'municipal', taluka: 'dholka', ward: 'Dholka town', lat: 22.7270, lng: 72.4410, sports: ['cricket', 'kabaddi', 'athletics'], status: 'approved', cond: 2, cap: 150, use: 700 },
  { name: 'Demo Hockey Turf – Vejalpur', type: 'court', own: 'state_sag', taluka: 'ahmedabad_city', ward: 'Vejalpur', lat: 23.0000, lng: 72.5200, sports: ['hockey'], cwg: 'training', status: 'approved', cond: 4, cap: 60, use: 250 },
  { name: 'Demo Basketball Courts – Chandkheda', type: 'court', own: 'municipal', taluka: 'ahmedabad_city', ward: 'Chandkheda', lat: 23.1100, lng: 72.5800, sports: ['basketball', 'volleyball'], status: 'approved', cond: 3, cap: 50, use: 180 },
  { name: 'Demo Village Ground – Viramgam', type: 'open_ground', own: 'other', taluka: 'viramgam', ward: 'Viramgam town', lat: 23.1200, lng: 72.0300, sports: ['kabaddi', 'kho_kho', 'cricket'], status: 'approved', cond: 2, cap: 100, use: 60 },
  { name: 'Demo Tennis Courts – Bodakdev', type: 'court', own: 'private_ppp', taluka: 'ahmedabad_city', ward: 'Bodakdev', lat: 23.0400, lng: 72.5100, sports: ['tennis'], status: 'approved', cond: 5, cap: 24, use: 140 },
  { name: 'Demo Yoga & Chess Centre – Paldi', type: 'indoor_hall', own: 'municipal', taluka: 'ahmedabad_city', ward: 'Paldi', lat: 23.0100, lng: 72.5650, sports: ['yoga', 'chess'], status: 'submitted', cond: 4, cap: 60, use: 200 },
  { name: 'Demo Athletics Track – Bavla', type: 'open_ground', own: 'district', taluka: 'bavla', ward: 'Bavla town', lat: 22.8300, lng: 72.3660, sports: ['athletics'], status: 'submitted', cond: 3, cap: 100, use: 120 },
  { name: 'Demo Boxing Hall – Bapunagar', type: 'indoor_hall', own: 'district', taluka: 'ahmedabad_city', ward: 'Bapunagar', lat: 23.0400, lng: 72.6300, sports: ['boxing'], status: 'returned', cond: 2, cap: 30, use: 200 },
  { name: 'Demo School Ground – Dhandhuka', type: 'school_ground', own: 'school_college', taluka: 'dhandhuka', ward: 'Dhandhuka town', lat: 22.3800, lng: 71.9800, sports: ['kabaddi', 'kho_kho'], status: 'draft', cond: 3, cap: 120, use: 80 },
  { name: 'Demo Football Ground – Mandal', type: 'open_ground', own: 'municipal', taluka: 'mandal', ward: 'Mandal town', lat: 23.2800, lng: 71.9200, sports: ['football', 'athletics'], status: 'submitted', cond: 3, cap: 90, use: 70 },
  // ---- Surat ----
  { district: 'surat', name: 'Demo Sports Complex – Pal', type: 'sports_complex', own: 'state_sag', taluka: 'surat_city', ward: 'Pal', lat: 21.1960, lng: 72.7790, sports: ['athletics', 'badminton', 'table_tennis', 'swimming', 'basketball'], status: 'approved', cond: 4, cap: 220, use: 1300 },
  { district: 'surat', name: 'Demo Cricket Stadium – Athwa', type: 'stadium', own: 'municipal', taluka: 'surat_city', ward: 'Athwa', lat: 21.1760, lng: 72.8070, sports: ['cricket', 'football'], status: 'approved', cond: 4, cap: 300, use: 900 },
  { district: 'surat', name: 'Demo Aquatic Centre – Adajan', type: 'swimming_pool', own: 'municipal', taluka: 'surat_city', ward: 'Adajan', lat: 21.1950, lng: 72.7930, sports: ['swimming'], status: 'approved', cond: 3, cap: 70, use: 450 },
  { district: 'surat', name: 'Demo Indoor Hall – Varachha', type: 'indoor_hall', own: 'municipal', taluka: 'surat_city', ward: 'Varachha', lat: 21.2100, lng: 72.8650, sports: ['badminton', 'table_tennis', 'chess'], status: 'approved', cond: 2, cap: 60, use: 420 },
  { district: 'surat', name: 'Demo Akhada – Katargam', type: 'akhada', own: 'other', taluka: 'surat_city', ward: 'Katargam', lat: 21.2290, lng: 72.8270, sports: ['wrestling'], status: 'approved', cond: 3, cap: 30, use: 140 },
  { district: 'surat', name: 'Demo Open Ground – Udhna', type: 'open_ground', own: 'municipal', taluka: 'surat_city', ward: 'Udhna', lat: 21.1700, lng: 72.8430, sports: ['cricket', 'kabaddi', 'football'], status: 'approved', cond: 2, cap: 150, use: 650 },
  { district: 'surat', name: 'Demo School Ground – Vesu', type: 'school_ground', own: 'school_college', taluka: 'surat_city', ward: 'Vesu', lat: 21.1420, lng: 72.7780, sports: ['kho_kho', 'kabaddi', 'volleyball', 'athletics'], status: 'approved', cond: 4, cap: 140, use: 100 },
  { district: 'surat', name: 'Demo Taluka Sports Complex – Bardoli', type: 'sports_complex', own: 'district', taluka: 'bardoli', ward: 'Bardoli town', lat: 21.1225, lng: 73.1115, sports: ['athletics', 'kabaddi', 'volleyball'], status: 'approved', cond: 3, cap: 180, use: 260 },
  { district: 'surat', name: 'Demo Village Ground – Olpad', type: 'open_ground', own: 'other', taluka: 'olpad', ward: 'Olpad town', lat: 21.3360, lng: 72.7520, sports: ['kabaddi', 'kho_kho', 'cricket'], status: 'approved', cond: 2, cap: 90, use: 50 },
  { district: 'surat', name: 'Demo Tennis Courts – Piplod', type: 'court', own: 'private_ppp', taluka: 'surat_city', ward: 'Piplod', lat: 21.1590, lng: 72.7740, sports: ['tennis'], status: 'approved', cond: 5, cap: 24, use: 150 },
  { district: 'surat', name: 'Demo Boxing & Judo Hall – Limbayat', type: 'indoor_hall', own: 'district', taluka: 'surat_city', ward: 'Limbayat', lat: 21.1730, lng: 72.8590, sports: ['boxing', 'judo'], status: 'submitted', cond: 3, cap: 40, use: 180 },
  { district: 'surat', name: 'Demo Football Turf – Kamrej', type: 'court', own: 'private_ppp', taluka: 'kamrej', ward: 'Kamrej', lat: 21.2700, lng: 72.9600, sports: ['football'], status: 'submitted', cond: 4, cap: 30, use: 160 },
  { district: 'surat', name: 'Demo Hockey Ground – Mandvi', type: 'open_ground', own: 'district', taluka: 'mandvi_surat', ward: 'Mandvi town', lat: 21.2540, lng: 73.3030, sports: ['hockey', 'athletics'], status: 'returned', cond: 3, cap: 60, use: 90 },
  { district: 'surat', name: 'Demo School Ground – Palsana', type: 'school_ground', own: 'school_college', taluka: 'palsana', ward: 'Palsana', lat: 21.0800, lng: 72.9900, sports: ['kabaddi', 'kho_kho'], status: 'draft', cond: 3, cap: 120, use: 80 },
  // ---- Gandhinagar ----
  { district: 'gandhinagar', name: 'Demo Sports Complex – Sector 11', type: 'sports_complex', own: 'state_sag', taluka: 'gandhinagar_tal', ward: 'Sector 11', lat: 23.2230, lng: 72.6480, sports: ['athletics', 'badminton', 'basketball', 'table_tennis', 'yoga'], status: 'approved', cond: 5, cap: 200, use: 1100 },
  { district: 'gandhinagar', name: 'Demo Indoor Hall – Sector 7', type: 'indoor_hall', own: 'district', taluka: 'gandhinagar_tal', ward: 'Sector 7', lat: 23.2360, lng: 72.6420, sports: ['badminton', 'table_tennis', 'judo', 'chess'], status: 'approved', cond: 3, cap: 60, use: 380 },
  { district: 'gandhinagar', name: 'Demo Swimming Pool – Sector 22', type: 'swimming_pool', own: 'municipal', taluka: 'gandhinagar_tal', ward: 'Sector 22', lat: 23.2290, lng: 72.6600, sports: ['swimming'], status: 'approved', cond: 4, cap: 60, use: 300 },
  { district: 'gandhinagar', name: 'Demo Open Ground – Sector 28', type: 'open_ground', own: 'municipal', taluka: 'gandhinagar_tal', ward: 'Sector 28', lat: 23.2550, lng: 72.6600, sports: ['cricket', 'football', 'kabaddi'], status: 'approved', cond: 3, cap: 150, use: 120 },
  { district: 'gandhinagar', name: 'Demo School Ground – Kudasan', type: 'school_ground', own: 'school_college', taluka: 'gandhinagar_tal', ward: 'Kudasan', lat: 23.1880, lng: 72.6330, sports: ['kho_kho', 'kabaddi', 'volleyball'], status: 'approved', cond: 4, cap: 120, use: 90 },
  { district: 'gandhinagar', name: 'Demo Taluka Ground – Kalol', type: 'open_ground', own: 'district', taluka: 'kalol_gnr', ward: 'Kalol town', lat: 23.2464, lng: 72.5010, sports: ['cricket', 'athletics', 'kabaddi'], status: 'approved', cond: 2, cap: 140, use: 520 },
  { district: 'gandhinagar', name: 'Demo Akhada – Dehgam', type: 'akhada', own: 'other', taluka: 'dehgam', ward: 'Dehgam town', lat: 23.1700, lng: 72.8200, sports: ['wrestling'], status: 'approved', cond: 3, cap: 25, use: 110 },
  { district: 'gandhinagar', name: 'Demo Athletics Track – Infocity', type: 'open_ground', own: 'state_sag', taluka: 'gandhinagar_tal', ward: 'Infocity', lat: 23.1950, lng: 72.6370, sports: ['athletics'], status: 'submitted', cond: 4, cap: 80, use: 200 },
  { district: 'gandhinagar', name: 'Demo Village Ground – Mansa', type: 'open_ground', own: 'other', taluka: 'mansa', ward: 'Mansa town', lat: 23.4250, lng: 72.6600, sports: ['kabaddi', 'kho_kho'], status: 'draft', cond: 2, cap: 80, use: 40 },
]

const CAPTIONS: PhotoCaption[] = ['entrance', 'playing_area', 'toilets']

function makePhotos(f: Spec, idx: number, offsetFar = false): Photo[] {
  const hue = (idx * 37) % 360
  return CAPTIONS.map((c, i) => {
    const far = offsetFar && i === 1
    const lat = f.lat + (far ? 0.004 : (rnd() - 0.5) * 0.0006)
    const lng = f.lng + (far ? 0.003 : (rnd() - 0.5) * 0.0006)
    const url = placeholderPhoto(c.replace('_', ' ').toUpperCase(), hue + i * 20, f.name.replace('Demo ', ''))
    return {
      id: `p${idx}_${i}`, caption: c, dataUrl: url, thumbUrl: url, lat, lng, accuracy: int(5, 30),
      capturedAt: '2026-10-2' + (i + 1) + 'T10:1' + i + ':00+05:30', capturedBy: 'u_dso', sha256: `demo${idx}${i}`,
      distanceFromPin: far ? 480 : int(5, 60), flagFar: far, flagDuplicate: false, flagPoorGps: false,
    }
  })
}

export function buildSeed(): DB {
  s = 42
  const now = new Date()
  const iso = (daysAgo: number, h = 10) => new Date(now.getTime() - daysAgo * 864e5 - (now.getHours() - h) * 36e5).toISOString()

  const users: User[] = [
    { id: 'u_dso', fullName: 'Demo DSO Ahmedabad', email: 'dso.ahmedabad@demo.in', phone: '9000000001', password: 'demo1234', role: 'district_officer', district: 'ahmedabad' },
    { id: 'u_dso_surat', fullName: 'Demo DSO Surat', email: 'dso.surat@demo.in', phone: '9000000004', password: 'demo1234', role: 'district_officer', district: 'surat' },
    { id: 'u_dso_gnr', fullName: 'Demo DSO Gandhinagar', email: 'dso.gandhinagar@demo.in', phone: '9000000005', password: 'demo1234', role: 'district_officer', district: 'gandhinagar' },
    { id: 'u_state', fullName: 'Demo State Officer', email: 'state.demo@demo.in', phone: '9000000002', password: 'demo1234', role: 'state_officer' },
    { id: 'u_public', fullName: 'Demo Citizen', email: 'public.demo@demo.in', phone: '9000000003', password: 'demo1234', role: 'public' },
  ]

  const facilities: Facility[] = SPECS.map((sp, i) => {
    const dist = sp.district || 'ahmedabad'
    const dso = dist === 'surat' ? 'u_dso_surat' : dist === 'gandhinagar' ? 'u_dso_gnr' : 'u_dso'
    const cond: Record<string, number> = {}
    CONDITION_KEYS.forEach(k => (cond[k] = Math.max(1, Math.min(5, sp.cond + int(-1, 1)))))
    const women = sp.cond >= 3 || i % 4 === 0
    const amenities = [
      'toilets_men', 'drinking_water',
      ...(women ? ['toilets_women'] : []),
      ...(sp.cond >= 3 ? ['changing_room_men'] : []),
      ...(women && sp.cond >= 4 ? ['changing_room_women'] : []),
      ...(sp.cond >= 4 ? ['floodlights', 'first_aid', 'seating', 'parking'] : []),
      ...(sp.own === 'state_sag' ? ['ramp_access', 'accessible_toilet', 'equipment_available'] : []),
      ...(sp.cwg === 'venue' ? ['hostel'] : []),
    ]
    const status = sp.status
    const ago = 6 + (i * 7) % 34 // days ago, always in the past
    const createdAt = iso(ago)
    const f: Facility = {
      id: `f${String(i + 1).padStart(3, '0')}`, demo: true, name: sp.name, type: sp.type, ownership: sp.own,
      district: dist, taluka: sp.taluka, ward: sp.ward, address: `${sp.ward}, ${districtOf(dist)?.en} district`,
      lat: sp.lat, lng: sp.lng, gpsLat: sp.lat, gpsLng: sp.lng, gpsAccuracy: int(5, 25),
      sports: sp.sports, amenities,
      timings: sp.type === 'swimming_pool' ? fullWeek('06:00', '11:00', true) : sp.type === 'school_ground' ? fullWeek('16:00', '19:00', true) : fullWeek('06:00', '21:00'),
      feeType: sp.own === 'private_ppp' ? 'paid' : sp.own === 'state_sag' ? 'subsidised' : 'free',
      feeAmount: sp.own === 'private_ppp' ? 400 : sp.own === 'state_sag' ? 300 : null,
      feeUnit: sp.own === 'private_ppp' ? 'per_hour' : 'per_month',
      bookingName: 'Facility in-charge', bookingPhone: i % 5 === 3 ? '' : `07926${String(100000 + i * 137).slice(0, 6)}`,
      capacity: sp.cap, surface: sp.type === 'open_ground' ? 'grass' : sp.type === 'court' ? 'synthetic' : 'wooden/indoor',
      coachAvailable: sp.own === 'state_sag' || sp.own === 'district', coachCount: sp.own === 'state_sag' ? int(2, 6) : sp.own === 'district' ? 1 : null,
      womenOnlySlots: sp.own === 'state_sag' || i % 3 === 0, paraSports: sp.own === 'state_sag', openToSchools: sp.own !== 'private_ppp',
      condition: cond, lastMaintenance: sp.cond <= 2 ? '2023-03-15' : '2025-08-10', yearBuilt: 1995 + int(0, 28),
      weeklyUsersEstimate: sp.use, athletesTrainedLastYear: sp.own === 'state_sag' ? int(40, 120) : sp.own === 'district' ? int(10, 40) : null,
      cwg: sp.cwg || 'none', photos: makePhotos(sp, i, i === 16 || i === 19 || i === 30).map(p => ({ ...p, capturedBy: dso })),
      status, createdBy: dso, createdAt, updatedAt: createdAt,
      submittedAt: status === 'draft' ? null : iso(ago - 3), approvedAt: status === 'approved' ? iso(ago - 5) : null,
      lastVerifiedAt: status === 'approved' ? iso(ago - 5) : null, published: null,
    }
    return f
  })

  // QR check-ins over the last 45 days for approved facilities
  const checkins: CheckIn[] = []
  facilities.forEach((f, fi) => {
    if (f.status !== 'approved') return
    // QR scans roughly match the DSO's weekly estimate; a few facilities get few scans so the estimate is used
    const lowScan = fi % 5 === 4
    const perDay = lowScan ? 0.2 : Math.min(8, Math.max(1, Math.round(SPECS[fi].use / 150)))
    const groupAvg = lowScan ? 2 : Math.max(1, Math.round((SPECS[fi].use * 0.85) / 7 / perDay))
    for (let d = 0; d < 45; d++) {
      const n = lowScan ? (rnd() < perDay ? 1 : 0) : Math.max(0, perDay + int(-1, 1))
      for (let k = 0; k < n; k++) {
        checkins.push({
          id: `c${checkins.length}`, facilityId: f.id, at: iso(d, int(6, 20)),
          sport: pick(f.sports), role: pick(['player', 'player', 'player', 'coach', 'parent', 'visitor'] as const),
          gender: pick(['male', 'male', 'female', 'female', 'male', 'na'] as const),
          ageGroup: pick(['u14', '14_18', '14_18', '19_25', '26_40', '40plus'] as const),
          groupSize: Math.max(1, groupAvg + int(-Math.floor(groupAvg / 2), Math.floor(groupAvg / 2))),
        })
      }
    }
  })

  const gCats: Grievance['category'][] = ['closed_when_should_be_open', 'damaged', 'unsafe', 'wrong_info', 'fee_issue', 'staff', 'other']
  const gText: Record<string, string> = {
    closed_when_should_be_open: 'Gate was locked at 7 am although board says open from 6 am.',
    damaged: 'Net and goal posts are broken.',
    unsafe: 'No lights near the parking in the evening.',
    wrong_info: 'Phone number on the board does not work.',
    fee_issue: 'Asked to pay although the ground is listed as free.',
    staff: 'Caretaker did not allow girls to use the court.',
    other: 'Drinking water cooler not working.',
  }
  const grievances: Grievance[] = Array.from({ length: 28 }, (_, i) => {
    const appr = facilities.filter(x => x.status === 'approved')
    const f = appr[(i * 7) % appr.length]
    const cat = gCats[i % gCats.length]
    const days = int(0, 20)
    const resolved = i % 3 === 0
    return {
      id: `g${i}`, ref: `KSG-${String(2611001 + i)}`, facilityId: f.id, category: cat, description: gText[cat],
      photo: null, at: iso(days), status: resolved ? 'resolved' : 'open',
      resolvedAt: resolved ? iso(Math.max(0, days - int(1, 5))) : null, resolutionNote: resolved ? 'Fixed by caretaker.' : '',
    }
  })

  const ratings: Rating[] = []
  facilities.filter(f => f.status === 'approved').forEach((f, i) => {
    const base = Math.round(((f.condition.overall_cleanliness || 3) + 1) / 1.2)
    for (let k = 0; k < 3 + (i % 4); k++) {
      const v = () => Math.max(1, Math.min(5, base + int(-1, 1)))
      ratings.push({ id: `r${ratings.length}`, facilityId: f.id, at: iso(int(0, 30)), overall: v(), cleanliness: v(), onTime: v(), staff: v(), comment: '' })
    }
  })

  const reviews = facilities.filter(f => f.status === 'returned').map(f => ({
    id: `rv_${f.id}`, facilityId: f.id, by: 'u_state', action: 'returned' as const,
    comment: 'Changing room photo missing. Please add it and re-check the toilet ratings.', reasons: ['photos', 'condition'], at: iso(3),
  }))

  return { version: SEED_VERSION, users, facilities, checkins, grievances, ratings, reviews, audit: [] }
}

export { SPORTS }
