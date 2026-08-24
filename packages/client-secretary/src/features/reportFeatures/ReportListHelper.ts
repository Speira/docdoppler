import { patientService } from '#/services/patient-service'
import { reportService } from '#/services/report-service'
import type { PatientRecord } from '#/services/patient-service'

const COMBINING_DIACRITICS = /[̀-ͯ]/g

function foldAccents(value: string): string {
  return value.normalize('NFD').replace(COMBINING_DIACRITICS, '').toLowerCase()
}

export type PatientWithLatestReport = PatientRecord & { latestReportId: number | null }

export class ReportListHelper {
  static async listPatientsWithLatestReport(): Promise<PatientWithLatestReport[]> {
    const patients = await patientService.listPatients()
    const results = await Promise.allSettled(
      patients.map((patient) => reportService.listReports(patient.id)),
    )
    return patients.map((patient, index) => {
      const result = results[index]
      return {
        ...patient,
        latestReportId: result.status === 'fulfilled' ? result.value[0]?.id ?? null : null,
      }
    })
  }

  static filterPatients(
    patients: PatientWithLatestReport[],
    query: string,
  ): PatientWithLatestReport[] {
    const q = foldAccents(query.trim())
    if (!q) return patients
    return patients.filter(
      (p) =>
        foldAccents(p.first_name).includes(q) ||
        foldAccents(p.last_name).includes(q) ||
        String(p.id).includes(q),
    )
  }

  static formatDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-')
    return `${day}/${month}/${year}`
  }
}
