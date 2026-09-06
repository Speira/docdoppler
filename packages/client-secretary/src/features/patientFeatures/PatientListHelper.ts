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

/** `null` means "unsorted": the list keeps the order the API returned. */
export type ExamDateSort = 'asc' | 'desc' | null

/**
 * Why the table body has no rows: nothing has been recorded yet, or the
 * current search/filter combination excludes everything. The two need
 * different copy and different recovery actions.
 */
export type PatientListEmptyState = 'no-patients' | 'no-matches'

export class PatientListHelper {
  static async listPatientsWithReportStatus(): Promise<PatientWithReportStatus[]> {
    const patients = await patientService.listPatients()
    // Only the latest report's id is needed per row, so ask for exactly one
    // slim summary rather than downloading every report of every patient.
    const results = await Promise.allSettled(
      patients.map((patient) => reportService.listReports(patient.id, { limit: 1 })),
    )
    return patients.map((patient, index) => {
      const result = results[index]
      return {
        ...patient,
        latestReportId:
          result.status === 'fulfilled' ? result.value.items[0]?.id ?? null : null,
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

  static sortByExamDate<T extends PatientRecord>(patients: T[], sort: ExamDateSort): T[] {
    if (!sort) return patients
    const factor = sort === 'asc' ? 1 : -1
    // ISO dates sort correctly as plain strings; Array#sort is stable, so
    // patients sharing an exam date keep the order the API returned.
    return [...patients].sort((a, b) => factor * a.exam_date.localeCompare(b.exam_date))
  }

  /** Cycles ascending → descending → unsorted, so the API order stays reachable. */
  static nextExamDateSort(sort: ExamDateSort): ExamDateSort {
    if (sort === 'asc') return 'desc'
    if (sort === 'desc') return null
    return 'asc'
  }

  static examDateAriaSort(sort: ExamDateSort): 'ascending' | 'descending' | 'none' {
    if (sort === 'asc') return 'ascending'
    if (sort === 'desc') return 'descending'
    return 'none'
  }

  static hasActiveFilters(query: string, filter: ReportStatusFilter): boolean {
    return query.trim() !== '' || filter !== 'all'
  }

  static emptyState(
    totalCount: number,
    query: string,
    filter: ReportStatusFilter,
  ): PatientListEmptyState {
    return totalCount === 0 && !PatientListHelper.hasActiveFilters(query, filter)
      ? 'no-patients'
      : 'no-matches'
  }

  /** French plural mark for the counts rendered next to a number. */
  static pluralSuffix(count: number): '' | 's' {
    return count > 1 ? 's' : ''
  }

  /** "DUPONT Jean" — surname first and capitalised, the way a paper file is labelled. */
  static formatFullName(patient: Pick<PatientRecord, 'first_name' | 'last_name'>): string {
    return `${patient.last_name.toUpperCase()} ${patient.first_name}`.trim()
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
