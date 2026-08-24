import { ApiError } from "./api-error"

const API_BASE_URL = "http://localhost:3000"

export interface ClinicSettingsRecord {
  id: number
  doctor_name: string
  professional_membership: string
  rpps_number: string
  adeli_number: string
  address: string
  mindray_service_date: string | null
  mindray_characteristics: string
  updated_at: string
}

export interface UpdateSettingsInput {
  doctor_name: string
  professional_membership: string
  rpps_number: string
  adeli_number: string
  address: string
  mindray_service_date: string | null
  mindray_characteristics: string
}

export type SettingsApiErrorCode =
  | "SETTINGS_FIELD_INVALID"
  | "MINDRAY_SERVICE_DATE_INVALID"
  | "UNKNOWN_ERROR"

export const settingsApiErrorLabels: Record<SettingsApiErrorCode, string> = {
  SETTINGS_FIELD_INVALID: "Une valeur des paramètres est invalide.",
  MINDRAY_SERVICE_DATE_INVALID: "La date de mise en service est invalide.",
  UNKNOWN_ERROR: "Une erreur inattendue est survenue.",
}

export function settingsApiErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.code in settingsApiErrorLabels
    ? settingsApiErrorLabels[error.code as SettingsApiErrorCode]
    : settingsApiErrorLabels.UNKNOWN_ERROR
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    throw new ApiError<SettingsApiErrorCode>(body?.error ?? "UNKNOWN_ERROR")
  }
  return body as T
}

export class SettingsService {
  getSettings(): Promise<ClinicSettingsRecord> {
    return request<ClinicSettingsRecord>("/settings")
  }

  updateSettings(input: UpdateSettingsInput): Promise<ClinicSettingsRecord> {
    return request<ClinicSettingsRecord>("/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }
}

export const settingsService = new SettingsService()
