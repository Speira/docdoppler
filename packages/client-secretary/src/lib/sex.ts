import type { Sex } from '#/services/patient-service'

// 'O' is the DICOM code for a sex that is neither M nor F; the Mindray worklist
// bridge sends `patients.sex` through as PatientSex unchanged.
export function formatSex(sex: Sex, t: (key: string) => string): string {
  if (sex === 'F') return t('Féminin')
  if (sex === 'M') return t('Masculin')
  return t('Autre')
}
