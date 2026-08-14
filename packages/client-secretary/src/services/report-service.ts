const API_BASE_URL = "http://localhost:3000"

export interface VesselFindingInput {
  text?: string
  abnormal?: boolean
}

export interface CreateReportInput {
  doctor_name: string
  exam_date: string
  carotide?: VesselFindingInput
  artere_membre_sup?: VesselFindingInput
  veine_membre_sup?: VesselFindingInput
  artere_membre_inf?: VesselFindingInput
  veine_membre_inf?: VesselFindingInput
}

export interface ReportRecord {
  id: number
  patient_id: number
  doctor_name: string
  exam_date: string
  carotide_text: string
  carotide_abnormal: 0 | 1
  artere_membre_sup_text: string
  artere_membre_sup_abnormal: 0 | 1
  veine_membre_sup_text: string
  veine_membre_sup_abnormal: 0 | 1
  artere_membre_inf_text: string
  artere_membre_inf_abnormal: 0 | 1
  veine_membre_inf_text: string
  veine_membre_inf_abnormal: 0 | 1
  created_at: string
}

export type ReportApiErrorCode =
  | "DOCTOR_NAME_REQUIRED"
  | "EXAM_DATE_REQUIRED"
  | "EXAM_DATE_INVALID"
  | "FINDING_ABNORMAL_VALUE_INVALID"
  | "PATIENT_NOT_FOUND"
  | "REPORT_NOT_FOUND"
  | "UNKNOWN_ERROR"

export class ReportApiError extends Error {
  constructor(public readonly code: ReportApiErrorCode) {
    super(code)
    this.name = "ReportApiError"
  }
}

export const reportApiErrorLabels: Record<ReportApiErrorCode, string> = {
  DOCTOR_NAME_REQUIRED: "Le nom du médecin est requis.",
  EXAM_DATE_REQUIRED: "La date de l'examen est requise.",
  EXAM_DATE_INVALID: "La date de l'examen est invalide.",
  FINDING_ABNORMAL_VALUE_INVALID: "Une valeur de constatation est invalide.",
  PATIENT_NOT_FOUND: "Patient introuvable.",
  REPORT_NOT_FOUND: "Rapport introuvable.",
  UNKNOWN_ERROR: "Une erreur inattendue est survenue.",
}

export function reportApiErrorMessage(error: unknown): string {
  return error instanceof ReportApiError
    ? reportApiErrorLabels[error.code]
    : reportApiErrorLabels.UNKNOWN_ERROR
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    throw new ReportApiError((body?.error ?? "UNKNOWN_ERROR") as ReportApiErrorCode)
  }
  return body as T
}

export class ReportService {
  createReport(patientId: number, input: CreateReportInput): Promise<ReportRecord> {
    return request<ReportRecord>(`/patients/${patientId}/reports`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  listReports(patientId: number): Promise<ReportRecord[]> {
    return request<ReportRecord[]>(`/patients/${patientId}/reports`)
  }

  reportPdfUrl(reportId: number): string {
    return `${API_BASE_URL}/reports/${reportId}/pdf`
  }
}

export const reportService = new ReportService()
