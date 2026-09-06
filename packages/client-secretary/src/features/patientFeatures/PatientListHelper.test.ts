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

describe('PatientListHelper.sortByExamDate', () => {
  const older = { ...patient(1, { exam_date: '2026-01-05' }), latestReportId: null }
  const newer = { ...patient(2, { exam_date: '2026-08-25' }), latestReportId: null }

  it('returns the list untouched when unsorted', () => {
    const list = [newer, older]
    expect(PatientListHelper.sortByExamDate(list, null)).toBe(list)
  })

  it('sorts oldest first for "asc"', () => {
    expect(PatientListHelper.sortByExamDate([newer, older], 'asc')).toEqual([older, newer])
  })

  it('sorts most recent first for "desc"', () => {
    expect(PatientListHelper.sortByExamDate([older, newer], 'desc')).toEqual([newer, older])
  })

  it('does not mutate the input list', () => {
    const list = [newer, older]
    PatientListHelper.sortByExamDate(list, 'asc')
    expect(list).toEqual([newer, older])
  })

  it('keeps the API order for patients sharing an exam date', () => {
    const first = { ...patient(7, { exam_date: '2026-03-01' }), latestReportId: null }
    const second = { ...patient(8, { exam_date: '2026-03-01' }), latestReportId: null }
    expect(PatientListHelper.sortByExamDate([first, second], 'asc')).toEqual([first, second])
  })
})

describe('PatientListHelper.nextExamDateSort', () => {
  it('cycles unsorted → ascending → descending → unsorted', () => {
    expect(PatientListHelper.nextExamDateSort(null)).toBe('asc')
    expect(PatientListHelper.nextExamDateSort('asc')).toBe('desc')
    expect(PatientListHelper.nextExamDateSort('desc')).toBeNull()
  })
})

describe('PatientListHelper.examDateAriaSort', () => {
  it('maps the sort state onto the aria-sort values', () => {
    expect(PatientListHelper.examDateAriaSort('asc')).toBe('ascending')
    expect(PatientListHelper.examDateAriaSort('desc')).toBe('descending')
    expect(PatientListHelper.examDateAriaSort(null)).toBe('none')
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
