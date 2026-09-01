import { z } from 'zod'

import {
  MI_ARTERY_KEYS,
  MI_SIDES,
  SPECTRE_OPTIONS,
} from '@speira-docdoppler/shared-labels'
import { arterySpectreKey, arteryVsmKey } from './types'
import type {
  MiArterySpectreKey,
  MiArteryVsmKey,
  ReportBuilderFormValues,
} from './types'

type ArteryFieldValues = Record<MiArterySpectreKey, string> &
  Record<MiArteryVsmKey, string>

// 14 fields (6 spectres per side + a VSM on each AFC) — generated from the
// artery list so adding an artery never means editing three files.
function arteryDefaults(): ArteryFieldValues {
  const values = {} as ArteryFieldValues
  for (const side of MI_SIDES) {
    for (const artery of MI_ARTERY_KEYS) {
      values[arterySpectreKey(side, artery)] = ''
    }
    values[arteryVsmKey(side)] = ''
  }
  return values
}

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
    aorte_findings_text: '',
    mi_pression_cheville_droite: '',
    mi_pression_cheville_gauche: '',
    mi_pression_bras_droit: '',
    mi_pression_bras_gauche: '',
    mi_findings_text: '',
    ...arteryDefaults(),
    conclusion: '',
  }
}

const optionalNumericString = z
  .string()
  .refine((value) => value.trim().length === 0 || !Number.isNaN(Number(value)), {
    message: 'Doit être un nombre.',
  })

const optionalSpectre = z
  .string()
  .refine(
    (value) => value === '' || (SPECTRE_OPTIONS as readonly string[]).includes(value),
    { message: 'Spectre invalide.' },
  )

type ArterySchemaShape = Record<MiArterySpectreKey, z.ZodType<string, string>> &
  Record<MiArteryVsmKey, z.ZodType<string, string>>

function arterySchemaShape(): ArterySchemaShape {
  const shape = {} as ArterySchemaShape
  for (const side of MI_SIDES) {
    for (const artery of MI_ARTERY_KEYS) {
      shape[arterySpectreKey(side, artery)] = optionalSpectre
    }
    shape[arteryVsmKey(side)] = optionalNumericString
  }
  return shape
}

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
  aorte_diametre: optionalNumericString,
  aorte_findings_text: z.string(),
  mi_pression_cheville_droite: optionalNumericString,
  mi_pression_cheville_gauche: optionalNumericString,
  mi_pression_bras_droit: optionalNumericString,
  mi_pression_bras_gauche: optionalNumericString,
  mi_findings_text: z.string(),
  conclusion: z.string(),
  ...arterySchemaShape(),
})
