import { z } from 'zod'

import type { ReportBuilderFormValues } from './types'

export function getReportBuilderDefaultValues(
  examDate: string,
  doctorName: string = '',
): ReportBuilderFormValues {
  return {
    doctor_name: doctorName,
    exam_date: examDate,
    correspondant_dossier: '',
    indication: '',
    tsa_imt_droit: '',
    tsa_imt_gauche: '',
    tsa_aci_acc_ratio_droit: '',
    tsa_aci_acc_ratio_gauche: '',
    tsa_findings_text: '',
    aorte_diametre: '',
    aorte_anevrisme: false,
    aorte_anevrisme_diametre_mm: '',
    aorte_findings_text: '',
    mi_pression_cheville_droite: '',
    mi_pression_cheville_gauche: '',
    mi_pression_bras_droit: '',
    mi_pression_bras_gauche: '',
    mi_findings_text: '',
    conclusion: '',
  }
}

const optionalNumericString = z
  .string()
  .refine((value) => value.trim().length === 0 || !Number.isNaN(Number(value)), {
    message: 'Doit être un nombre.',
  })

export const reportBuilderFormSchema = z.object({
  doctor_name: z.string().trim().min(1, 'Le nom du médecin est requis.'),
  exam_date: z.string().min(1, "La date de l'examen est requise."),
  correspondant_dossier: z.string(),
  indication: z.string(),
  tsa_imt_droit: optionalNumericString,
  tsa_imt_gauche: optionalNumericString,
  tsa_aci_acc_ratio_droit: optionalNumericString,
  tsa_aci_acc_ratio_gauche: optionalNumericString,
  tsa_findings_text: z.string(),
  aorte_diametre: z.string(),
  aorte_anevrisme: z.boolean(),
  aorte_anevrisme_diametre_mm: optionalNumericString,
  aorte_findings_text: z.string(),
  mi_pression_cheville_droite: optionalNumericString,
  mi_pression_cheville_gauche: optionalNumericString,
  mi_pression_bras_droit: optionalNumericString,
  mi_pression_bras_gauche: optionalNumericString,
  mi_findings_text: z.string(),
  conclusion: z.string(),
})
