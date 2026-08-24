import { ApiError } from "./api-error"

const API_BASE_URL = "http://localhost:3000"

export interface TsaInput {
  imt_droit?: number | null
  imt_gauche?: number | null
  aci_acc_ratio_droit?: number | null
  aci_acc_ratio_gauche?: number | null
  findings_text?: string
}

export interface AorteAbdominaleInput {
  diametre?: string
  anevrisme?: boolean
  anevrisme_diametre_mm?: number | null
  findings_text?: string
}

export interface MembresInferieursInput {
  pression_cheville_droite?: number | null
  pression_cheville_gauche?: number | null
  pression_bras_droit?: number | null
  pression_bras_gauche?: number | null
  findings_text?: string
}

export interface CreateReportInput {
  doctor_name: string
  exam_date: string
  correspondant_dossier?: string
  indication?: string
  tsa?: TsaInput
  aorte_abdominale?: AorteAbdominaleInput
  membres_inferieurs?: MembresInferieursInput
  conclusion?: string
}

export interface ReportRecord {
  id: number
  patient_id: number
  doctor_name: string
  exam_date: string
  correspondant_dossier: string
  indication: string
  tsa_imt_droit: number | null
  tsa_imt_gauche: number | null
  tsa_aci_acc_ratio_droit: number | null
  tsa_aci_acc_ratio_gauche: number | null
  tsa_findings_text: string
  aorte_diametre: string
  aorte_anevrisme: 0 | 1
  aorte_anevrisme_diametre_mm: number | null
  aorte_findings_text: string
  mi_pression_cheville_droite: number | null
  mi_pression_cheville_gauche: number | null
  mi_pression_bras_droit: number | null
  mi_pression_bras_gauche: number | null
  mi_ips_droit: number | null
  mi_ips_gauche: number | null
  mi_findings_text: string
  conclusion: string
  created_at: string
}

export type ReportApiErrorCode =
  | "DOCTOR_NAME_REQUIRED"
  | "EXAM_DATE_REQUIRED"
  | "EXAM_DATE_INVALID"
  | "REPORT_FIELD_INVALID"
  | "PATIENT_NOT_FOUND"
  | "REPORT_NOT_FOUND"
  | "UNKNOWN_ERROR"

export const reportApiErrorLabels: Record<ReportApiErrorCode, string> = {
  DOCTOR_NAME_REQUIRED: "Le nom du médecin est requis.",
  EXAM_DATE_REQUIRED: "La date de l'examen est requise.",
  EXAM_DATE_INVALID: "La date de l'examen est invalide.",
  REPORT_FIELD_INVALID: "Une valeur du rapport est invalide.",
  PATIENT_NOT_FOUND: "Patient introuvable.",
  REPORT_NOT_FOUND: "Rapport introuvable.",
  UNKNOWN_ERROR: "Une erreur inattendue est survenue.",
}

export function reportApiErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.code in reportApiErrorLabels
    ? reportApiErrorLabels[error.code as ReportApiErrorCode]
    : reportApiErrorLabels.UNKNOWN_ERROR
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    throw new ApiError<ReportApiErrorCode>(body?.error ?? "UNKNOWN_ERROR")
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
