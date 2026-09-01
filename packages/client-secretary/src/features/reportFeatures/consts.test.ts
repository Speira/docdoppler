import { describe, expect, it } from 'vitest'
import { getReportBuilderDefaultValues, reportBuilderFormSchema } from './consts'

describe('report builder artery fields', () => {
  it('defaults every artery field to an empty string', () => {
    const values = getReportBuilderDefaultValues('2026-08-13', 'Dr Martin')
    expect(values.mi_droite_afc_spectre).toBe('')
    expect(values.mi_droite_afc_vsm).toBe('')
    expect(values.mi_gauche_fibulaire_spectre).toBe('')
  })

  it('accepts a valid spectre and an empty one', () => {
    const base = getReportBuilderDefaultValues('2026-08-13', 'Dr Martin')
    expect(
      reportBuilderFormSchema.safeParse({
        ...base,
        mi_droite_afc_spectre: 'triphasique',
      }).success,
    ).toBe(true)
    expect(reportBuilderFormSchema.safeParse(base).success).toBe(true)
  })

  it('rejects a spectre outside the allowed set', () => {
    const base = getReportBuilderDefaultValues('2026-08-13', 'Dr Martin')
    expect(
      reportBuilderFormSchema.safeParse({
        ...base,
        mi_droite_afc_spectre: 'bruit',
      }).success,
    ).toBe(false)
  })

  it('rejects a non-numeric vsm', () => {
    const base = getReportBuilderDefaultValues('2026-08-13', 'Dr Martin')
    expect(
      reportBuilderFormSchema.safeParse({ ...base, mi_droite_afc_vsm: 'abc' }).success,
    ).toBe(false)
  })
})
