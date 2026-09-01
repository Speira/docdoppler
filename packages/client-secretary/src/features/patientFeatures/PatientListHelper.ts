import { patientService } from '#/services/patient-service'
import { reportService } from '#/services/report-service'
import type { PatientRecord } from '#/services/patient-service'
import { formatDateFR } from '#/lib/date'

const COMBINING_DIACRITICS = /[̀-ͯ]/g

function foldAccents(value: string): string {
  return value.normalize('NFD').replace(COMBINING_DIACRITICS, '').toLowerCase()
}

export type PatientWithReportStatus = PatientRecord & { latestReportId: number | null }

export type ReportStatusFilter = 'all' | 'with' | 'without'

export class PatientListHelper {
  static async listPatientsWithReportStatus(): Promise<PatientWithReportStatus[]> {
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

  static filterPatients<T extends PatientRecord>(patients: T[], query: string): T[] {
    const q = foldAccents(query.trim())
    if (!q) return patients
    return patients.filter(
      (p) =>
        foldAccents(p.first_name).includes(q) ||
        foldAccents(p.last_name).includes(q) ||
        String(p.id).includes(q),
    )
  }

  static filterByReportStatus(
    patients: PatientWithReportStatus[],
    filter: ReportStatusFilter,
  ): PatientWithReportStatus[] {
    if (filter === 'all') return patients
    return patients.filter((p) =>
      filter === 'with' ? p.latestReportId !== null : p.latestReportId === null,
    )
  }

  static parseReportFilter(value: unknown): ReportStatusFilter {
    return value === 'with' || value === 'without' ? value : 'all'
  }

  static formatDate(isoDate: string): string {
    return formatDateFR(isoDate)
  }

  static calculateAge(dob: string): number {
    const [year, month, day] = dob.split('-').map(Number)
    const birth = new Date(year, month - 1, day)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const hasHadBirthdayThisYear =
      today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
    if (!hasHadBirthdayThisYear) age -= 1
    return age
  }
}
