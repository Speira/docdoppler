import { describe, expect, it } from 'vitest'
import { formatSex } from './sex'

const t = (key: string) => key

describe('formatSex', () => {
  it('labels the three stored codes in French', () => {
    expect(formatSex('F', t)).toBe('Féminin')
    expect(formatSex('M', t)).toBe('Masculin')
    expect(formatSex('O', t)).toBe('Autre')
  })
})
