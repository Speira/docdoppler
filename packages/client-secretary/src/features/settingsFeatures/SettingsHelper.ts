import { settingsService } from '#/services/settings-service'
import type { ClinicSettingsRecord } from '#/services/settings-service'
import type { SettingsFormValues } from './types'

export class SettingsHelper {
  static async loadSettings(): Promise<ClinicSettingsRecord> {
    return settingsService.getSettings()
  }

  static defaultValuesFrom(settings: ClinicSettingsRecord): SettingsFormValues {
    return {
      doctor_name: settings.doctor_name,
      professional_membership: settings.professional_membership,
      rpps_number: settings.rpps_number,
      adeli_number: settings.adeli_number,
      address: settings.address,
      mindray_service_date: settings.mindray_service_date ?? '',
      mindray_characteristics: settings.mindray_characteristics,
    }
  }

  static async saveSettings(values: SettingsFormValues): Promise<ClinicSettingsRecord> {
    return settingsService.updateSettings({
      doctor_name: values.doctor_name.trim(),
      professional_membership: values.professional_membership.trim(),
      rpps_number: values.rpps_number.trim(),
      adeli_number: values.adeli_number.trim(),
      address: values.address.trim(),
      mindray_service_date: values.mindray_service_date || null,
      mindray_characteristics: values.mindray_characteristics.trim(),
    })
  }
}
