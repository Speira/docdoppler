import { createFileRoute } from '@tanstack/react-router'

import { ReportList } from '#/features/reportFeatures/ReportList'
import { ReportListHelper } from '#/features/reportFeatures/ReportListHelper'
import { RouteError } from '#/components/route-error'
import { i18next } from '#/lib/i18n'

export const Route = createFileRoute('/reports')({
  loader: () => ({ patients: ReportListHelper.listPatientsWithLatestReport() }),
  errorComponent: ({ error }) => <RouteError error={error} />,
  head: () => ({
    meta: [
      { title: i18next.t('Rapports — docdoppler') },
      {
        name: 'description',
        content: i18next.t('Créer ou consulter un rapport de patient.'),
      },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { patients } = Route.useLoaderData()
  return <ReportList patientsPromise={patients} />
}
