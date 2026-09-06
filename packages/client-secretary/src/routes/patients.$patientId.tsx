import { createFileRoute, notFound } from '@tanstack/react-router'

import { PatientEdit } from '#/features/patientFeatures/PatientEdit'
import { PatientEditHelper } from '#/features/patientFeatures/PatientEditHelper'
import { PatientNotFound } from '#/features/patientFeatures/PatientNotFound'
import { RouteError } from '#/components/route-error'
import { i18next } from '#/lib/i18n'

export const Route = createFileRoute('/patients/$patientId')({
  loader: ({ params }) => {
    // A path param is always a raw string, so it is validated before the API
    // ever sees it; an unparseable id is a dead URL, not a failed request.
    const id = PatientEditHelper.parsePatientId(params.patientId)
    if (id === null) throw notFound()
    return {
      id,
      patient: PatientEditHelper.loadPatient(id),
      reports: PatientEditHelper.listReports(id),
    }
  },
  notFoundComponent: () => <PatientNotFound />,
  errorComponent: ({ error }) => <RouteError error={error} />,
  head: () => ({
    meta: [
      { title: i18next.t('Fiche patient — DocDoppler') },
      {
        name: 'description',
        content: i18next.t(
          'Fiche patient : identité, antécédents médicaux et rapports.',
        ),
      },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { id, patient, reports } = Route.useLoaderData()
  return (
    <PatientEdit
      key={id}
      id={id}
      patientPromise={patient}
      reportsPromise={reports}
    />
  )
}
