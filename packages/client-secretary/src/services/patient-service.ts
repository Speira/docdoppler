const API_BASE_URL = "http://localhost:3000"

export type Sex = "M" | "F"

export interface PatientRecord {
  id: number
  first_name: string
  last_name: string
  dob: string
  sex: Sex
  created_at: string
  updated_at: string
}

export interface RiskFactorsRecord {
  id: number
  patient_id: number
  diabetes: 0 | 1
  hypertension: 0 | 1
  cholesterol: 0 | 1
  obesity: 0 | 1
  vertigo: 0 | 1
  carotid_bruit: 0 | 1
  avc: 0 | 1
  smoking: 0 | 1
  created_at: string
  updated_at: string
}

export interface PatientWithRiskFactors extends PatientRecord {
  riskFactors: RiskFactorsRecord | null
}

export interface CreatePatientInput {
  first_name: string
  last_name: string
  dob: string
  sex: Sex
}

export type UpdatePatientInput = Partial<CreatePatientInput>

export interface RiskFactorsInput {
  diabetes?: boolean
  hypertension?: boolean
  cholesterol?: boolean
  obesity?: boolean
  vertigo?: boolean
  carotid_bruit?: boolean
  avc?: boolean
  smoking?: boolean
}

export type ApiErrorCode =
  | "FIRST_NAME_REQUIRED"
  | "LAST_NAME_REQUIRED"
  | "DOB_REQUIRED"
  | "DOB_INVALID"
  | "DOB_IN_FUTURE"
  | "SEX_REQUIRED"
  | "SEX_INVALID"
  | "RISK_FACTOR_VALUE_INVALID"
  | "PATIENT_NOT_FOUND"
  | "UNKNOWN_ERROR"

export class ApiError extends Error {
  constructor(public readonly code: ApiErrorCode) {
    super(code)
    this.name = "ApiError"
  }
}

export const apiErrorLabels: Record<ApiErrorCode, string> = {
  FIRST_NAME_REQUIRED: "Le prénom est requis.",
  LAST_NAME_REQUIRED: "Le nom est requis.",
  DOB_REQUIRED: "La date de naissance est requise.",
  DOB_INVALID: "La date de naissance est invalide.",
  DOB_IN_FUTURE: "La date de naissance ne peut pas être dans le futur.",
  SEX_REQUIRED: "Le sexe est requis.",
  SEX_INVALID: "Le sexe est invalide.",
  RISK_FACTOR_VALUE_INVALID: "Une valeur d'antécédent est invalide.",
  PATIENT_NOT_FOUND: "Patient introuvable.",
  UNKNOWN_ERROR: "Une erreur inattendue est survenue.",
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? apiErrorLabels[error.code]
    : apiErrorLabels.UNKNOWN_ERROR
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    throw new ApiError((body?.error ?? "UNKNOWN_ERROR") as ApiErrorCode)
  }
  return body as T
}

export class PatientService {
  listPatients(): Promise<PatientRecord[]> {
    return request<PatientRecord[]>("/patients")
  }

  createPatient(input: CreatePatientInput): Promise<PatientRecord> {
    return request<PatientRecord>("/patients", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  getPatient(id: number): Promise<PatientWithRiskFactors> {
    return request<PatientWithRiskFactors>(`/patients/${id}`)
  }

  updatePatient(id: number, input: UpdatePatientInput): Promise<PatientRecord> {
    return request<PatientRecord>(`/patients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  }

  deletePatient(id: number): Promise<void> {
    return request<void>(`/patients/${id}`, { method: "DELETE" })
  }

  addRiskFactors(id: number, input: RiskFactorsInput): Promise<RiskFactorsRecord> {
    return request<RiskFactorsRecord>(`/patients/${id}/risk-factors`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  }
}

export const patientService = new PatientService()
