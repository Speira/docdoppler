import { Link } from '@tanstack/react-router'
import { FileText, Settings, Users } from 'lucide-react'
import { Suspense, use } from 'react'
import { useTranslation } from 'react-i18next'

import type { HomeStats } from './HomeHelper'
import logoInline from '#/assets/logo-inline.png'

export function Home({ statsPromise }: { statsPromise: Promise<HomeStats> }) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeView statsPromise={statsPromise} />
    </Suspense>
  )
}

function HomeSkeleton() {
  return (
    <div className="page-wrap space-y-10 py-12">
      <div className="h-28 animate-pulse rounded-2xl bg-secondary" />
      <div className="grid gap-6 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-2xl bg-secondary"
          />
        ))}
      </div>
    </div>
  )
}

function HomeView({ statsPromise }: { statsPromise: Promise<HomeStats> }) {
  const stats = use(statsPromise)
  const { t } = useTranslation()

  return (
    <div className="page-wrap space-y-10 py-12">
      <div className="rise-in flex flex-col items-center gap-4 text-center">
        <img src={logoInline} alt="Echo Link" className="h-14 w-auto" />
        <p className="max-w-xl text-sm text-muted-foreground">
          {t(
            'Suivi patient et comptes rendus écho-Doppler vasculaire, en local au cabinet.',
          )}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <HomeCard
          to="/patients"
          icon={<Users className="h-6 w-6" />}
          title={t('Patients')}
          description={t('Fiches patients et antécédents médicaux.')}
          stat={t('{{count}} patient{{plural}}', {
            count: stats.patientCount,
            plural: stats.patientCount === 1 ? '' : 's',
          })}
        />
        <HomeCard
          to="/reports"
          icon={<FileText className="h-6 w-6" />}
          title={t('Rapports')}
          description={t('Comptes rendus écho-Doppler par patient.')}
          stat={t('{{count}} patient{{plural}} avec compte rendu', {
            count: stats.patientsWithReportCount,
            plural: stats.patientsWithReportCount === 1 ? '' : 's',
          })}
        />
        <HomeCard
          to="/settings"
          icon={<Settings className="h-6 w-6" />}
          title={t('Paramètres')}
          description={t('Identité du cabinet et appareil Mindray.')}
          stat={stats.settingsConfigured ? t('Configuré') : t('À configurer')}
        />
      </div>
    </div>
  )
}

function HomeCard({
  to,
  icon,
  title,
  description,
  stat,
}: {
  to: '/patients' | '/reports' | '/settings'
  icon: React.ReactNode
  title: string
  description: string
  stat: string
}) {
  return (
    <Link
      to={to}
      className="feature-card rise-in flex flex-col gap-3 rounded-2xl p-6 text-left"
    >
      <div className="flex items-center gap-3 text-primary">
        {icon}
        <h2 className="display-title text-xl font-bold">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="island-kicker mt-auto">{stat}</p>
    </Link>
  )
}
