import { patientService } from '#/services/patient-service'
import { reportService } from '#/services/report-service'
import { getReportBuilderDefaultValues } from './consts'
import type { PatientWithRiskFactors } from '#/services/patient-service'
import type { ReportBuilderFormValues } from './types'

export class ReportBuilderHelper {
  static async loadPatient(id: number): Promise<PatientWithRiskFactors> {
    return patientService.getPatient(id)
  }

  static defaultValuesFor(patient: PatientWithRiskFactors): ReportBuilderFormValues {
    return getReportBuilderDefaultValues(patient.exam_date)
  }

  static async createReport(
    patientId: number,
    values: ReportBuilderFormValues,
  ): Promise<number> {
    const report = await reportService.createReport(patientId, {
      doctor_name: values.doctor_name.trim(),
      exam_date: values.exam_date,
      carotide: { text: values.carotide_text, abnormal: values.carotide_abnormal },
      artere_membre_sup: {
        text: values.artere_membre_sup_text,
        abnormal: values.artere_membre_sup_abnormal,
      },
      veine_membre_sup: {
        text: values.veine_membre_sup_text,
        abnormal: values.veine_membre_sup_abnormal,
      },
      artere_membre_inf: {
        text: values.artere_membre_inf_text,
        abnormal: values.artere_membre_inf_abnormal,
      },
      veine_membre_inf: {
        text: values.veine_membre_inf_text,
        abnormal: values.veine_membre_inf_abnormal,
      },
    })
    return report.id
  }
}
