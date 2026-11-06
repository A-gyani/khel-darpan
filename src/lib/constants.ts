import type { ConditionKey, DayKey, FacilityType, Ownership, PhotoCaption, GrievanceCategory } from './types'

// Prototype districts. Add more here; everything else (forms, filters, dashboard) follows this list.
export const DISTRICTS: { id: string; en: string; gu: string; lat: number; lng: number }[] = [
  { id: 'ahmedabad', en: 'Ahmedabad', gu: 'અમદાવાદ', lat: 23.0225, lng: 72.5714 },
  { id: 'surat', en: 'Surat', gu: 'સુરત', lat: 21.1702, lng: 72.8311 },
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

export const ESCALATE_AFTER_DAYS = 7
export const FAR_FROM_PIN_M = 200
export const POOR_GPS_M = 50
export const MAX_CHECKINS_PER_DAY = 2
export const DEMO_OTP = '123456'
