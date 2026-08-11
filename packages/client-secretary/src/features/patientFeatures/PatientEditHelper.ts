import { patientService } from '#/services/patient-service'
import type { PatientFormValues } from './types'

export class PatientEditHelper {
  static async loadPatient(id: number): Promise<PatientFormValues> {
    const patient = await patientService.getPatient(id)
    return {
      first_name: patient.first_name,
      last_name: patient.last_name,
      dob: patient.dob,
      exam_date: patient.exam_date,
      sex: patient.sex,
      diabetes: patient.riskFactors?.diabetes === 1,
      hypertension: patient.riskFactors?.hypertension === 1,
      cholesterol: patient.riskFactors?.cholesterol === 1,
      obesity: patient.riskFactors?.obesity === 1,
      vertigo: patient.riskFactors?.vertigo === 1,
      carotid_bruit: patient.riskFactors?.carotid_bruit === 1,
      avc: patient.riskFactors?.avc === 1,
      smoking: patient.riskFactors?.smoking === 1,
    }
  }

  static async deletePatient(id: number): Promise<void> {
    await patientService.deletePatient(id)
  }

  static async updatePatient(id: number, values: PatientFormValues): Promise<number> {
    const patient = await patientService.updatePatient(id, {
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
