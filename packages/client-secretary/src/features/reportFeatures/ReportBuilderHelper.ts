import { patientService } from '#/services/patient-service'
import { reportService } from '#/services/report-service'
import { settingsService } from '#/services/settings-service'
import { getReportBuilderDefaultValues } from './consts'
import { parseOptionalNumber } from './ips'
import type { PatientWithRiskFactors } from '#/services/patient-service'
import type { ClinicSettingsRecord } from '#/services/settings-service'
import type { ReportBuilderFormValues } from './types'

export class ReportBuilderHelper {
  static async loadPatient(id: number): Promise<PatientWithRiskFactors> {
    return patientService.getPatient(id)
  }

  static async loadSettings(): Promise<ClinicSettingsRecord> {
    return settingsService.getSettings()
  }

  static defaultValuesFor(
    patient: PatientWithRiskFactors,
    settings: ClinicSettingsRecord,
  ): ReportBuilderFormValues {
    return getReportBuilderDefaultValues(patient.exam_date, settings.doctor_name)
  }

  static async createReport(
    patientId: number,
    values: ReportBuilderFormValues,
  ): Promise<number> {
    const report = await reportService.createReport(patientId, {
      doctor_name: values.doctor_name.trim(),
      exam_date: values.exam_date,
      correspondant_dossier: values.correspondant_dossier,
      indication: values.indication,
      tsa: {
        imt_droit: parseOptionalNumber(values.tsa_imt_droit),
        imt_gauche: parseOptionalNumber(values.tsa_imt_gauche),
        aci_acc_ratio_droit: parseOptionalNumber(values.tsa_aci_acc_ratio_droit),
        aci_acc_ratio_gauche: parseOptionalNumber(values.tsa_aci_acc_ratio_gauche),
        findings_text: values.tsa_findings_text,
      },
      aorte_abdominale: {
        diametre: values.aorte_diametre,
        anevrisme: values.aorte_anevrisme,
        anevrisme_diametre_mm: parseOptionalNumber(values.aorte_anevrisme_diametre_mm),
        findings_text: values.aorte_findings_text,
      },
      membres_inferieurs: {
        pression_cheville_droite: parseOptionalNumber(values.mi_pression_cheville_droite),
        pression_cheville_gauche: parseOptionalNumber(values.mi_pression_cheville_gauche),
        pression_bras_droit: parseOptionalNumber(values.mi_pression_bras_droit),
        pression_bras_gauche: parseOptionalNumber(values.mi_pression_bras_gauche),
        findings_text: values.mi_findings_text,
      },
      conclusion: values.conclusion,
    })
    return report.id
  }
}
