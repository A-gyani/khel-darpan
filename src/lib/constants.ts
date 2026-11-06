import type { ConditionKey, DayKey, FacilityType, Ownership, PhotoCaption, GrievanceCategory } from './types'

// All districts of Gujarat. Demo data exists for Ahmedabad, Surat and Gandhinagar only.
export const DISTRICTS: { id: string; en: string; gu: string; lat: number; lng: number }[] = [
  { id: 'ahmedabad', en: 'Ahmedabad', gu: 'અમદાવાદ', lat: 23.0225, lng: 72.5714 },
  { id: 'surat', en: 'Surat', gu: 'સુરત', lat: 21.1702, lng: 72.8311 },
  { id: 'gandhinagar', en: 'Gandhinagar', gu: 'ગાંધીનગર', lat: 23.2156, lng: 72.6369 },
  // Remaining districts (no talukas / demo data yet). 34 districts incl. Vav-Tharad (2025) – [CONFIRM] against LGD
  { id: 'amreli', en: 'Amreli', gu: 'અમરેલી', lat: 21.6, lng: 71.22 },
  { id: 'anand', en: 'Anand', gu: 'આણંદ', lat: 22.56, lng: 72.95 },
  { id: 'aravalli', en: 'Aravalli', gu: 'અરવલ્લી', lat: 23.46, lng: 73.3 },
  { id: 'banaskantha', en: 'Banaskantha', gu: 'બનાસકાંઠા', lat: 24.17, lng: 72.43 },
  { id: 'bharuch', en: 'Bharuch', gu: 'ભરૂચ', lat: 21.7, lng: 72.98 },
  { id: 'bhavnagar', en: 'Bhavnagar', gu: 'ભાવનગર', lat: 21.76, lng: 72.15 },
  { id: 'botad', en: 'Botad', gu: 'બોટાદ', lat: 22.17, lng: 71.67 },
  { id: 'chhota_udaipur', en: 'Chhota Udaipur', gu: 'છોટા ઉદેપુર', lat: 22.3, lng: 74.01 },
  { id: 'dahod', en: 'Dahod', gu: 'દાહોદ', lat: 22.84, lng: 74.25 },
  { id: 'dang', en: 'Dang', gu: 'ડાંગ', lat: 20.75, lng: 73.69 },
  { id: 'devbhumi_dwarka', en: 'Devbhumi Dwarka', gu: 'દેવભૂમિ દ્વારકા', lat: 22.21, lng: 69.65 },
  { id: 'gir_somnath', en: 'Gir Somnath', gu: 'ગીર સોમનાથ', lat: 20.91, lng: 70.37 },
  { id: 'jamnagar', en: 'Jamnagar', gu: 'જામનગર', lat: 22.47, lng: 70.06 },
  { id: 'junagadh', en: 'Junagadh', gu: 'જૂનાગઢ', lat: 21.52, lng: 70.46 },
  { id: 'kheda', en: 'Kheda', gu: 'ખેડા', lat: 22.75, lng: 72.68 },
  { id: 'kutch', en: 'Kutch', gu: 'કચ્છ', lat: 23.25, lng: 69.67 },
  { id: 'mahisagar', en: 'Mahisagar', gu: 'મહીસાગર', lat: 23.13, lng: 73.61 },
  { id: 'mehsana', en: 'Mehsana', gu: 'મહેસાણા', lat: 23.6, lng: 72.39 },
  { id: 'morbi', en: 'Morbi', gu: 'મોરબી', lat: 22.82, lng: 70.84 },
  { id: 'narmada', en: 'Narmada', gu: 'નર્મદા', lat: 21.87, lng: 73.5 },
  { id: 'navsari', en: 'Navsari', gu: 'નવસારી', lat: 20.95, lng: 72.92 },
  { id: 'panchmahal', en: 'Panchmahal', gu: 'પંચમહાલ', lat: 22.77, lng: 73.61 },
  { id: 'patan', en: 'Patan', gu: 'પાટણ', lat: 23.85, lng: 72.13 },
  { id: 'porbandar', en: 'Porbandar', gu: 'પોરબંદર', lat: 21.64, lng: 69.61 },
  { id: 'rajkot', en: 'Rajkot', gu: 'રાજકોટ', lat: 22.3, lng: 70.8 },
  { id: 'sabarkantha', en: 'Sabarkantha', gu: 'સાબરકાંઠા', lat: 23.6, lng: 72.97 },
  { id: 'surendranagar', en: 'Surendranagar', gu: 'સુરેન્દ્રનગર', lat: 22.73, lng: 71.64 },
  { id: 'tapi', en: 'Tapi', gu: 'તાપી', lat: 21.12, lng: 73.4 },
  { id: 'vadodara', en: 'Vadodara', gu: 'વડોદરા', lat: 22.31, lng: 73.18 },
  { id: 'valsad', en: 'Valsad', gu: 'વલસાડ', lat: 20.61, lng: 72.93 },
  { id: 'vav_tharad', en: 'Vav-Tharad', gu: 'વાવ-થરાદ', lat: 24.39, lng: 71.63 },
]

export interface Taluka { id: string; district: string; en: string; gu: string; lat: number; lng: number }

// [CONFIRM] against lgdirectory.gov.in before any real use
export const TALUKAS: Taluka[] = [
  // Ahmedabad
  { id: 'ahmedabad_city', district: 'ahmedabad', en: 'Ahmedabad City', gu: 'અમદાવાદ શહેર', lat: 23.0225, lng: 72.5714 },
  { id: 'bavla', district: 'ahmedabad', en: 'Bavla', gu: 'બાવળા', lat: 22.83, lng: 72.366 },
  { id: 'daskroi', district: 'ahmedabad', en: 'Daskroi', gu: 'દસક્રોઈ', lat: 22.95, lng: 72.65 },
  { id: 'detroj_rampura', district: 'ahmedabad', en: 'Detroj-Rampura', gu: 'દેત્રોજ-રામપુરા', lat: 23.33, lng: 72.18 },
  { id: 'dhandhuka', district: 'ahmedabad', en: 'Dhandhuka', gu: 'ધંધુકા', lat: 22.38, lng: 71.98 },
  { id: 'dholera', district: 'ahmedabad', en: 'Dholera', gu: 'ધોલેરા', lat: 22.25, lng: 72.19 },
  { id: 'dholka', district: 'ahmedabad', en: 'Dholka', gu: 'ધોળકા', lat: 22.727, lng: 72.441 },
  { id: 'mandal', district: 'ahmedabad', en: 'Mandal', gu: 'માંડલ', lat: 23.28, lng: 71.92 },
  { id: 'sanand', district: 'ahmedabad', en: 'Sanand', gu: 'સાણંદ', lat: 22.99, lng: 72.38 },
  { id: 'viramgam', district: 'ahmedabad', en: 'Viramgam', gu: 'વિરમગામ', lat: 23.12, lng: 72.03 },
  // Surat
  { id: 'surat_city', district: 'surat', en: 'Surat City', gu: 'સુરત શહેર', lat: 21.1702, lng: 72.8311 },
  { id: 'bardoli', district: 'surat', en: 'Bardoli', gu: 'બારડોલી', lat: 21.1225, lng: 73.1115 },
  { id: 'choryasi', district: 'surat', en: 'Choryasi', gu: 'ચોર્યાસી', lat: 21.09, lng: 72.86 },
  { id: 'kamrej', district: 'surat', en: 'Kamrej', gu: 'કામરેજ', lat: 21.27, lng: 72.96 },
  { id: 'mahuva_surat', district: 'surat', en: 'Mahuva', gu: 'મહુવા', lat: 21.02, lng: 73.15 },
  { id: 'mandvi_surat', district: 'surat', en: 'Mandvi', gu: 'માંડવી', lat: 21.25, lng: 73.3 },
  { id: 'mangrol_surat', district: 'surat', en: 'Mangrol', gu: 'માંગરોળ', lat: 21.35, lng: 73.12 },
  { id: 'olpad', district: 'surat', en: 'Olpad', gu: 'ઓલપાડ', lat: 21.33, lng: 72.75 },
  { id: 'palsana', district: 'surat', en: 'Palsana', gu: 'પલસાણા', lat: 21.08, lng: 72.99 },
  { id: 'umarpada', district: 'surat', en: 'Umarpada', gu: 'ઉમરપાડા', lat: 21.45, lng: 73.48 },
  // Gandhinagar
  { id: 'gandhinagar_tal', district: 'gandhinagar', en: 'Gandhinagar', gu: 'ગાંધીનગર', lat: 23.2156, lng: 72.6369 },
  { id: 'kalol_gnr', district: 'gandhinagar', en: 'Kalol', gu: 'કલોલ', lat: 23.2464, lng: 72.501 },
  { id: 'dehgam', district: 'gandhinagar', en: 'Dehgam', gu: 'દહેગામ', lat: 23.17, lng: 72.82 },
  { id: 'mansa', district: 'gandhinagar', en: 'Mansa', gu: 'માણસા', lat: 23.425, lng: 72.66 },
]

export const talukasOf = (district: string) => TALUKAS.filter(x => x.district === district)
export const districtOf = (id: string) => DISTRICTS.find(d => d.id === id)
export const placeName = (p: { en: string; gu: string } | undefined, lang: string) => (p ? (lang === 'gu' ? p.gu : p.en) : '')

export const FACILITY_TYPES: FacilityType[] = [
  'stadium', 'sports_complex', 'indoor_hall', 'open_ground', 'swimming_pool',
  'court', 'gym', 'akhada', 'school_ground', 'other',
]

export const OWNERSHIP: Ownership[] = ['state_sag', 'district', 'municipal', 'school_college', 'private_ppp', 'other']

export const SPORTS = [
  'athletics', 'football', 'cricket', 'hockey', 'kabaddi', 'kho_kho', 'volleyball', 'basketball',
  'badminton', 'table_tennis', 'tennis', 'swimming', 'wrestling', 'boxing', 'judo', 'archery',
  'shooting', 'weightlifting', 'yoga', 'chess', 'other',
]

// Provisional list for the dashboard view. [CONFIRM] with the official CWG 2030 sports programme.
export const CWG_SPORTS = [
  'athletics', 'swimming', 'hockey', 'badminton', 'table_tennis', 'boxing', 'wrestling',
  'weightlifting', 'judo', 'shooting', 'cricket', 'basketball',
]

export const AMENITIES = [
  'floodlights', 'changing_room_men', 'changing_room_women', 'toilets_men', 'toilets_women',
  'drinking_water', 'first_aid', 'seating', 'parking', 'equipment_available', 'ramp_access',
  'accessible_toilet', 'hostel',
]

export const CONDITION_KEYS: ConditionKey[] = [
  'surface', 'lighting', 'toilets', 'changing_rooms', 'water', 'seating', 'safety_equipment', 'overall_cleanliness',
]

export const DAYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const PHOTO_CAPTIONS: PhotoCaption[] = ['entrance', 'playing_area', 'toilets', 'changing_room', 'lighting', 'damage', 'other']

export const GRIEVANCE_CATEGORIES: GrievanceCategory[] = [
  'closed_when_should_be_open', 'damaged', 'unsafe', 'wrong_info', 'fee_issue', 'staff', 'other',
]

export const SURFACES = ['natural_grass', 'synthetic_turf', 'clay_earth', 'concrete', 'wooden', 'synthetic_court', 'mats', 'water', 'other']

// Return reasons and the form step (0-based) the DSO is sent to
export const RETURN_REASONS: { id: string; step: number }[] = [
  { id: 'photos', step: 1 },
  { id: 'location', step: 2 },
  { id: 'condition', step: 5 },
  { id: 'details', step: 0 },
  { id: 'timings_fees', step: 4 },
  { id: 'sports', step: 3 },
  { id: 'duplicate', step: 0 },
  { id: 'other', step: 0 },
]

export const ESCALATE_AFTER_DAYS = 7
export const FAR_FROM_PIN_M = 200
export const POOR_GPS_M = 50
export const MAX_CHECKINS_PER_DAY = 2
export const DEMO_OTP = '123456'
