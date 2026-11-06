// Supabase connection. Used only when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set at build time.
// The anon key is meant for browsers; what each user may read/write is enforced by the database (see supabase/01_schema.sql).
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import type { DB, Facility, CheckIn, Grievance, Rating, ReviewAction, AuditEntry, User, Role } from '../lib/types'

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const REMOTE = !!(URL_ && KEY)
export const sb: SupabaseClient | null = REMOTE ? createClient(URL_!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } }) : null

// Demo only: the mobile-OTP screen signs in with this password after the demo code. Real OTP needs an SMS provider.
export const DEMO_PASSWORD = 'demo1234'

export function reportError(where: string, e: unknown) {
  const msg = (e as { message?: string })?.message || String(e)
  console.error('[supabase]', where, msg)
  window.dispatchEvent(new CustomEvent('ks-sync-error', { detail: `${where}: ${msg}` }))
}

/* ---------- auth ---------- */
export async function getSession(): Promise<Session | null> {
  const { data } = await sb!.auth.getSession()
  return data.session
}
export async function signIn(email: string, password: string) {
  const { data, error } = await sb!.auth.signInWithPassword({ email, password })
  if (error) return null
  return data.session
}
export async function emailForPhone(phone: string): Promise<string | null> {
  const { data, error } = await sb!.rpc('email_for_phone', { p: phone })
  if (error) { reportError('phone lookup', error); return null }
  return (data as string) || null
}
export async function signOut() { await sb!.auth.signOut() }

/* ---------- load everything this user may see ---------- */
type Row = { id: string; data: Record<string, unknown> }

async function all<T>(table: string, select = '*'): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb!.from(table).select(select).range(from, from + 999)
    if (error) throw error
    out.push(...((data || []) as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function loadAll(signedIn: boolean): Promise<Omit<DB, 'version'>> {
  if (!signedIn) {
    // citizens: approved copies + ratings only
    const [pub, rts] = await Promise.all([all<Row>('public_facilities'), all<Row>('ratings')])
    return {
      users: [],
      facilities: pub.map(r => ({ ...(r.data as unknown as Facility), id: r.id, status: 'approved', published: null })),
      checkins: [], grievances: [], ratings: rts.map(r => r.data as unknown as Rating), reviews: [], audit: [],
    }
  }
  const [profiles, fac, ci, gr, rt, rv, au] = await Promise.all([
    all<{ id: string; full_name: string; email: string; phone: string; role: Role; district: string | null }>('profiles'),
    all<Row & { status: string }>('facilities', 'id,status,data'),
    all<Row>('checkins', 'id,data'), all<Row>('grievances', 'id,data'), all<Row>('ratings', 'id,data'),
    all<Row>('reviews', 'id,data'), all<Row>('audit', 'id,data'),
  ])
  return {
    users: profiles.map(p => ({ id: p.id, fullName: p.full_name, email: p.email, phone: p.phone, password: '', role: p.role, district: p.district || undefined }) as User),
    facilities: fac.map(r => ({ ...(r.data as unknown as Facility), id: r.id, status: r.status as Facility['status'] })),
    checkins: ci.map(r => r.data as unknown as CheckIn),
    grievances: gr.map(r => r.data as unknown as Grievance),
    ratings: rt.map(r => r.data as unknown as Rating),
    reviews: rv.map(r => r.data as unknown as ReviewAction),
    audit: au.map(r => r.data as unknown as AuditEntry),
  }
}

/* ---------- photos: data URLs go to storage, the record keeps the link ---------- */
async function upload(dataUrl: string, path: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  // no upsert: citizens may upload but not overwrite; each photo has a unique path
  const { error } = await sb!.storage.from('photos').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
  if (error && !/exists|duplicate/i.test(error.message)) throw error
  return sb!.storage.from('photos').getPublicUrl(path).data.publicUrl
}
async function withUploadedPhotos(f: Facility): Promise<Facility> {
  const photos = await Promise.all(f.photos.map(async p => {
    if (!p.dataUrl.startsWith('data:image/jpeg') && !p.dataUrl.startsWith('data:image/png')) return p
    const big = await upload(p.dataUrl, `${f.id}/${p.id}.jpg`)
    const small = p.thumbUrl.startsWith('data:image/') ? await upload(p.thumbUrl, `${f.id}/${p.id}_t.jpg`) : p.thumbUrl
    return { ...p, dataUrl: big, thumbUrl: small }
  }))
  return { ...f, photos }
}
export async function uploadReportPhoto(dataUrl: string, id: string) { return upload(dataUrl, `reports/${id}.jpg`) }

/* ---------- writes ---------- */
/** Saves the facility. publicCopy: what citizens should see (State officer only; ignored for DSOs by the database). */
export async function putFacility(f: Facility, publicCopy?: Facility | null): Promise<Facility> {
  const withPhotos = await withUploadedPhotos(f)
  const row: Record<string, unknown> = { id: f.id, district: f.district, status: f.status, data: withPhotos }
  if (publicCopy !== undefined) row.public_data = publicCopy
  const { error } = await sb!.from('facilities').upsert(row)
  if (error) throw error
  return withPhotos
}
export async function deleteFacilityRow(id: string) {
  const { error } = await sb!.from('facilities').delete().eq('id', id)
  if (error) throw error
}
export async function insertRows(table: 'checkins' | 'grievances' | 'ratings' | 'reviews' | 'audit', rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb!.from(table).upsert(rows.slice(i, i + 500))
    if (error) throw error
  }
}
/** Plain insert (citizens are allowed to add, not to change). */
export async function insertOne(table: 'checkins' | 'grievances' | 'ratings' | 'reviews' | 'audit', row: Record<string, unknown>) {
  const { error } = await sb!.from(table).insert(row)
  if (error) throw error
}
export async function updateGrievance(g: Grievance) {
  const { error } = await sb!.from('grievances').update({ status: g.status, data: g }).eq('id', g.id)
  if (error) throw error
}

/** Keep only the columns each table has, plus the full object as data. */
export const rowOf = {
  checkin: (c: CheckIn, district?: string) => ({ id: c.id, facility_id: c.facilityId, district, at: c.at, data: c }),
  grievance: (g: Grievance, district?: string) => ({ id: g.id, facility_id: g.facilityId, district, status: g.status, at: g.at, data: g }),
  rating: (r: Rating) => ({ id: r.id, facility_id: r.facilityId, at: r.at, data: r }),
  review: (r: ReviewAction) => ({ id: r.id, facility_id: r.facilityId, at: r.at, data: r }),
  audit: (a: AuditEntry) => ({ id: a.id, facility_id: a.facilityId, at: a.at, data: a }),
}

/* ---------- live updates ---------- */
export function subscribe(onChange: () => void) {
  let timer: number | undefined
  const ping = () => { window.clearTimeout(timer); timer = window.setTimeout(onChange, 600) }
  const ch = sb!.channel('khel-darpan')
  for (const table of ['facilities', 'grievances', 'reviews', 'checkins']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, ping)
  ch.subscribe()
  return () => { sb!.removeChannel(ch) }
}

/** State officer: wipe and load the demo data set (ids of demo users mapped to real accounts by email). */
export async function loadDemo(seed: DB, profiles: User[]) {
  const byEmail = new Map(profiles.map(p => [p.email.toLowerCase(), p.id]))
  const idMap = new Map(seed.users.map(u => [u.id, byEmail.get(u.email.toLowerCase()) || u.id]))
  const m = (id: string) => idMap.get(id) || id
  for (const table of ['audit', 'reviews', 'ratings', 'grievances', 'checkins', 'facilities']) {
    const { error } = await sb!.from(table).delete().neq('id', '__none__')
    if (error) throw error
  }
  const district = new Map(seed.facilities.map(f => [f.id, f.district]))
  const facRows = seed.facilities.map(f => {
    const g = { ...f, createdBy: m(f.createdBy), photos: f.photos.map(p => ({ ...p, capturedBy: m(p.capturedBy) })) }
    const pub = f.status === 'approved' ? { ...g, published: null } : f.published ? f.published : null
    return { id: f.id, district: f.district, status: f.status, data: g, public_data: pub }
  })
  for (let i = 0; i < facRows.length; i += 100) {
    const { error } = await sb!.from('facilities').upsert(facRows.slice(i, i + 100))
    if (error) throw error
  }
  await insertRows('checkins', seed.checkins.map(c => rowOf.checkin(c, district.get(c.facilityId))))
  await insertRows('grievances', seed.grievances.map(g => rowOf.grievance(g, district.get(g.facilityId))))
  await insertRows('ratings', seed.ratings.map(rowOf.rating))
  await insertRows('reviews', seed.reviews.map(r => rowOf.review({ ...r, by: m(r.by) })))
}
