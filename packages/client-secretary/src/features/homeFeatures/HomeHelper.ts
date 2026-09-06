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
    // The stat only needs "does this patient have any report", so each lookup
    // asks for a single slim row and reads the server-side total.
    const reportResults = await Promise.allSettled(
      patients.map((patient) => reportService.listReports(patient.id, { limit: 1 })),
    )
    const patientsWithReportCount = reportResults.filter(
      (result) => result.status === 'fulfilled' && result.value.total > 0,
    ).length

    return {
      patientCount: patients.length,
      patientsWithReportCount,
      settingsConfigured: settings.doctor_name.trim().length > 0,
    }
  }
}
