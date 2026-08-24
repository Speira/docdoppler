import { patientService } from '#/services/patient-service'
import { reportService } from '#/services/report-service'
import { settingsService } from '#/services/settings-service'

export interface HomeStats {
  patientCount: number
  patientsWithReportCount: number
  settingsConfigured: boolean
}

export class HomeHelper {
  static async loadStats(): Promise<HomeStats> {
    const [patients, settings] = await Promise.all([
      patientService.listPatients(),
      settingsService.getSettings(),
    ])
    const reportResults = await Promise.allSettled(
      patients.map((patient) => reportService.listReports(patient.id)),
    )
    const patientsWithReportCount = reportResults.filter(
      (result) => result.status === 'fulfilled' && result.value.length > 0,
    ).length

    return {
      patientCount: patients.length,
      patientsWithReportCount,
      settingsConfigured: settings.doctor_name.trim().length > 0,
    }
  }
}
