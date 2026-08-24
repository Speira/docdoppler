import { createFileRoute } from '@tanstack/react-router'

import { ReportBuilder } from '#/features/reportFeatures/ReportBuilder'
import { ReportBuilderHelper } from '#/features/reportFeatures/ReportBuilderHelper'
import { RouteError } from '#/components/route-error'
import { i18next } from '#/lib/i18n'

export const Route = createFileRoute('/reports/$patientId')({
  loader: ({ params }) => ({
    patient: ReportBuilderHelper.loadPatient(Number(params.patientId)),
    settings: ReportBuilderHelper.loadSettings(),
  }),
  errorComponent: ({ error }) => <RouteError error={error} />,
  head: () => ({
    meta: [{ title: i18next.t('Rapport — Echo Link') }],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { patientId } = Route.useParams()
  const { patient, settings } = Route.useLoaderData()
  return (
    <ReportBuilder
      patientId={Number(patientId)}
      patientPromise={patient}
      settingsPromise={settings}
    />
  )
}
