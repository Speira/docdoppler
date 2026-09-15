import { describe, expect, it } from 'vitest'
import { DateOfBirthHelper } from './DateOfBirthHelper'

describe('DateOfBirthHelper.isRealIsoDate', () => {
  it('accepts a date that exists on the calendar', () => {
    expect(DateOfBirthHelper.isRealIsoDate('1980-05-04')).toBe(true)
    expect(DateOfBirthHelper.isRealIsoDate('2024-02-29')).toBe(true)
  })

  it('rejects a date that does not exist', () => {
    expect(DateOfBirthHelper.isRealIsoDate('1980-02-31')).toBe(false)
    expect(DateOfBirthHelper.isRealIsoDate('2023-02-29')).toBe(false)
    expect(DateOfBirthHelper.isRealIsoDate('1980-13-01')).toBe(false)
    expect(DateOfBirthHelper.isRealIsoDate('1980-00-10')).toBe(false)
    expect(DateOfBirthHelper.isRealIsoDate('1980-05-00')).toBe(false)
  })

  it('rejects anything not shaped yyyy-mm-dd', () => {
    expect(DateOfBirthHelper.isRealIsoDate('')).toBe(false)
    expect(DateOfBirthHelper.isRealIsoDate('1980-5-4')).toBe(false)
    expect(DateOfBirthHelper.isRealIsoDate('04/05/1980')).toBe(false)
  })
})
