import { describe, expect, it } from 'vitest'
import { patientFormSchema } from './consts'

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
})
