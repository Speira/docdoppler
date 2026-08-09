import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

// French UI text doubles as the translation key (see AGENTS.md), so a
// literal string like "Modifier" greps straight to its t() call in code.
// keySeparator/nsSeparator are disabled because French sentences routinely
// contain '.' and ':' and must not be parsed as key/namespace separators.
void i18next.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  resources: {
    fr: { translation: {} },
  },
})

export { i18next }
