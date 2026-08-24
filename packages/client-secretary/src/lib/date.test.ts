import { describe, expect, it } from 'vitest'
import { formatDateFR } from './date'

describe('formatDateFR', () => {
  it('formats an ISO date as DD/MM/YYYY using the fr-FR locale', () => {
    expect(formatDateFR('1985-03-12')).toBe('12/03/1985')
  })

  it('pads single-digit day and month', () => {
    expect(formatDateFR('2026-01-05')).toBe('05/01/2026')
  })
})
