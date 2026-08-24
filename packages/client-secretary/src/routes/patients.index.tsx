import { createFileRoute } from '@tanstack/react-router'

import { PatientList } from '#/features/patientFeatures/PatientList'
import { PatientListHelper } from '#/features/patientFeatures/PatientListHelper'
import { RouteError } from '#/components/route-error'
import { i18next } from '#/lib/i18n'

export const Route = createFileRoute('/patients/')({
  loader: () => ({ patients: PatientListHelper.listPatients() }),
  head: () => ({
    meta: [
      { title: i18next.t('Patients — Echo Link') },
      {
        name: 'description',
        content: i18next.t('Liste des patients du cabinet.'),
      },
    ],
  }),
  errorComponent: ({ error }) => <RouteError error={error} />,
  component: RouteComponent,
})

function RouteComponent() {
  const { patients } = Route.useLoaderData()
  return <PatientList patientsPromise={patients} />
}
