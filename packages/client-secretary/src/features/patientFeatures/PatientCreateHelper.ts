import { patientService } from '#/services/patient-service'
import type { PatientFormValues } from './types'

export class PatientCreateHelper {
  static async createPatient(values: PatientFormValues): Promise<number> {
    const patient = await patientService.createPatient({
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      dob: values.dob,
      exam_date: values.exam_date,
      sex: values.sex,
    })
    await patientService.addRiskFactors(patient.id, {
      diabetes: values.diabetes,
      hypertension: values.hypertension,
      cholesterol: values.cholesterol,
      obesity: values.obesity,
      vertigo: values.vertigo,
      carotid_bruit: values.carotid_bruit,
      avc: values.avc,
      smoking: values.smoking,
    })
    return patient.id
  }
}
