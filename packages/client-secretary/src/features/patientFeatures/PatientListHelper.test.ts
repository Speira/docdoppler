import { describe, expect, it, vi } from 'vitest'
import { patientService } from '#/services/patient-service'
import { reportService } from '#/services/report-service'
import { PatientListHelper } from './PatientListHelper'
import type { PatientRecord } from '#/services/patient-service'
import type { ReportPage, ReportSummary } from '#/services/report-service'

vi.mock('#/services/patient-service', () => ({
  patientService: { listPatients: vi.fn() },
}))
vi.mock('#/services/report-service', () => ({
  reportService: { listReports: vi.fn() },
}))

function patient(id: number, overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id,
    first_name: 'Jean',
    last_name: 'Dupont',
    dob: '1985-03-12',
    exam_date: '2026-08-25',
    sex: 'M',
    created_at: '2026-08-25T00:00:00.000Z',
    updated_at: '2026-08-25T00:00:00.000Z',
    ...overrides,
  }
}

function page(items: ReportSummary[], total: number): ReportPage {
  return { items, total, limit: 1, offset: 0 }
}

describe('PatientListHelper.listPatientsWithReportStatus', () => {
  it('attaches the latest report id when reports exist', async () => {
    vi.mocked(patientService.listPatients).mockResolvedValue([patient(1)])
    vi.mocked(reportService.listReports).mockResolvedValue(
      page([{ id: 42 } as never, { id: 41 } as never], 2),
    )

    const result = await PatientListHelper.listPatientsWithReportStatus()

    expect(result).toEqual([{ ...patient(1), latestReportId: 42 }])
  })

  it('sets latestReportId to null when a patient has no reports', async () => {
    vi.mocked(patientService.listPatients).mockResolvedValue([patient(2)])
    vi.mocked(reportService.listReports).mockResolvedValue(page([], 0))

    const result = await PatientListHelper.listPatientsWithReportStatus()

    expect(result[0].latestReportId).toBeNull()
  })

  it('sets latestReportId to null when the report lookup fails for a patient', async () => {
    vi.mocked(patientService.listPatients).mockResolvedValue([patient(3)])
    vi.mocked(reportService.listReports).mockRejectedValue(new Error('network'))

    const result = await PatientListHelper.listPatientsWithReportStatus()

    expect(result[0].latestReportId).toBeNull()
  })

  it('keeps patients aligned with their own report result when results are mixed', async () => {
    vi.mocked(patientService.listPatients).mockResolvedValue([patient(1), patient(2)])
    vi.mocked(reportService.listReports)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(page([{ id: 99 } as never], 1))

    const result = await PatientListHelper.listPatientsWithReportStatus()

    expect(result).toEqual([
      { ...patient(1), latestReportId: null },
      { ...patient(2), latestReportId: 99 },
    ])
  })
})

describe('PatientListHelper.filterByReportStatus', () => {
  const withReport = { ...patient(1), latestReportId: 42 }
  const withoutReport = { ...patient(2), latestReportId: null }

  it('returns everyone for "all"', () => {
    expect(
      PatientListHelper.filterByReportStatus([withReport, withoutReport], 'all'),
    ).toEqual([withReport, withoutReport])
  })

  it('returns only patients with a report for "with"', () => {
    expect(
      PatientListHelper.filterByReportStatus([withReport, withoutReport], 'with'),
    ).toEqual([withReport])
  })

  it('returns only patients without a report for "without"', () => {
    expect(
      PatientListHelper.filterByReportStatus([withReport, withoutReport], 'without'),
    ).toEqual([withoutReport])
  })
})

describe('PatientListHelper.parseReportFilter', () => {
  it('accepts "with" and "without"', () => {
    expect(PatientListHelper.parseReportFilter('with')).toBe('with')
    expect(PatientListHelper.parseReportFilter('without')).toBe('without')
  })

  it('defaults anything else to "all"', () => {
    expect(PatientListHelper.parseReportFilter(undefined)).toBe('all')
    expect(PatientListHelper.parseReportFilter('bogus')).toBe('all')
    expect(PatientListHelper.parseReportFilter(null)).toBe('all')
  })
})

describe('PatientListHelper.filterPatients (generic)', () => {
  it('keeps extra fields (e.g. latestReportId) on the filtered results', () => {
    const withReport = { ...patient(1, { first_name: 'Marie' }), latestReportId: 42 }
    expect(PatientListHelper.filterPatients([withReport], 'marie')).toEqual([withReport])
  })
})

describe('PatientListHelper.groupByExamDay', () => {
  const today = '2026-09-11'
  const ids = (groups: { patients: PatientRecord[] }[]) =>
    groups.map((group) => group.patients.map((p) => p.id))

  it('splits patients into today, upcoming and past, in that order', () => {
    const past = patient(1, { exam_date: '2026-09-10' })
    const upcoming = patient(2, { exam_date: '2026-09-12' })
    const onToday = patient(3, { exam_date: today })

    const groups = PatientListHelper.groupByExamDay([past, upcoming, onToday], today)

    expect(groups.map((group) => group.section)).toEqual(['today', 'upcoming', 'past'])
    expect(ids(groups)).toEqual([[3], [2], [1]])
  })

  it('lists upcoming exams soonest first and past exams most recent first', () => {
    const groups = PatientListHelper.groupByExamDay(
      [
        patient(1, { exam_date: '2026-09-30' }),
        patient(2, { exam_date: '2026-09-15' }),
        patient(3, { exam_date: '2026-08-01' }),
        patient(4, { exam_date: '2026-09-01' }),
      ],
      today,
    )

    expect(ids(groups)).toEqual([
      [2, 1],
      [4, 3],
    ])
  })

  it('orders patients sharing an exam day by surname then first name, ignoring case and accents', () => {
    const groups = PatientListHelper.groupByExamDay(
      [
        patient(1, { exam_date: today, last_name: 'martin', first_name: 'Luc' }),
        patient(2, { exam_date: today, last_name: 'Zola', first_name: 'Émile' }),
        patient(3, { exam_date: today, last_name: 'Élise', first_name: 'Anne' }),
        patient(4, { exam_date: today, last_name: 'Dupont', first_name: 'Paul' }),
        patient(5, { exam_date: today, last_name: 'Dupont', first_name: 'anne' }),
      ],
      today,
    )

    expect(ids(groups)).toEqual([[5, 4, 3, 1, 2]])
  })

  it('falls back to the file number for identical names on the same day', () => {
    const groups = PatientListHelper.groupByExamDay(
      [patient(9, { exam_date: today }), patient(4, { exam_date: today })],
      today,
    )

    expect(ids(groups)).toEqual([[4, 9]])
  })

  it('leaves out sections with no patients', () => {
    const groups = PatientListHelper.groupByExamDay(
      [patient(1, { exam_date: '2026-09-01' })],
      today,
    )

    expect(groups.map((group) => group.section)).toEqual(['past'])
    expect(PatientListHelper.groupByExamDay([], today)).toEqual([])
  })

  it('keeps extra fields and does not mutate the input list', () => {
    const later = { ...patient(1, { exam_date: '2026-09-01' }), latestReportId: 42 }
    const sooner = { ...patient(2, { exam_date: '2026-09-05' }), latestReportId: null }
    const list = [later, sooner]

    const groups = PatientListHelper.groupByExamDay(list, today)

    expect(groups[0].patients).toEqual([sooner, later])
    expect(list).toEqual([later, sooner])
  })
})

describe('PatientListHelper.todayIso', () => {
  it("uses the clinic's local calendar day, not the UTC one", () => {
    // 00:30 local time is still the previous day in UTC for France (UTC+1/+2).
    expect(PatientListHelper.todayIso(new Date(2026, 8, 11, 0, 30))).toBe('2026-09-11')
    expect(PatientListHelper.todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('PatientListHelper.hasActiveFilters', () => {
  it('is false for an empty search and the "all" filter', () => {
    expect(PatientListHelper.hasActiveFilters('', 'all')).toBe(false)
    expect(PatientListHelper.hasActiveFilters('   ', 'all')).toBe(false)
  })

  it('is true as soon as a search term or a report filter is set', () => {
    expect(PatientListHelper.hasActiveFilters('dup', 'all')).toBe(true)
    expect(PatientListHelper.hasActiveFilters('', 'with')).toBe(true)
    expect(PatientListHelper.hasActiveFilters('', 'without')).toBe(true)
  })
})

describe('PatientListHelper.emptyState', () => {
  it('reports an empty practice when nothing is recorded and nothing is filtered', () => {
    expect(PatientListHelper.emptyState(0, '', 'all')).toBe('no-patients')
  })

  it('reports a fruitless search when filters are active', () => {
    expect(PatientListHelper.emptyState(0, 'zzz', 'all')).toBe('no-matches')
    expect(PatientListHelper.emptyState(0, '', 'with')).toBe('no-matches')
  })

  it('reports a fruitless search when patients exist but none matched', () => {
    expect(PatientListHelper.emptyState(12, 'zzz', 'all')).toBe('no-matches')
  })
})

describe('PatientListHelper.pluralSuffix', () => {
  it('stays singular for 0 and 1, as French does', () => {
    expect(PatientListHelper.pluralSuffix(0)).toBe('')
    expect(PatientListHelper.pluralSuffix(1)).toBe('')
  })

  it('pluralises from 2 upwards', () => {
    expect(PatientListHelper.pluralSuffix(2)).toBe('s')
  })
})

describe('PatientListHelper.formatFullName', () => {
  it('puts the capitalised surname first', () => {
    expect(
      PatientListHelper.formatFullName({ first_name: 'Jean', last_name: 'Dupont' }),
    ).toBe('DUPONT Jean')
  })

  it('uppercases accented surnames without dropping the accent', () => {
    expect(
      PatientListHelper.formatFullName({ first_name: 'Amélie', last_name: 'Léger' }),
    ).toBe('LÉGER Amélie')
  })

  it('trims when a name part is missing', () => {
    expect(PatientListHelper.formatFullName({ first_name: '', last_name: 'Dupont' })).toBe(
      'DUPONT',
    )
  })
})
