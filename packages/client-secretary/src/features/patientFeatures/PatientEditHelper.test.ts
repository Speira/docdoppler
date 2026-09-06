import { describe, expect, it } from 'vitest'
import { PatientEditHelper } from './PatientEditHelper'
import type { ReportSummary } from '#/services/report-service'

describe('PatientEditHelper.parsePatientId', () => {
  it('accepts a positive integer string, as a path param delivers it', () => {
    expect(PatientEditHelper.parsePatientId('12')).toBe(12)
    expect(PatientEditHelper.parsePatientId('1')).toBe(1)
  })

  it('accepts a number, as the legacy ?id= search parser delivers it', () => {
    expect(PatientEditHelper.parsePatientId(12)).toBe(12)
  })

  it('rejects anything that is not a whole positive number', () => {
    expect(PatientEditHelper.parsePatientId('abc')).toBeNull()
    expect(PatientEditHelper.parsePatientId('1.5')).toBeNull()
    expect(PatientEditHelper.parsePatientId('-3')).toBeNull()
    expect(PatientEditHelper.parsePatientId('0')).toBeNull()
    expect(PatientEditHelper.parsePatientId('1e3')).toBeNull()
    expect(PatientEditHelper.parsePatientId('12abc')).toBeNull()
    expect(PatientEditHelper.parsePatientId('')).toBeNull()
    expect(PatientEditHelper.parsePatientId('   ')).toBeNull()
    expect(PatientEditHelper.parsePatientId(1.5)).toBeNull()
    expect(PatientEditHelper.parsePatientId(-3)).toBeNull()
    expect(PatientEditHelper.parsePatientId(0)).toBeNull()
    expect(PatientEditHelper.parsePatientId(Number.NaN)).toBeNull()
  })

  it('rejects leading zeros so each patient has one canonical URL', () => {
    expect(PatientEditHelper.parsePatientId('007')).toBeNull()
  })

  it('rejects a missing or non-scalar param', () => {
    expect(PatientEditHelper.parsePatientId(undefined)).toBeNull()
    expect(PatientEditHelper.parsePatientId(null)).toBeNull()
    expect(PatientEditHelper.parsePatientId(['1'])).toBeNull()
    expect(PatientEditHelper.parsePatientId({ id: 1 })).toBeNull()
  })

  it('rejects an integer beyond safe precision', () => {
    expect(PatientEditHelper.parsePatientId('9007199254740993')).toBeNull()
  })
})

describe('PatientEditHelper.formatReportDate', () => {
  it('formats the date part of an ISO timestamp', () => {
    expect(PatientEditHelper.formatReportDate('2026-08-25T00:00:00.000Z')).toBe(
      '25/08/2026',
    )
  })

  it('also accepts a plain ISO date', () => {
    expect(PatientEditHelper.formatReportDate('2026-08-25')).toBe('25/08/2026')
  })
})

function summary(id: number): ReportSummary {
  return {
    id,
    patient_id: 1,
    exam_date: '2026-08-25',
    created_at: '2026-08-25T00:00:00.000Z',
  }
}

describe('PatientEditHelper.appendReports', () => {
  it('appends the incoming page after the rows already loaded', () => {
    expect(
      PatientEditHelper.appendReports([summary(3), summary(2)], [summary(1)]),
    ).toEqual([summary(3), summary(2), summary(1)])
  })

  it('drops rows already on screen, so keys stay unique', () => {
    expect(
      PatientEditHelper.appendReports([summary(3), summary(2)], [summary(2), summary(1)]),
    ).toEqual([summary(3), summary(2), summary(1)])
  })

  it('does not mutate the loaded list', () => {
    const loaded = [summary(3)]
    PatientEditHelper.appendReports(loaded, [summary(2)])
    expect(loaded).toEqual([summary(3)])
  })

  it('handles an empty incoming page', () => {
    expect(PatientEditHelper.appendReports([summary(3)], [])).toEqual([summary(3)])
  })
})

describe('PatientEditHelper.hasMoreReports', () => {
  it('is true while fewer rows are loaded than the total', () => {
    expect(PatientEditHelper.hasMoreReports(10, 12)).toBe(true)
  })

  it('is false once every row is loaded', () => {
    expect(PatientEditHelper.hasMoreReports(12, 12)).toBe(false)
    expect(PatientEditHelper.hasMoreReports(0, 0)).toBe(false)
  })
})

describe('PatientEditHelper.remainingReportCount', () => {
  it('counts the rows still to load', () => {
    expect(PatientEditHelper.remainingReportCount(10, 12)).toBe(2)
  })

  it('never goes negative when the total shrinks under us', () => {
    expect(PatientEditHelper.remainingReportCount(12, 10)).toBe(0)
  })
})
