import { describe, expect, it } from 'vitest'
import { isPressureOutOfRange } from './ips'

describe('isPressureOutOfRange', () => {
  it('flags a value below 60', () => {
    expect(isPressureOutOfRange('59')).toBe(true)
  })

  it('flags a value above 300', () => {
    expect(isPressureOutOfRange('301')).toBe(true)
  })

  it('does not flag a value within range', () => {
    expect(isPressureOutOfRange('120')).toBe(false)
  })

  it('does not flag the boundary values themselves', () => {
    expect(isPressureOutOfRange('60')).toBe(false)
    expect(isPressureOutOfRange('300')).toBe(false)
  })

  it('does not flag an empty or non-numeric value', () => {
    expect(isPressureOutOfRange('')).toBe(false)
    expect(isPressureOutOfRange('abc')).toBe(false)
  })
})
