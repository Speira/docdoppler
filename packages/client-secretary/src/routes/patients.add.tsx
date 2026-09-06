import { createFileRoute, redirect } from '@tanstack/react-router'

import { PatientCreate } from '#/features/patientFeatures/PatientCreate'
import { PatientEditHelper } from '#/features/patientFeatures/PatientEditHelper'
import { RouteError } from '#/components/route-error'
import { i18next } from '#/lib/i18n'

export const Route = createFileRoute('/patients/add')({
  beforeLoad: ({ location }) => {
    // Editing used to live here as `/patients/add?id=N`. Old bookmarks are
    // sent to the real file rather than shown an empty create form, which
    // would quietly invite a duplicate record for a patient we already have.
    const search: Record<string, unknown> = { ...location.search }
    const legacyId = PatientEditHelper.parsePatientId(search.id)
    if (legacyId !== null) {
      throw redirect({
        to: '/patients/$patientId',
        params: { patientId: String(legacyId) },
        replace: true,
      })
    }
  },
  errorComponent: ({ error }) => <RouteError error={error} />,
  head: () => ({
    meta: [
      { title: i18next.t('Nouveau patient — DocDoppler') },
      {
        name: 'description',
        content: i18next.t(
          "Fiche d'accueil patient : identité et antécédents médicaux.",
        ),
      },
    ],
  }),
  component: PatientCreate,
})
