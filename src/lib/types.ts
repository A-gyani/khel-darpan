export type Role = 'public' | 'district_officer' | 'state_officer'

export type FacilityType =
  | 'stadium' | 'sports_complex' | 'indoor_hall' | 'open_ground' | 'swimming_pool'
  | 'court' | 'gym' | 'akhada' | 'school_ground' | 'other'

export type Ownership = 'state_sag' | 'district' | 'municipal' | 'school_college' | 'private_ppp' | 'other'

export type Status = 'draft' | 'submitted' | 'approved' | 'returned' | 'rejected'

export type CwgTag = 'none' | 'venue' | 'training'

export type PhotoCaption = 'entrance' | 'playing_area' | 'toilets' | 'changing_room' | 'lighting' | 'damage' | 'other'

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
// open2/close2 = optional second shift (e.g. morning and evening)
export type DayTiming = { open: string; close: string; open2?: string; close2?: string } | null
export type Timings = Record<DayKey, DayTiming>

export type ConditionKey =
  | 'surface' | 'lighting' | 'toilets' | 'changing_rooms' | 'water'
  | 'seating' | 'safety_equipment' | 'overall_cleanliness'
export type Condition = Partial<Record<ConditionKey, number>>

export interface User {
  id: string
  fullName: string
  email: string
  phone: string
  password: string // local demo mode only
  role: Role
  district?: string
}

export interface Photo {
  id: string
  caption: PhotoCaption
  dataUrl: string
  thumbUrl: string
  lat: number | null
  lng: number | null
  accuracy: number | null
  capturedAt: string
  capturedBy: string
  sha256: string
  distanceFromPin: number | null
  flagFar: boolean
  flagDuplicate: boolean
  flagPoorGps: boolean
}

export interface Facility {
  id: string
  demo?: boolean
  name: string
  type: FacilityType
  ownership: Ownership
  district: string
  taluka: string
  ward: string
  address: string
  lat: number | null
  lng: number | null
  gpsLat: number | null // original GPS reading, kept even if pin is dragged
  gpsLng: number | null
  gpsAccuracy: number | null
  sports: string[]
  amenities: string[]
  timings: Timings
  feeType: 'free' | 'paid' | 'subsidised'
  feeAmount: number | null
  feeUnit: 'per_hour' | 'per_month' | 'per_year'
  bookingName: string
  bookingPhone: string
  capacity: number | null
  surface: string
  coachAvailable: boolean
  coachCount: number | null
  womenOnlySlots: boolean
  paraSports: boolean
  openToSchools: boolean
  condition: Condition
  lastMaintenance: string // yyyy-mm-dd or ''
  yearBuilt: number | null
  weeklyUsersEstimate: number | null
  athletesTrainedLastYear: number | null
  cwg: CwgTag
  photos: Photo[]
  status: Status
  published?: Omit<Facility, 'published'> | null // last approved copy, shown publicly during re-review
  createdBy: string
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  approvedAt: string | null
  lastVerifiedAt: string | null
}

export interface CheckIn {
  id: string
  facilityId: string
  at: string
  sport: string
  role: 'player' | 'coach' | 'parent' | 'visitor'
  gender: 'female' | 'male' | 'other' | 'na'
  ageGroup: 'u14' | '14_18' | '19_25' | '26_40' | '40plus' | 'na'
  groupSize: number
}

export type GrievanceCategory = 'closed_when_should_be_open' | 'damaged' | 'unsafe' | 'wrong_info' | 'fee_issue' | 'staff' | 'other'

export interface Grievance {
  id: string
  ref: string
  facilityId: string
  category: GrievanceCategory
  description: string
  photo: string | null
  at: string
  status: 'open' | 'resolved'
  resolvedAt: string | null
  resolutionNote: string
}

export interface Rating {
  id: string
  facilityId: string
  at: string
  overall: number
  cleanliness: number
  onTime: number
  staff: number
  comment: string
}

export interface ReviewAction {
  id: string
  facilityId: string
  by: string
  action: 'approved' | 'returned' | 'rejected'
  comment: string
  reasons?: string[] // what the DSO must fix (return) – see RETURN_REASONS
  at: string
}

export interface AuditEntry {
  id: string
  actor: string
  facilityId: string
  action: string
  detail: string
  at: string
}

export interface DB {
  version: number
  users: User[]
  facilities: Facility[]
  checkins: CheckIn[]
  grievances: Grievance[]
  ratings: Rating[]
  reviews: ReviewAction[]
  audit: AuditEntry[]
}
