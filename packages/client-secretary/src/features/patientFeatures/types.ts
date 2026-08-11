import type { Sex } from '#/services/patient-service'

export type PatientFormValues = {
  first_name: string
  last_name: string
  dob: string
  exam_date: string
  sex: Sex
  diabetes: boolean
  hypertension: boolean
  cholesterol: boolean
  obesity: boolean
  vertigo: boolean
  carotid_bruit: boolean
  avc: boolean
  smoking: boolean
}
