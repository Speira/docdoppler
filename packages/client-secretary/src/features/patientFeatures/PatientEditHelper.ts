import { patientService } from '#/services/patient-service'
import { formatDateFR } from '#/lib/date'
import { reportService } from '#/services/report-service'
import type { ReportPage, ReportSummary } from '#/services/report-service'
import type { PatientFormValues } from './types'
import { patientReportHistoryPageSize } from './consts'

export class PatientEditHelper {
  /**
   * Validates the `/patients/$patientId` path param. Path params always reach
   * us as raw strings, so `/patients/abc` arrives as "abc" and must be
   * rejected here rather than handed to the API as `NaN`. Leading zeros are
   * refused too, so every patient has exactly one canonical URL.
   * Also used to rescue the legacy `/patients/add?id=N` links, where the
   * router's search parser has already turned the value into a number.
   */
  static parsePatientId(raw: unknown): number | null {
    if (typeof raw === 'number') {
      return Number.isSafeInteger(raw) && raw > 0 ? raw : null
    }
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    if (!/^[1-9][0-9]*$/.test(trimmed)) return null
    const id = Number(trimmed)
    return Number.isSafeInteger(id) ? id : null
  }

  static async loadPatient(id: number): Promise<PatientFormValues> {
    const patient = await patientService.getPatient(id)
    return {
      first_name: patient.first_name,
      last_name: patient.last_name,
      dob: patient.dob,
      exam_date: patient.exam_date,
      sex: patient.sex,
      diabetes: patient.riskFactors?.diabetes === 1,
      hypertension: patient.riskFactors?.hypertension === 1,
      cholesterol: patient.riskFactors?.cholesterol === 1,
      obesity: patient.riskFactors?.obesity === 1,
      vertigo: patient.riskFactors?.vertigo === 1,
      carotid_bruit: patient.riskFactors?.carotid_bruit === 1,
      avc: patient.riskFactors?.avc === 1,
      smoking: patient.riskFactors?.smoking === 1,
    }
  }

  static async deletePatient(id: number): Promise<void> {
    await patientService.deletePatient(id)
  }

  static async updatePatient(id: number, values: PatientFormValues): Promise<number> {
    const patient = await patientService.updatePatient(id, {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      dob: values.dob,
      exam_date: values.exam_date,
      sex: values.sex,
    })
    await patientService.addRiskFactors(patient.id, {
      diabetes: values.diabetes,
      hypertension: values.hypertension,
      cholesterol: values.cholesterol,
      obesity: values.obesity,
      vertigo: values.vertigo,
      carotid_bruit: values.carotid_bruit,
      avc: values.avc,
      smoking: values.smoking,
    })
    return patient.id
  }

  /**
   * `reports.created_at` is a full ISO timestamp, not a plain date, so the
   * date part has to be cut off before formatting — `formatDateFR` splits on
   * '-' and would otherwise choke on "25T00:00:00.000Z".
   */
  static formatReportDate(isoTimestamp: string): string {
    return formatDateFR(isoTimestamp.slice(0, 10))
  }

  /** First page of the patient's report history, newest first. */
  static listReports(id: number): Promise<ReportPage> {
    return reportService.listReports(id, {
      limit: patientReportHistoryPageSize,
      offset: 0,
    })
  }

  /** The next page, starting after the rows already on screen. */
  static loadMoreReports(id: number, loadedCount: number): Promise<ReportPage> {
    return reportService.listReports(id, {
      limit: patientReportHistoryPageSize,
      offset: loadedCount,
    })
  }

  /**
   * Appends a freshly loaded page, dropping ids already on screen. Offset
   * paging can hand back a row twice if a report is created in another tab
   * between two "Voir plus" clicks; React keys must stay unique regardless.
   */
  static appendReports(
    loaded: ReportSummary[],
    incoming: ReportSummary[],
  ): ReportSummary[] {
    const seen = new Set(loaded.map((report) => report.id))
    return [...loaded, ...incoming.filter((report) => !seen.has(report.id))]
  }

  static hasMoreReports(loadedCount: number, total: number): boolean {
    return loadedCount < total
  }

  static remainingReportCount(loadedCount: number, total: number): number {
    return Math.max(total - loadedCount, 0)
  }
}
