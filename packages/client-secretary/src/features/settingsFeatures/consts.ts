import { z } from 'zod'

import type { SettingsFormValues } from './types'

export const DEFAULT_SETTINGS_FORM_VALUES: SettingsFormValues = {
  doctor_name: '',
  professional_membership: '',
  rpps_number: '',
  adeli_number: '',
  address: '',
  mindray_service_date: '',
  mindray_characteristics: '',
}

export const settingsFormSchema = z.object({
  doctor_name: z.string(),
  professional_membership: z.string(),
  rpps_number: z.string(),
  adeli_number: z.string(),
  address: z.string(),
  mindray_service_date: z.string(),
  mindray_characteristics: z.string(),
})
