import { createFileRoute } from '@tanstack/react-router'

import { Home } from '#/features/homeFeatures/Home'
import { HomeHelper } from '#/features/homeFeatures/HomeHelper'
import { RouteError } from '#/components/route-error'
import { i18next } from '#/lib/i18n'

export const Route = createFileRoute('/')({
  loader: () => ({ stats: HomeHelper.loadStats() }),
  head: () => ({
    meta: [
      { title: i18next.t('Echo Link — Accueil') },
      {
        name: 'description',
        content: i18next.t(
          "Accueil du cabinet : patients, comptes rendus et paramètres d'écho-Doppler vasculaire.",
        ),
      },
    ],
  }),
  errorComponent: ({ error }) => <RouteError error={error} />,
  component: RouteComponent,
})

function RouteComponent() {
  const { stats } = Route.useLoaderData()
  return <Home statsPromise={stats} />
}
