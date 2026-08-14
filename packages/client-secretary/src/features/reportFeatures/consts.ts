import { z } from 'zod'
import { VESSEL_KEYS, VESSEL_LABELS } from '@speira-docdoppler/shared-labels'

import type { ReportBuilderFormValues } from './types'

export function getReportBuilderDefaultValues(examDate: string): ReportBuilderFormValues {
  return {
    doctor_name: '',
    exam_date: examDate,
    carotide_text: '',
    carotide_abnormal: false,
    artere_membre_sup_text: '',
    artere_membre_sup_abnormal: false,
    veine_membre_sup_text: '',
    veine_membre_sup_abnormal: false,
    artere_membre_inf_text: '',
    artere_membre_inf_abnormal: false,
    veine_membre_inf_text: '',
    veine_membre_inf_abnormal: false,
  }
}

export const reportVesselFields = VESSEL_KEYS.map((key) => ({
  key,
  label: VESSEL_LABELS[key],
  textField: `${key}_text` as keyof ReportBuilderFormValues,
  abnormalField: `${key}_abnormal` as keyof ReportBuilderFormValues,
}))

export const reportBuilderFormSchema = z.object({
  doctor_name: z.string().trim().min(1, 'Le nom du médecin est requis.'),
  exam_date: z.string().min(1, "La date de l'examen est requise."),
  carotide_text: z.string(),
  carotide_abnormal: z.boolean(),
  artere_membre_sup_text: z.string(),
  artere_membre_sup_abnormal: z.boolean(),
  veine_membre_sup_text: z.string(),
  veine_membre_sup_abnormal: z.boolean(),
  artere_membre_inf_text: z.string(),
  artere_membre_inf_abnormal: z.boolean(),
  veine_membre_inf_text: z.string(),
  veine_membre_inf_abnormal: z.boolean(),
})
