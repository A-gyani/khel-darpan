import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import gu from './locales/gu.json'

let lng = 'en'
try { lng = localStorage.getItem('ks_lang') || 'en' } catch { /* ignore */ }

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, gu: { translation: gu } },
  lng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnObjects: true,
})

export function toggleLang() {
  const next = i18n.language === 'gu' ? 'en' : 'gu'
  i18n.changeLanguage(next)
  try { localStorage.setItem('ks_lang', next) } catch { /* ignore */ }
  document.documentElement.lang = next
}

export default i18n
