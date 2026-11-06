// Data store. Local demo mode: everything kept in this browser (IndexedDB), preloaded with seed data.
// Supabase mode (when VITE_SUPABASE_URL is set) will plug in behind the same functions.
import { openDB } from 'idb'
import { useSyncExternalStore } from 'react'
import type { DB, Facility, CheckIn, Grievance, Rating, ReviewAction, User } from '../lib/types'
import { buildSeed, SEED_VERSION } from './seed'
import { uid } from '../lib/geo'
import { MAX_CHECKINS_PER_DAY } from '../lib/constants'

const DB_NAME = 'khel-darpan'
let state: DB = buildSeed()
const listeners = new Set<() => void>()
let ready = false

const idb = () => openDB(DB_NAME, 1, { upgrade(d) { d.createObjectStore('kv') } })

export async function initStore() {
  try {
    const d = await idb()
    const saved = (await d.get('kv', 'db')) as DB | undefined
    if (saved && saved.version === SEED_VERSION) state = saved
    else await d.put('kv', state, 'db')
  } catch {
    /* private mode etc. – keep in-memory seed */
  }
  ready = true
  state = { ...state } // new snapshot so subscribers re-render
  emit()
}

function emit() { listeners.forEach(l => l()) }

async function persist() {
  try { const d = await idb(); await d.put('kv', state, 'db') } catch { /* ignore */ }
}

function commit(next: DB) {
  state = next
  emit()
  void persist()
}

export function useDb(): DB {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => state)
}
export const isReady = () => ready
export const getDb = () => state

export async function resetDemo() {
  commit(buildSeed())
}

/* ---------- auth ---------- */
const SESSION_KEY = 'ks_session'
export function currentUserId(): string | null {
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
}
export function login(emailOrPhone: string, password?: string): User | null {
  const u = state.users.find(x => x.email.toLowerCase() === emailOrPhone.toLowerCase() || x.phone === emailOrPhone)
  if (!u) return null
  if (password !== undefined && u.password !== password) return null
  try { localStorage.setItem(SESSION_KEY, u.id) } catch { /* ignore */ }
  state = { ...state }
  emit()
  return u
}
export function findUserByPhone(phone: string) { return state.users.find(u => u.phone === phone) || null }
export function logout() { try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ } state = { ...state }; emit() }

/* ---------- facilities ---------- */
const now = () => new Date().toISOString()

function audit(db: DB, actor: string, facilityId: string, action: string, detail = ''): DB {
  return { ...db, audit: [...db.audit, { id: uid(), actor, facilityId, action, detail, at: now() }] }
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
}

export function submitFacility(id: string, actor: string) {
  const facilities = state.facilities.map(f => {
    if (f.id !== id) return f
    // keep last approved copy public while the edit is re-reviewed
    const published = f.status === 'approved' ? { ...f, published: undefined } : f.published ?? null
    return { ...f, status: 'submitted' as const, submittedAt: now(), published }
  })
  commit(audit({ ...state, facilities }, actor, id, 'submitted'))
}

export function reviewFacility(id: string, actor: string, action: ReviewAction['action'], comment: string, reasons: string[] = []) {
  const status = action
  const facilities = state.facilities.map(f => f.id !== id ? f : {
    ...f, status,
    approvedAt: action === 'approved' ? now() : f.approvedAt,
    lastVerifiedAt: action === 'approved' ? now() : f.lastVerifiedAt,
    published: action === 'approved' ? null : f.published,
  })
  const reviews = [...state.reviews, { id: uid(), facilityId: id, by: actor, action, comment, reasons, at: now() }]
  commit(audit({ ...state, facilities, reviews }, actor, id, action, [reasons.length ? `[${reasons.join(', ')}]` : '', comment].filter(Boolean).join(' ')))
}

/** DSO can delete only their own drafts (never submitted or approved records). */
export function deleteDraft(id: string, actor: string): boolean {
  const f = state.facilities.find(x => x.id === id)
  if (!f || f.status !== 'draft') return false
  commit(audit({ ...state, facilities: state.facilities.filter(x => x.id !== id) }, actor, id, 'deleted', f.name))
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
function todayKey(facilityId: string) {
  return `ks_ci_${facilityId}_${new Date().toISOString().slice(0, 10)}`
}
export function checkInsLeftToday(facilityId: string) {
  try { return MAX_CHECKINS_PER_DAY - Number(localStorage.getItem(todayKey(facilityId)) || 0) } catch { return MAX_CHECKINS_PER_DAY }
}
export function addCheckIn(c: Omit<CheckIn, 'id' | 'at'>): boolean {
  if (checkInsLeftToday(c.facilityId) <= 0) return false
  try { localStorage.setItem(todayKey(c.facilityId), String(MAX_CHECKINS_PER_DAY - checkInsLeftToday(c.facilityId) + 1)) } catch { /* ignore */ }
  commit({ ...state, checkins: [...state.checkins, { ...c, id: uid(), at: now() }] })
  return true
}

export function addGrievance(g: Omit<Grievance, 'id' | 'ref' | 'at' | 'status' | 'resolvedAt' | 'resolutionNote'>): string {
  const ref = 'KSG-' + String(2611001 + state.grievances.length)
  commit({ ...state, grievances: [...state.grievances, { ...g, id: uid(), ref, at: now(), status: 'open', resolvedAt: null, resolutionNote: '' }] })
  return ref
}

export function resolveGrievance(id: string, note: string, actor: string) {
  const g = state.grievances.find(x => x.id === id)
  const grievances = state.grievances.map(x => x.id === id ? { ...x, status: 'resolved' as const, resolvedAt: now(), resolutionNote: note } : x)
  commit(audit({ ...state, grievances }, actor, g?.facilityId || '', 'grievance_resolved', `${g?.ref}: ${note}`))
}

const rateKey = (facilityId: string) => `ks_rt_${facilityId}_${new Date().toISOString().slice(0, 10)}`
export function ratedToday(facilityId: string) {
  try { return !!localStorage.getItem(rateKey(facilityId)) } catch { return false }
}
/** One rating per phone per facility per day. Returns false if already rated today. */
export function addRating(r: Omit<Rating, 'id' | 'at'>): boolean {
  if (ratedToday(r.facilityId)) return false
  try { localStorage.setItem(rateKey(r.facilityId), '1') } catch { /* ignore */ }
  commit({ ...state, ratings: [...state.ratings, { ...r, id: uid(), at: now() }] })
  return true
}

export function avgRating(db: DB, facilityId: string) {
  const rs = db.ratings.filter(r => r.facilityId === facilityId)
  if (!rs.length) return null
  return { avg: rs.reduce((s, r) => s + r.overall, 0) / rs.length, count: rs.length }
}
