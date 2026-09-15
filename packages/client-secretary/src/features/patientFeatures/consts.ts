import { z } from 'zod'

import { DateOfBirthHelper } from './DateOfBirthHelper'
import type { PatientFormValues } from './types'

export function getPatientFormDefaultValues(): PatientFormValues {
  return {
    first_name: '',
    last_name: '',
    dob: '',
    exam_date: new Date().toISOString().slice(0, 10),
    sex: 'F',
    diabetes: false,
    hypertension: false,
    cholesterol: false,
    obesity: false,
    vertigo: false,
    carotid_bruit: false,
    avc: false,
    smoking: false,
  }
}

/**
 * How many reports the patient file shows before "Voir plus". Three is what
 * the doctor actually reads on opening a file; the rest stay one click away
 * rather than unreachable, since this list is the only route to a patient's
 * older reports (the patient list shows just the latest one).
 *
 * Sent as an explicit `limit`, so the route loader's first page is already
 * this size and no second request fires on mount. It is deliberately smaller
 * than the API's own default (`REPORT_LIST_DEFAULT_LIMIT`, 10), which governs
 * only requests that name no limit.
 */
export const patientReportHistoryPageSize = 3

type HistoryField = { key: keyof PatientFormValues; label: string }

export const patientHistoryFieldGroups: { title: string; fields: HistoryField[] }[] = [
  {
    title: 'Facteurs de risque cardiovasculaire',
    fields: [
      { key: 'diabetes', label: 'Diabète' },
      { key: 'hypertension', label: 'HTA' },
      { key: 'cholesterol', label: 'Dyslipidémie' },
      { key: 'obesity', label: 'Obésité' },
      { key: 'smoking', label: 'Tabagisme' },
    ],
  },
  {
    title: 'Signes et antécédents neurovasculaires',
    fields: [
      { key: 'vertigo', label: 'Vertiges' },
      { key: 'carotid_bruit', label: 'Souffle carotidien' },
      { key: 'avc', label: 'AVC' },
    ],
  },
]

export const patientFormSchema = z.object({
  first_name: z.string().trim().min(1, 'Le prénom est requis.'),
  last_name: z.string().trim().min(1, 'Le nom est requis.'),
  // Each rule only speaks up once the previous one is satisfied, so the field
  // shows a single, relevant message rather than "requise, invalide, …".
  dob: z
    .string()
    .min(1, 'La date de naissance est requise.')
    .refine((value) => !value || DateOfBirthHelper.isRealIsoDate(value), {
      message: 'La date de naissance est invalide.',
    })
    .refine(
      (value) => !DateOfBirthHelper.isRealIsoDate(value) || value >= '1900-01-01',
      { message: "L'année de naissance doit être 1900 ou après." },
    )
    .refine(
      (value) =>
        !DateOfBirthHelper.isRealIsoDate(value) ||
        value <= new Date().toISOString().slice(0, 10),
      { message: 'La date de naissance ne peut pas être dans le futur.' },
    ),
  exam_date: z.string().min(1, "La date de l'examen est requise."),
  sex: z.enum(['M', 'F', 'O']),
  diabetes: z.boolean(),
  hypertension: z.boolean(),
  cholesterol: z.boolean(),
  obesity: z.boolean(),
  vertigo: z.boolean(),
  carotid_bruit: z.boolean(),
  avc: z.boolean(),
  smoking: z.boolean(),
})
