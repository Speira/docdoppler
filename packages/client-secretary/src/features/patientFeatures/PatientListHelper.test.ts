import { describe, expect, it, vi } from 'vitest'

vi.mock('#/services/patient-service', () => ({
  patientService: { listPatients: vi.fn() },
}))
vi.mock('#/services/report-service', () => ({
  reportService: { listReports: vi.fn() },
}))

import { patientService } from '#/services/patient-service'
import { reportService } from '#/services/report-service'
import { PatientListHelper } from './PatientListHelper'
import type { PatientRecord } from '#/services/patient-service'

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

describe('PatientListHelper.listPatientsWithReportStatus', () => {
  it('attaches the latest report id when reports exist', async () => {
    vi.mocked(patientService.listPatients).mockResolvedValue([patient(1)])
    vi.mocked(reportService.listReports).mockResolvedValue([
      { id: 42 } as never,
      { id: 41 } as never,
    ])

    const result = await PatientListHelper.listPatientsWithReportStatus()

    expect(result).toEqual([{ ...patient(1), latestReportId: 42 }])
  })

  it('sets latestReportId to null when a patient has no reports', async () => {
    vi.mocked(patientService.listPatients).mockResolvedValue([patient(2)])
    vi.mocked(reportService.listReports).mockResolvedValue([])

    const result = await PatientListHelper.listPatientsWithReportStatus()

    expect(result[0].latestReportId).toBeNull()
  })

  it('sets latestReportId to null when the report lookup fails for a patient', async () => {
    vi.mocked(patientService.listPatients).mockResolvedValue([patient(3)])
    vi.mocked(reportService.listReports).mockRejectedValue(new Error('network'))

    const result = await PatientListHelper.listPatientsWithReportStatus()

    expect(result[0].latestReportId).toBeNull()
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
