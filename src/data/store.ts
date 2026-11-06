// Data store.
// - Local demo mode (no Supabase keys): everything kept in this browser (IndexedDB), preloaded with seed data.
// - Supabase mode (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY): one shared database for all devices.
//   Screens read the same in-memory snapshot; every change is applied locally at once and saved to Supabase in the background.
import { openDB } from 'idb'
import { useSyncExternalStore } from 'react'
import type { DB, Facility, CheckIn, Grievance, Rating, ReviewAction, User, AuditEntry } from '../lib/types'
import { buildSeed, SEED_VERSION } from './seed'
import { uid } from '../lib/geo'
import { MAX_CHECKINS_PER_DAY } from '../lib/constants'
import * as R from './remote'

export const REMOTE = R.REMOTE
const DB_NAME = 'khel-darpan'
const EMPTY: DB = { version: SEED_VERSION, users: [], facilities: [], checkins: [], grievances: [], ratings: [], reviews: [], audit: [] }
let state: DB = REMOTE ? EMPTY : buildSeed()
const listeners = new Set<() => void>()
let ready = false
let sessionUserId: string | null = null

const idb = () => openDB(DB_NAME, 1, { upgrade(d) { d.createObjectStore('kv') } })

export async function initStore() {
  if (REMOTE) {
    try {
      const s = await R.getSession()
      sessionUserId = s?.user.id ?? null
      await reload()
      R.subscribe(() => { void reload() })
    } catch (e) { R.reportError('load', e) }
  } else {
    try {
      const d = await idb()
      const saved = (await d.get('kv', 'db')) as DB | undefined
      if (saved && saved.version === SEED_VERSION) state = saved
      else await d.put('kv', state, 'db')
    } catch { /* private mode etc. – keep in-memory seed */ }
  }
  ready = true
  state = { ...state }
  emit()
}

/** Supabase: fetch everything this user may see. */
export async function reload() {
  if (!REMOTE) return
  try {
    const data = await R.loadAll(!!sessionUserId)
    state = { version: SEED_VERSION, ...data }
    emit()
  } catch (e) { R.reportError('load', e) }
}

function emit() { listeners.forEach(l => l()) }

async function persist() {
  if (REMOTE) return
  try { const d = await idb(); await d.put('kv', state, 'db') } catch { /* ignore */ }
}

let pendingAudit: AuditEntry[] = []
function commit(next: DB) {
  state = next
  emit()
  void persist()
  if (REMOTE && pendingAudit.length && sessionUserId) {
    const rows = pendingAudit.map(R.rowOf.audit); pendingAudit = []
    R.insertRows('audit', rows).catch(e => R.reportError('history', e))
  } else pendingAudit = []
}
/** Run a Supabase write in the background; report failures to the screen. */
function sync(where: string, job: () => Promise<unknown>) {
  if (!REMOTE) return
  job().catch(e => R.reportError(where, e))
}

export function useDb(): DB {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => state)
}
export const isReady = () => ready
export const getDb = () => state

export async function resetDemo() {
  if (REMOTE) {
    try { await R.loadDemo(buildSeed(), state.users); await reload() } catch (e) { R.reportError('demo data', e) }
    return
  }
  commit(buildSeed())
}

/* ---------- auth ---------- */
const SESSION_KEY = 'ks_session'
export function currentUserId(): string | null {
  if (REMOTE) return sessionUserId
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
}
/** Email + password, or (demo OTP) a registered mobile number with no password. */
export async function login(emailOrPhone: string, password?: string): Promise<User | null> {
  if (REMOTE) {
    let email = emailOrPhone
    if (/^\d{10}$/.test(emailOrPhone)) email = (await R.emailForPhone(emailOrPhone)) || ''
    if (!email) return null
    const s = await R.signIn(email, password ?? R.DEMO_PASSWORD)
    if (!s) return null
    sessionUserId = s.user.id
    await reload()
    return state.users.find(u => u.id === sessionUserId) || null
  }
  const u = state.users.find(x => x.email.toLowerCase() === emailOrPhone.toLowerCase() || x.phone === emailOrPhone)
  if (!u) return null
  if (password !== undefined && u.password !== password) return null
  try { localStorage.setItem(SESSION_KEY, u.id) } catch { /* ignore */ }
  state = { ...state }
  emit()
  return u
}
export async function phoneRegistered(phone: string): Promise<boolean> {
  if (REMOTE) return !!(await R.emailForPhone(phone))
  return state.users.some(u => u.phone === phone)
}
export function logout() {
  if (REMOTE) {
    sessionUserId = null
    state = EMPTY; emit()
    R.signOut().then(() => reload())
    return
  }
  try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  state = { ...state }; emit()
}

/* ---------- facilities ---------- */
const now = () => new Date().toISOString()

function audit(db: DB, actor: string, facilityId: string, action: string, detail = ''): DB {
  const a = { id: uid(), actor, facilityId, action, detail, at: now() }
  pendingAudit.push(a)
  return { ...db, audit: [...db.audit, a] }
}

/** After a Supabase save, swap in the stored version (photo links instead of large image data). */
function replaceSaved(saved: Facility) {
  state = { ...state, facilities: state.facilities.map(x => (x.id === saved.id ? { ...saved, status: x.status, published: x.published } : x)) }
  emit()
}

export function saveFacility(f: Facility, actor: string, changed: string[] = []) {
  const stored = state.facilities.find(x => x.id === f.id)
  const exists = !!stored
  let updated: Facility = { ...f, updatedAt: now() }
  if (stored?.status === 'approved') {
    // Editing an approved facility: keep the approved copy for the public and the reviewer,
    // and turn the working copy into a draft until it is submitted and approved again.
    const { published: _p, ...approvedCopy } = stored
    updated = { ...updated, published: approvedCopy, status: 'draft' }
  } else if (stored) {
    // status only changes through submit / review, never through the form's own copy
    updated = { ...updated, status: stored.status, published: stored.published ?? updated.published ?? null }
  }
  const facilities = exists ? state.facilities.map(x => (x.id === f.id ? updated : x)) : [...state.facilities, updated]
  commit(audit({ ...state, facilities }, actor, f.id, exists ? 'updated' : 'created', changed.join(', ')))
  sync('save facility', async () => replaceSaved(await R.putFacility(updated)))
}

export function submitFacility(id: string, actor: string) {
  const facilities = state.facilities.map(f => {
    if (f.id !== id) return f
    // keep last approved copy public while the edit is re-reviewed
    const published = f.status === 'approved' ? { ...f, published: undefined } : f.published ?? null
    return { ...f, status: 'submitted' as const, submittedAt: now(), published }
  })
  commit(audit({ ...state, facilities }, actor, id, 'submitted'))
  const f = facilities.find(x => x.id === id)!
  sync('submit', async () => replaceSaved(await R.putFacility(f)))
}

export function reviewFacility(id: string, actor: string, action: ReviewAction['action'], comment: string, reasons: string[] = []) {
  const status = action
  const facilities = state.facilities.map(f => f.id !== id ? f : {
    ...f, status,
    approvedAt: action === 'approved' ? now() : f.approvedAt,
    lastVerifiedAt: action === 'approved' ? now() : f.lastVerifiedAt,
    published: action === 'approved' ? null : f.published,
  })
  const review: ReviewAction = { id: uid(), facilityId: id, by: actor, action, comment, reasons, at: now() }
  const reviews = [...state.reviews, review]
  commit(audit({ ...state, facilities, reviews }, actor, id, action, [reasons.length ? `[${reasons.join(', ')}]` : '', comment].filter(Boolean).join(' ')))
  const f = facilities.find(x => x.id === id)!
  sync('review', async () => {
    await R.putFacility(f, action === 'approved' ? { ...f, published: null } : undefined)
    await R.insertOne('reviews', R.rowOf.review(review))
  })
}

/** DSO can delete only their own drafts (never submitted or approved records). */
export function deleteDraft(id: string, actor: string): boolean {
  const f = state.facilities.find(x => x.id === id)
  if (!f || f.status !== 'draft') return false
  commit(audit({ ...state, facilities: state.facilities.filter(x => x.id !== id) }, actor, id, 'deleted', f.name))
  sync('delete draft', () => R.deleteFacilityRow(id))
  return true
}

/** What the public sees: approved facilities, or the last approved copy while an edit is under review */
export function publicFacilities(db: DB): Facility[] {
  return db.facilities.flatMap(f => {
    if (f.status === 'approved') return [f]
    if (f.published) return [{ ...(f.published as Facility), id: f.id }]
    return []
  })
}

/* ---------- QR: check-ins, grievances, ratings ---------- */
const districtOfFacility = (id: string) => state.facilities.find(f => f.id === id)?.district

function todayKey(facilityId: string) {
  return `ks_ci_${facilityId}_${new Date().toISOString().slice(0, 10)}`
}
export function checkInsLeftToday(facilityId: string) {
  try { return MAX_CHECKINS_PER_DAY - Number(localStorage.getItem(todayKey(facilityId)) || 0) } catch { return MAX_CHECKINS_PER_DAY }
}
export function addCheckIn(c: Omit<CheckIn, 'id' | 'at'>): boolean {
  if (checkInsLeftToday(c.facilityId) <= 0) return false
  try { localStorage.setItem(todayKey(c.facilityId), String(MAX_CHECKINS_PER_DAY - checkInsLeftToday(c.facilityId) + 1)) } catch { /* ignore */ }
  const row: CheckIn = { ...c, id: uid(), at: now() }
  commit({ ...state, checkins: [...state.checkins, row] })
  sync('check-in', () => R.insertOne('checkins', R.rowOf.checkin(row, districtOfFacility(c.facilityId))))
  return true
}

/** Reference number that is unique without reading other complaints (citizens cannot). */
function newRef() {
  const d = new Date()
  return `KSG-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function addGrievance(g: Omit<Grievance, 'id' | 'ref' | 'at' | 'status' | 'resolvedAt' | 'resolutionNote'>): string {
  const row: Grievance = { ...g, id: uid(), ref: newRef(), at: now(), status: 'open', resolvedAt: null, resolutionNote: '' }
  commit({ ...state, grievances: [...state.grievances, row] })
  sync('complaint', async () => {
    const photo = row.photo && row.photo.startsWith('data:') ? await R.uploadReportPhoto(row.photo, row.id) : row.photo
    await R.insertOne('grievances', R.rowOf.grievance({ ...row, photo }, districtOfFacility(g.facilityId)))
  })
  return row.ref
}

export function resolveGrievance(id: string, note: string, actor: string) {
  const g = state.grievances.find(x => x.id === id)
  const grievances = state.grievances.map(x => x.id === id ? { ...x, status: 'resolved' as const, resolvedAt: now(), resolutionNote: note } : x)
  commit(audit({ ...state, grievances }, actor, g?.facilityId || '', 'grievance_resolved', `${g?.ref}: ${note}`))
  const updated = grievances.find(x => x.id === id)
  if (updated) sync('resolve complaint', () => R.updateGrievance(updated))
}

const rateKey = (facilityId: string) => `ks_rt_${facilityId}_${new Date().toISOString().slice(0, 10)}`
export function ratedToday(facilityId: string) {
  try { return !!localStorage.getItem(rateKey(facilityId)) } catch { return false }
}
/** One rating per phone per facility per day. Returns false if already rated today. */
export function addRating(r: Omit<Rating, 'id' | 'at'>): boolean {
  if (ratedToday(r.facilityId)) return false
  try { localStorage.setItem(rateKey(r.facilityId), '1') } catch { /* ignore */ }
  const row: Rating = { ...r, id: uid(), at: now() }
  commit({ ...state, ratings: [...state.ratings, row] })
  sync('rating', () => R.insertOne('ratings', R.rowOf.rating(row)))
  return true
}

export function avgRating(db: DB, facilityId: string) {
  const rs = db.ratings.filter(r => r.facilityId === facilityId)
  if (!rs.length) return null
  return { avg: rs.reduce((s, r) => s + r.overall, 0) / rs.length, count: rs.length }
}
