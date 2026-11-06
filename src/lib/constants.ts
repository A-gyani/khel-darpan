import type { ConditionKey, DayKey, FacilityType, Ownership, PhotoCaption, GrievanceCategory } from './types'

export const DISTRICT = 'ahmedabad'

// [CONFIRM] against lgdirectory.gov.in before any real use
export const TALUKAS: { id: string; en: string; gu: string; lat: number; lng: number }[] = [
  { id: 'ahmedabad_city', en: 'Ahmedabad City', gu: 'અમદાવાદ શહેર', lat: 23.0225, lng: 72.5714 },
  { id: 'bavla', en: 'Bavla', gu: 'બાવળા', lat: 22.83, lng: 72.366 },
  { id: 'daskroi', en: 'Daskroi', gu: 'દસક્રોઈ', lat: 22.95, lng: 72.65 },
  { id: 'detroj_rampura', en: 'Detroj-Rampura', gu: 'દેત્રોજ-રામપુરા', lat: 23.33, lng: 72.18 },
  { id: 'dhandhuka', en: 'Dhandhuka', gu: 'ધંધુકા', lat: 22.38, lng: 71.98 },
  { id: 'dholera', en: 'Dholera', gu: 'ધોલેરા', lat: 22.25, lng: 72.19 },
  { id: 'dholka', en: 'Dholka', gu: 'ધોળકા', lat: 22.727, lng: 72.441 },
  { id: 'mandal', en: 'Mandal', gu: 'માંડલ', lat: 23.28, lng: 71.92 },
  { id: 'sanand', en: 'Sanand', gu: 'સાણંદ', lat: 22.99, lng: 72.38 },
  { id: 'viramgam', en: 'Viramgam', gu: 'વિરમગામ', lat: 23.12, lng: 72.03 },
]

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
