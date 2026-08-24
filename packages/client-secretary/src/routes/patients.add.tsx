import { createFileRoute } from '@tanstack/react-router'

import { PatientCreate } from '#/features/patientFeatures/PatientCreate'
import { PatientEdit } from '#/features/patientFeatures/PatientEdit'
import { PatientEditHelper } from '#/features/patientFeatures/PatientEditHelper'
import { RouteError } from '#/components/route-error'
import { i18next } from '#/lib/i18n'

type Search = { id?: number }

export const Route = createFileRoute('/patients/add')({
  // The default search parser JSON-parses each raw query value before this
  // runs, so a numeric ?id=1 already arrives as the number 1, not "1".
  validateSearch: (s: Record<string, unknown>): Search => {
    if (typeof s.id === 'number' && Number.isInteger(s.id)) return { id: s.id }
    if (
      typeof s.id === 'string' &&
      s.id.trim() !== '' &&
      !Number.isNaN(Number(s.id))
    ) {
      return { id: Number(s.id) }
    }
    return { id: undefined }
  },
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: ({ deps }) => ({
    patient:
      deps.id === undefined
        ? undefined
        : PatientEditHelper.loadPatient(deps.id),
  }),
  errorComponent: ({ error }) => <RouteError error={error} />,
  head: () => ({
    meta: [
      { title: i18next.t('Secrétariat — Echo Link') },
      {
        name: 'description',
        content: i18next.t(
          "Fiche d'accueil patient : identité et antécédents médicaux.",
        ),
      },
    ],
  }),
  component: Secretariat,
})

function Secretariat() {
  const { id } = Route.useSearch()
  const { patient } = Route.useLoaderData()
  if (id === undefined || !patient) return <PatientCreate />
  return <PatientEdit key={id} id={id} patientPromise={patient} />
}
