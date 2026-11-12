import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import './i18n'
import App from './App'
import { initStore } from './data/store'

import { startVisitCounter } from './lib/analytics'

initStore()
startVisitCounter()
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
