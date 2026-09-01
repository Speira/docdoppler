import { describe, expect, it } from 'vitest'
import { arteresPayload } from './ReportBuilderHelper'
import { getReportBuilderDefaultValues } from './consts'

describe('arteresPayload', () => {
  it('sends a filled AFC with its vsm and spectre', () => {
    const values = {
      ...getReportBuilderDefaultValues('2026-08-13', 'Dr Martin'),
      mi_droite_afc_spectre: 'triphasique',
      mi_droite_afc_vsm: '85',
    }
    expect(arteresPayload(values).droite.afc).toEqual({
      vsm: 85,
      spectre: 'triphasique',
    })
  })

  it('omits an artery the doctor left untouched', () => {
    const values = getReportBuilderDefaultValues('2026-08-13', 'Dr Martin')
    expect(arteresPayload(values)).toEqual({})
  })

  it('never sends a vsm for a non-AFC artery', () => {
    const values = {
      ...getReportBuilderDefaultValues('2026-08-13', 'Dr Martin'),
      mi_gauche_poplitee_spectre: 'monophasique',
    }
    expect(arteresPayload(values).gauche.poplitee).toEqual({
      vsm: null,
      spectre: 'monophasique',
    })
  })
})
