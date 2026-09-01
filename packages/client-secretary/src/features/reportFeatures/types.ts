import type { MiArteryKey, MiSide } from '@speira-docdoppler/shared-labels'

export type MiArterySpectreKey = `mi_${MiSide}_${MiArteryKey}_spectre`
export type MiArteryVsmKey = `mi_${MiSide}_afc_vsm`

export function arterySpectreKey(
  side: MiSide,
  artery: MiArteryKey,
): MiArterySpectreKey {
  return `mi_${side}_${artery}_spectre`
}

export function arteryVsmKey(side: MiSide): MiArteryVsmKey {
  return `mi_${side}_afc_vsm`
}

export type ReportBuilderFormValues = {
  doctor_name: string
  exam_date: string
  correspondant_dossier: string
  indication: string
  tsa_imt_droit: string
  tsa_imt_gauche: string
  tsa_aci_acc_ratio_droit: string
  tsa_aci_acc_ratio_gauche: string
  tsa_findings_text: string
  aorte_diametre: string
  aorte_findings_text: string
  mi_pression_cheville_droite: string
  mi_pression_cheville_gauche: string
  mi_pression_bras_droit: string
  mi_pression_bras_gauche: string
  mi_findings_text: string
  conclusion: string
} & Record<MiArterySpectreKey, string> &
  Record<MiArteryVsmKey, string>
