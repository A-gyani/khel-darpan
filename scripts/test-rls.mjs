// Permission test against the live Supabase project: logs in as each demo user and checks
// what they can and cannot read / write. Run: node scripts/test-rls.mjs  (reads .env)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => l.split(/=(.*)/s).slice(0, 2)))
const URL_ = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY
const results = []
const check = (who, what, ok, detail = '') => { results.push({ who, what, pass: ok ? 'PASS' : 'FAIL', detail }); }

async function as(email) {
  const c = createClient(URL_, KEY, { auth: { persistSession: false } })
  if (email) { const { error } = await c.auth.signInWithPassword({ email, password: 'demo1234' }); if (error) throw new Error(email + ': ' + error.message) }
  return c
}
const count = async (c, table, filter) => { let q = c.from(table).select('id', { count: 'exact', head: true }); if (filter) q = filter(q); const { count: n, error } = await q; return error ? -1 : n }

// ---- citizen (not logged in) ----
const anon = await as(null)
check('citizen', 'sees approved facilities', (await count(anon, 'public_facilities')) > 0)
check('citizen', 'cannot read working records (drafts / submitted)', (await count(anon, 'facilities')) === 0)
check('citizen', 'cannot read check-ins', (await count(anon, 'checkins')) === 0)
check('citizen', 'cannot read complaints', (await count(anon, 'grievances')) === 0)
check('citizen', 'cannot read officer list', (await count(anon, 'profiles')) === 0)
{ const { error } = await anon.from('checkins').insert({ id: 'rls-test-ci', facility_id: 'f001', district: 'ahmedabad', data: { id: 'rls-test-ci', facilityId: 'f001' } }); check('citizen', 'can check in', !error, error?.message) }
{ const { error } = await anon.from('grievances').insert({ id: 'rls-test-g1', facility_id: 'f001', district: 'ahmedabad', status: 'resolved', data: {} }); check('citizen', 'cannot file a complaint already marked resolved', !!error) }
{ const { error } = await anon.from('facilities').insert({ id: 'rls-test-f', district: 'ahmedabad', status: 'approved', data: {} }); check('citizen', 'cannot add a facility', !!error) }

// ---- DSO Ahmedabad ----
const dso = await as('dso.ahmedabad@demo.in')
const own = await count(dso, 'facilities', q => q.eq('district', 'ahmedabad'))
const other = await count(dso, 'facilities', q => q.neq('district', 'ahmedabad'))
check('DSO Ahmedabad', 'sees own district facilities', own > 0, `${own}`)
check('DSO Ahmedabad', 'cannot see other districts', other === 0, `${other}`)
{ const { error } = await dso.from('facilities').insert({ id: 'rls-test-f2', district: 'surat', status: 'draft', data: {} }); check('DSO Ahmedabad', 'cannot add a facility in Surat', !!error) }
{ const { error } = await dso.from('facilities').insert({ id: 'rls-test-f3', district: 'ahmedabad', status: 'approved', data: {} }); check('DSO Ahmedabad', 'cannot approve (insert as approved)', !!error, error?.message?.slice(0, 60)) }
{ const { data: sub } = await dso.from('facilities').select('id,status').eq('district', 'ahmedabad').eq('status', 'submitted').limit(1)
  if (sub?.[0]) { const { error } = await dso.from('facilities').update({ status: 'approved' }).eq('id', sub[0].id); check('DSO Ahmedabad', 'cannot approve a submitted entry', !!error, error?.message?.slice(0, 60)) } }
{ const before = (await anon.from('public_facilities').select('data').eq('id', 'f002')).data?.[0]?.data?.name
  await dso.from('facilities').update({ public_data: { name: 'HACKED' } }).eq('id', 'f002')
  const after = (await anon.from('public_facilities').select('data').eq('id', 'f002')).data?.[0]?.data?.name
  check('DSO Ahmedabad', 'cannot change what citizens see', before === after && after !== 'HACKED', `${after}`) }
{ const { error } = await dso.from('facilities').insert({ id: 'rls-test-draft', district: 'ahmedabad', status: 'draft', data: { id: 'rls-test-draft' } }); check('DSO Ahmedabad', 'can add a draft in own district', !error, error?.message)
  const { error: e2 } = await dso.from('facilities').delete().eq('id', 'rls-test-draft'); check('DSO Ahmedabad', 'can delete own draft', !e2) }
check('DSO Ahmedabad', 'cannot read Surat complaints', (await count(dso, 'grievances', q => q.eq('district', 'surat'))) === 0)

// ---- State officer ----
const st = await as('state.demo@demo.in')
const all = await count(st, 'facilities')
check('State officer', 'sees all districts', all > own, `${all}`)
check('State officer', 'sees all complaints', (await count(st, 'grievances')) > 0)
// clean up the citizen test row
await st.from('checkins').delete().eq('id', 'rls-test-ci')

console.table(results)
const failed = results.filter(r => r.pass === 'FAIL').length
console.log(failed ? `${failed} FAILED` : 'ALL PASSED')
process.exit(failed ? 1 : 0)
