# Khel Darpan Gujarat — prototype

SFIC 2026 · Problem statement **PS000012** (Sports, Youth & Cultural Activities Department):
digital assessment, mapping and better use of sports facilities. Prototype scope: **Ahmedabad and Surat districts** (add more in `src/lib/constants.ts`).

All facilities, photos, check-ins and complaints in the app are **synthetic demo data**.

## What it does
- **District Sports Officer**: adds a facility in 7 steps; photos only from the live camera, stamped with GPS, time, officer, taluka/ward and a mini map; flags for photos > 200 m from the pin, weak GPS or duplicates.
- **State officer**: review queue (approve / return with comment / reject), history of every change, dashboard (count cards, charts, CWG 2030 sport readiness, repair & underused lists, taluka progress, complaints with 7-day escalation).
- **Citizen** (no login): map with filters, facility page, directions; one **QR poster** per facility for check-in, complaint and rating.
- **Facility Health Score** (0–100): condition 30, use 25 (QR check-ins, else DSO estimate), access 15, inclusivity 15, performance 15. Internal only; citizens see star ratings.
- Gujarati / English on every screen. Look: Google Material Design 3, Material Symbols icons, SAG logo colours.

## Demo logins (local demo mode)
| Role | Email | Mobile (OTP) | Password |
|---|---|---|---|
| District Sports Officer, Ahmedabad | dso.ahmedabad@demo.in | 9000000001 | demo1234 |
| District Sports Officer, Surat | dso.surat@demo.in | 9000000004 | demo1234 |
| State officer | state.demo@demo.in | 9000000002 | demo1234 |

Demo OTP is **123456** (no SMS is sent). Citizens need no login.

## Run locally
```
npm install
npm run dev        # http://localhost:5173
npm test           # score unit tests
```
Camera and GPS need HTTPS or localhost. To test on a phone, use the GitHub Pages URL.

Login page photo: put a file at `public/brand/login-photo.jpg`.

## Data
Without Supabase keys the app runs in **local demo mode**: data is kept in each browser (IndexedDB) and preloaded with demo data.
Supabase (shared data across devices) is the next step — add keys to `.env` (see `.env.example`) and as GitHub repository secrets.

## Deploy (GitHub Pages)
Push to `main`; `.github/workflows/deploy.yml` builds and publishes. In the repo: Settings → Pages → Source: GitHub Actions.

## Open [CONFIRM] items
- Ahmedabad and Surat taluka lists vs lgdirectory.gov.in
- Official CWG 2030 sport list (dashboard uses a provisional list)
- Gujarati text to be checked by a native reader
- Exact SAG brand colour codes
