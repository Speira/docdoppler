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

export type ExamDaySection = 'today' | 'upcoming' | 'past'

export type ExamDayGroup<T> = { section: ExamDaySection; patients: T[] }

// Base sensitivity: "martin" sorts with "Martin" and "Élise" with "Elise",
// which SQLite's byte-wise ORDER BY does not do.
const nameCollator = new Intl.Collator('fr', { sensitivity: 'base' })

function compareNames(a: PatientRecord, b: PatientRecord): number {
  return (
    nameCollator.compare(a.last_name, b.last_name) ||
    nameCollator.compare(a.first_name, b.first_name) ||
    a.id - b.id
  )
}

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

  /**
   * The list's only ordering: today's patients first (the day's work), then
   * upcoming exams soonest first, then past exams most recent first. Patients
   * sharing a day are alphabetical. Empty sections are left out, so the
   * caller renders exactly what it gets.
   */
  static groupByExamDay<T extends PatientRecord>(
    patients: T[],
    today: string,
  ): ExamDayGroup<T>[] {
    const sections: Record<ExamDaySection, T[]> = { today: [], upcoming: [], past: [] }
    for (const patient of patients) {
      // ISO dates compare correctly as plain strings.
      if (patient.exam_date === today) sections.today.push(patient)
      else if (patient.exam_date > today) sections.upcoming.push(patient)
      else sections.past.push(patient)
    }

    sections.today.sort(compareNames)
    sections.upcoming.sort(
      (a, b) => a.exam_date.localeCompare(b.exam_date) || compareNames(a, b),
    )
    sections.past.sort(
      (a, b) => b.exam_date.localeCompare(a.exam_date) || compareNames(a, b),
    )

    return (['today', 'upcoming', 'past'] as const)
      .map((section) => ({ section, patients: sections[section] }))
      .filter((group) => group.patients.length > 0)
  }

  /**
   * Today as `yyyy-mm-dd` in local time. `toISOString()` would give the UTC
   * day, which in France is still yesterday until 01:00 or 02:00.
   */
  static todayIso(now: Date = new Date()): string {
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${now.getFullYear()}-${month}-${day}`
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
