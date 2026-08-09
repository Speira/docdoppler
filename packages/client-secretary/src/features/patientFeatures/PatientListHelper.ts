import { patientService } from '#/services/patient-service'
import type { PatientRecord } from '#/services/patient-service'

const COMBINING_DIACRITICS = /[̀-ͯ]/g

function foldAccents(value: string): string {
  return value.normalize('NFD').replace(COMBINING_DIACRITICS, '').toLowerCase()
}

export class PatientListHelper {
  static listPatients(): Promise<PatientRecord[]> {
    return patientService.listPatients()
  }

  static filterPatients(patients: PatientRecord[], query: string): PatientRecord[] {
    const q = foldAccents(query.trim())
    if (!q) return patients
    return patients.filter(
      (p) =>
        foldAccents(p.first_name).includes(q) ||
        foldAccents(p.last_name).includes(q) ||
        String(p.id).includes(q),
    )
  }

  static formatDob(dob: string): string {
    const [year, month, day] = dob.split('-')
    return `${day}/${month}/${year}`
  }

  static calculateAge(dob: string): number {
    const [year, month, day] = dob.split('-').map(Number)
    const birth = new Date(year, month - 1, day)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const hasHadBirthdayThisYear =
      today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
    if (!hasHadBirthdayThisYear) age -= 1
    return age
  }
}
