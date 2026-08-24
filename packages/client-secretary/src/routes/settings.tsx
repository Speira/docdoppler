import { createFileRoute } from '@tanstack/react-router'

import { SettingsForm } from '#/features/settingsFeatures/SettingsForm'
import { SettingsHelper } from '#/features/settingsFeatures/SettingsHelper'
import { RouteError } from '#/components/route-error'
import { i18next } from '#/lib/i18n'

export const Route = createFileRoute('/settings')({
  loader: () => ({ settings: SettingsHelper.loadSettings() }),
  errorComponent: ({ error }) => <RouteError error={error} />,
  head: () => ({
    meta: [
      { title: i18next.t('Paramètres — Echo Link') },
      {
        name: 'description',
        content: i18next.t(
          'Identité du cabinet utilisée dans les comptes rendus.',
        ),
      },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { settings } = Route.useLoaderData()
  return <SettingsForm settingsPromise={settings} />
}
