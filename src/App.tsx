import { CssBaseline, ThemeProvider, Box, CircularProgress, Snackbar, Alert } from '@mui/material'
import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { theme } from './theme'
import { useDb, isReady } from './data/store'
import { useCurrentUser } from './components/ui'
import type { Role } from './lib/types'
import Login from './pages/Login'
import PublicMap from './pages/PublicMap'
import FacilityPage from './pages/FacilityPage'
import QrLanding from './pages/QrLanding'
import DsoHome from './pages/DsoHome'
import DsoWizard from './pages/DsoWizard'
import DsoFacilityView from './pages/DsoFacilityView'
import StateDashboard from './pages/StateDashboard'
import StateReview from './pages/StateReview'
import Poster from './pages/Poster'
import { OfflineBar } from './components/OfflineBar'

function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const user = useCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={home(user.role)} replace />
  return <>{children}</>
}

import { home } from './lib/routes'

// Landing page for everyone is the citizen search map; officials log in from there.
function Root() {
  return <Navigate to="/map" replace />
}

/** Shows a message when a save to the shared database fails (e.g. no network). */
function SyncErrors() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const on = (e: Event) => setMsg((e as CustomEvent<string>).detail)
    window.addEventListener('ks-sync-error', on)
    return () => window.removeEventListener('ks-sync-error', on)
  }, [])
  return (
    <Snackbar open={!!msg} onClose={() => setMsg('')} autoHideDuration={8000} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
      <Alert severity="error" variant="filled" onClose={() => setMsg('')}>Could not save to the database — {msg}</Alert>
    </Snackbar>
  )
}

export default function App() {
  useDb()
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SyncErrors />
      {!isReady() ? (
        <Box sx={{ height: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
      ) : (
        <HashRouter>
          <OfflineBar />
          <Routes>
            <Route path="/" element={<Root />} />
            <Route path="/login" element={<Login />} />
            <Route path="/map" element={<PublicMap />} />
            <Route path="/f/:id" element={<FacilityPage />} />
            <Route path="/q/:id" element={<QrLanding />} />
            <Route path="/q/:id/:mode" element={<QrLanding />} />
            <Route path="/poster/:id" element={<Poster />} />
            <Route path="/dso" element={<Guard role="district_officer"><DsoHome /></Guard>} />
            <Route path="/dso/f/:id" element={<Guard role="district_officer"><DsoFacilityView /></Guard>} />
            <Route path="/dso/edit/:id" element={<Guard role="district_officer"><DsoWizard /></Guard>} />
            <Route path="/state" element={<Guard role="state_officer"><StateDashboard /></Guard>} />
            <Route path="/state/review/:id" element={<Guard role="state_officer"><StateReview /></Guard>} />
            <Route path="*" element={<Root />} />
          </Routes>
        </HashRouter>
      )}
    </ThemeProvider>
  )
}
