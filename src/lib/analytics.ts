// Visit counter (GoatCounter): counts page views by page, day, city/country, phone/computer and language.
// No cookies and no personal data, so no consent banner is needed. Dashboard: https://<CODE>.goatcounter.com
// Runs only on the live site, so local testing is not counted. Set GOATCOUNTER_CODE to '' to switch it off.
const GOATCOUNTER_CODE = 'kheldarpan'
const LIVE_HOST = 'a-gyani.github.io'

type GC = { count?: (o: { path: string; title?: string }) => void; no_onload?: boolean }

export function startVisitCounter() {
  if (!GOATCOUNTER_CODE || location.hostname !== LIVE_HOST) return
  const w = window as unknown as { goatcounter?: GC }
  w.goatcounter = { no_onload: true }
  // the app uses #/ routes, so count the part after # as the page (e.g. /map, /f/<facility>, /state)
  const page = () => (location.hash.replace(/^#/, '').split('?')[0] || '/')
  let last = ''
  const count = () => {
    const p = page()
    if (p === last) return
    last = p
    w.goatcounter?.count?.({ path: p, title: p })
  }
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://gc.zgo.at/count.js'
  s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`
  s.onload = count
  document.head.appendChild(s)
  window.addEventListener('hashchange', count)
}
