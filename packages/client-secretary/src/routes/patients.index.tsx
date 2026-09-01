import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { PatientList } from '#/features/patientFeatures/PatientList'
import { PatientListHelper } from '#/features/patientFeatures/PatientListHelper'
import type { ReportStatusFilter } from '#/features/patientFeatures/PatientListHelper'
import { RouteError } from '#/components/route-error'
import { i18next } from '#/lib/i18n'

export const Route = createFileRoute('/patients/')({
  validateSearch: (search: Record<string, unknown>): { reportFilter?: ReportStatusFilter } => {
    const reportFilter = PatientListHelper.parseReportFilter(search.reportFilter)
    return reportFilter === 'all' ? {} : { reportFilter }
  },
  loader: () => ({ patients: PatientListHelper.listPatientsWithReportStatus() }),
  head: () => ({
    meta: [
      { title: i18next.t('Patients — DocDoppler') },
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
  const { reportFilter = 'all' } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <PatientList
      patientsPromise={patients}
      reportFilter={reportFilter}
      onReportFilterChange={(filter) =>
        navigate({ to: '/patients', search: { reportFilter: filter }, replace: true })
      }
    />
  )
}
