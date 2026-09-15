import { describe, expect, it } from 'vitest'
import { patientFormSchema, patientHistoryFieldGroups } from './consts'

function validPatient(dob: string) {
  return {
    first_name: 'Jean',
    last_name: 'Dupont',
    dob,
    exam_date: '2026-08-25',
    sex: 'M' as const,
    diabetes: false,
    hypertension: false,
    cholesterol: false,
    obesity: false,
    vertigo: false,
    carotid_bruit: false,
    avc: false,
    smoking: false,
  }
}

describe('patientFormSchema dob', () => {
  it('rejects a future date of birth', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const result = patientFormSchema.safeParse(validPatient(tomorrow))
    expect(result.success).toBe(false)
  })

  it('accepts today as a date of birth', () => {
    const today = new Date().toISOString().slice(0, 10)
    const result = patientFormSchema.safeParse(validPatient(today))
    expect(result.success).toBe(true)
  })

  it('accepts a past date of birth', () => {
    const result = patientFormSchema.safeParse(validPatient('1985-03-12'))
    expect(result.success).toBe(true)
  })

  it('rejects an empty date of birth', () => {
    const result = patientFormSchema.safeParse(validPatient(''))
    expect(result.success).toBe(false)
  })

  function dobMessages(dob: string): string[] {
    const result = patientFormSchema.safeParse(validPatient(dob))
    return result.success
      ? []
      : result.error.issues
          .filter((issue) => issue.path[0] === 'dob')
          .map((issue) => issue.message)
  }

  it('reports only "requise" for an empty date of birth', () => {
    expect(dobMessages('')).toEqual(['La date de naissance est requise.'])
  })

  it('rejects a date that does not exist on the calendar', () => {
    expect(dobMessages('1980-02-31')).toEqual([
      'La date de naissance est invalide.',
    ])
  })

  it('rejects a year before 1900', () => {
    expect(dobMessages('1899-12-31')).toEqual([
      "L'année de naissance doit être 1900 ou après.",
    ])
  })

  it('accepts 1 January 1900', () => {
    expect(dobMessages('1900-01-01')).toEqual([])
  })
})

describe('patientHistoryFieldGroups labels', () => {
  it('labels hypertension as HTA and cholesterol as Dyslipidémie, per doctor feedback', () => {
    const fields = patientHistoryFieldGroups.flatMap((group) => group.fields)
    expect(fields.find((field) => field.key === 'hypertension')?.label).toBe(
      'HTA',
    )
    expect(fields.find((field) => field.key === 'cholesterol')?.label).toBe(
      'Dyslipidémie',
    )
  })
})

describe('patientFormSchema sex', () => {
  it("accepts the three sex codes, 'O' standing for Autre", () => {
    for (const sex of ['M', 'F', 'O']) {
      const result = patientFormSchema.safeParse({
        ...validPatient('1985-03-12'),
        sex,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects an unknown sex code', () => {
    const result = patientFormSchema.safeParse({
      ...validPatient('1985-03-12'),
      sex: 'X',
    })
    expect(result.success).toBe(false)
  })
})
