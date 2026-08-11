import { z } from 'zod'

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

type HistoryField = { key: keyof PatientFormValues; label: string }

export const patientHistoryFieldGroups: { title: string; fields: HistoryField[] }[] = [
  {
    title: 'Facteurs de risque cardiovasculaire',
    fields: [
      { key: 'diabetes', label: 'Diabète' },
      { key: 'hypertension', label: 'Hypertension' },
      { key: 'cholesterol', label: 'Hypercholestérolémie' },
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
  dob: z.string().min(1, 'La date de naissance est requise.'),
  exam_date: z.string().min(1, "La date de l'examen est requise."),
  sex: z.enum(['M', 'F']),
  diabetes: z.boolean(),
  hypertension: z.boolean(),
  cholesterol: z.boolean(),
  obesity: z.boolean(),
  vertigo: z.boolean(),
  carotid_bruit: z.boolean(),
  avc: z.boolean(),
  smoking: z.boolean(),
})
