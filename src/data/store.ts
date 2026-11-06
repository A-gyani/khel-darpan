// Data store.
// - Local demo mode (no Supabase keys): everything kept in this browser (IndexedDB), preloaded with seed data.
// - Supabase mode (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY): one shared database for all devices.
//   Screens read the same in-memory snapshot; every change is applied locally at once and saved to Supabase in the background.
// - Offline: every Supabase write goes through an outbox kept on the phone (IndexedDB) and is sent, in order, when the phone
//   is online. The last data loaded is also kept on the phone, so the app opens and works with no signal.
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
    let snap: Snapshot | undefined
    try {
      const d = await idb()
      outbox = ((await d.get('kv', OUTBOX_KEY)) as Op[] | undefined) || []
      snap = (await d.get('kv', SNAP_KEY)) as Snapshot | undefined
    } catch { /* private mode etc. */ }
    try {
      const s = await R.getSession()
      sessionUserId = s?.user.id ?? null
    } catch { /* offline: fall back to the user saved with the snapshot */ }
    if (!sessionUserId && !navigator.onLine && snap?.uid && snap.uid !== 'public') sessionUserId = snap.uid
    if (snap && snap.uid === (sessionUserId || 'public') && snap.db?.version === SEED_VERSION) state = snap.db
    emitSync()
    window.addEventListener('online', () => { void flush().then(() => reload()) })
    window.addEventListener('offline', emitSync)
    window.setInterval(() => { if (outbox.length) void flush() }, 30000)
    try {
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

/** Supabase: fetch everything this user may see. Changes still waiting in the outbox are sent first,
 *  so a reload never hides what was entered offline. */
export async function reload() {
  if (!REMOTE) return
  if (outbox.length) await flush()
  if (outbox.length || !navigator.onLine) return // keep the copy on this phone until everything is uploaded
  try {
    const data = await R.loadAll(!!sessionUserId)
    state = { version: SEED_VERSION, ...data }
    emit()
    void persist()
  } catch (e) { if (!isNetworkError(e)) R.reportError('load', e) }
}

/* ---------- offline: outbox + snapshot ---------- */
const OUTBOX_KEY = 'outbox'
const SNAP_KEY = 'snapshot'
type Snapshot = { uid: string; db: DB }
type Table = 'checkins' | 'grievances' | 'ratings' | 'reviews' | 'audit'
/** One Supabase write, stored as plain data so it survives the app being closed. */
type OpBody =
  | { kind: 'putFacility'; f: Facility; publicCopy?: Facility | null; replace: boolean }
  | { kind: 'deleteFacility'; facilityId: string }
  | { kind: 'insertOne'; table: Table; row: Record<string, unknown> }
  | { kind: 'insertRows'; table: Table; rows: Record<string, unknown>[] }
  | { kind: 'updateGrievance'; g: Grievance }
  | { kind: 'complaint'; g: Grievance; district?: string }
type Op = OpBody & { id: string; label: string }
let outbox: Op[] = []
let flushing = false
const syncListeners = new Set<() => void>()
let syncState = { online: true, pending: 0, uploading: false }
function emitSync() {
  syncState = { online: navigator.onLine, pending: outbox.length, uploading: flushing }
  syncListeners.forEach(l => l())
}
/** For the status bar: online or not, and how many changes are waiting to upload. */
export function useSyncStatus() {
  return useSyncExternalStore(cb => { syncListeners.add(cb); return () => syncListeners.delete(cb) }, () => syncState)
}
export const pendingCount = () => outbox.length

function isNetworkError(e: unknown) {
  if (!navigator.onLine) return true
  const m = String((e as { message?: string })?.message || e)
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|ERR_INTERNET|ERR_NETWORK/i.test(m)
}
async function saveOutbox() {
  try { const d = await idb(); await d.put('kv', outbox, OUTBOX_KEY) } catch { /* ignore */ }
}
async function runOp(op: Op) {
  switch (op.kind) {
    case 'putFacility': {
      const saved = await R.putFacility(op.f, op.publicCopy)
      if (op.replace) replaceSaved(saved)
      return
    }
    case 'deleteFacility': return R.deleteFacilityRow(op.facilityId)
    case 'insertOne': return R.insertOne(op.table, op.row)
    case 'insertRows': return R.insertRows(op.table, op.rows)
    case 'updateGrievance': return R.updateGrievance(op.g)
    case 'complaint': {
      const photo = op.g.photo && op.g.photo.startsWith('data:') ? await R.uploadReportPhoto(op.g.photo, op.g.id) : op.g.photo
      return R.insertOne('grievances', R.rowOf.grievance({ ...op.g, photo }, op.district))
    }
  }
}
/** Send waiting changes in the order they were made. Stops at the first network error and tries again later. */
async function flush() {
  if (!REMOTE || flushing || !outbox.length || !navigator.onLine) { emitSync(); return }
  flushing = true; emitSync()
  try {
    while (outbox.length) {
      const op = outbox[0]
      try {
        await runOp(op)
      } catch (e) {
        if (isNetworkError(e)) break
        // the database refused it (e.g. permissions): report it and move on so other changes are not blocked
        R.reportError(op.label, e)
      }
      outbox = outbox.slice(1)
      await saveOutbox()
      emitSync()
    }
  } finally { flushing = false; emitSync() }
}
/** Queue a Supabase write (sent now if online, later if not). */
function sync(op: OpBody & { label: string }) {
  if (!REMOTE) return
  outbox = [...outbox, { ...op, id: uid() }]
  emitSync()
  void saveOutbox().then(flush)
}

function emit() { listeners.forEach(l => l()) }

let persistTimer: number | undefined
async function persist() {
  if (REMOTE) {
    // keep a copy of what this user can see, so the app opens offline
    window.clearTimeout(persistTimer)
    persistTimer = window.setTimeout(async () => {
      try { const d = await idb(); await d.put('kv', { uid: sessionUserId || 'public', db: state } as Snapshot, SNAP_KEY) } catch { /* ignore */ }
    }, 400)
    return
  }
  try { const d = await idb(); await d.put('kv', state, 'db') } catch { /* ignore */ }
}

let pendingAudit: AuditEntry[] = []
function commit(next: DB) {
  state = next
  emit()
  void persist()
  if (REMOTE && pendingAudit.length && sessionUserId) {
    const rows = pendingAudit.map(R.rowOf.audit); pendingAudit = []
    sync({ kind: 'insertRows', table: 'audit', rows, label: 'history' })
  } else pendingAudit = []
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
    idb().then(d => d.delete('kv', SNAP_KEY)).catch(() => {})
    R.signOut().catch(() => {}).then(() => reload())
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
  sync({ kind: 'putFacility', f: updated, replace: true, label: 'save facility' })
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
  sync({ kind: 'putFacility', f, replace: true, label: 'submit' })
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
  sync({ kind: 'putFacility', f, publicCopy: action === 'approved' ? { ...f, published: null } : undefined, replace: false, label: 'review' })
  sync({ kind: 'insertOne', table: 'reviews', row: R.rowOf.review(review), label: 'review' })
}

/** DSO can delete only their own drafts (never submitted or approved records). */
export function deleteDraft(id: string, actor: string): boolean {
  const f = state.facilities.find(x => x.id === id)
  if (!f || f.status !== 'draft') return false
  commit(audit({ ...state, facilities: state.facilities.filter(x => x.id !== id) }, actor, id, 'deleted', f.name))
  sync({ kind: 'deleteFacility', facilityId: id, label: 'delete draft' })
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
  sync({ kind: 'insertOne', table: 'checkins', row: R.rowOf.checkin(row, districtOfFacility(c.facilityId)), label: 'check-in' })
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
  sync({ kind: 'complaint', g: row, district: districtOfFacility(g.facilityId), label: 'complaint' })
  return row.ref
}

export function resolveGrievance(id: string, note: string, actor: string) {
  const g = state.grievances.find(x => x.id === id)
  const grievances = state.grievances.map(x => x.id === id ? { ...x, status: 'resolved' as const, resolvedAt: now(), resolutionNote: note } : x)
  commit(audit({ ...state, grievances }, actor, g?.facilityId || '', 'grievance_resolved', `${g?.ref}: ${note}`))
  const updated = grievances.find(x => x.id === id)
  if (updated) sync({ kind: 'updateGrievance', g: updated, label: 'resolve complaint' })
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
  sync({ kind: 'insertOne', table: 'ratings', row: R.rowOf.rating(row), label: 'rating' })
  return true
}

export function avgRating(db: DB, facilityId: string) {
  const rs = db.ratings.filter(r => r.facilityId === facilityId)
  if (!rs.length) return null
  return { avg: rs.reduce((s, r) => s + r.overall, 0) / rs.length, count: rs.length }
}
