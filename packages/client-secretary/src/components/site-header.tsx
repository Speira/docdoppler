import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import logoXs from '#/assets/logo-xs.png'

const NAV_ITEMS = [
  { to: '/', label: 'Accueil' },
  { to: '/patients', label: 'Patients' },
  { to: '/reports', label: 'Rapports' },
  { to: '/settings', label: 'Paramètres' },
] as const

export function SiteHeader() {
  const { t } = useTranslation()

  return (
    <header
      className="sticky top-0 z-10 border-b"
      style={{ borderColor: 'var(--line)', background: 'var(--header-bg)' }}
    >
      <div className="page-wrap flex h-16 items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoXs} alt="Echo Link" className="h-8 w-auto" />
          <span className="display-title text-lg font-bold text-primary">
            {t('Echo Link')}
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="nav-link text-sm font-medium"
              activeOptions={{ exact: item.to === '/' }}
              activeProps={{ className: 'is-active' }}
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
