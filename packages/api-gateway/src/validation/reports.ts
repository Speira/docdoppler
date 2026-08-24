import { isValidIsoDate } from "./patients.js";
import type { CreateReportInput } from "../db/reports.js";

export type ReportValidationErrorCode =
  | "DOCTOR_NAME_REQUIRED"
  | "EXAM_DATE_REQUIRED"
  | "EXAM_DATE_INVALID"
  | "REPORT_FIELD_INVALID";

export type ReportValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: ReportValidationErrorCode };

function optionalString(value: unknown): string | typeof INVALID {
  if (value === undefined) return "";
  if (typeof value !== "string") return INVALID;
  return value;
}

function optionalNumber(value: unknown): number | null | typeof INVALID {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || Number.isNaN(value)) return INVALID;
  return value;
}

function optionalBoolean(value: unknown): boolean | typeof INVALID {
  if (value === undefined) return false;
  if (typeof value !== "boolean") return INVALID;
  return value;
}

const INVALID = Symbol("invalid");

export function validateCreateReport(
  body: unknown,
): ReportValidationResult<CreateReportInput> {
  const b = (body ?? {}) as Record<string, unknown>;

  if (typeof b.doctor_name !== "string" || b.doctor_name.trim().length === 0) {
    return { valid: false, error: "DOCTOR_NAME_REQUIRED" };
  }
  if (typeof b.exam_date !== "string" || b.exam_date.trim().length === 0) {
    return { valid: false, error: "EXAM_DATE_REQUIRED" };
  }
  if (!isValidIsoDate(b.exam_date)) {
    return { valid: false, error: "EXAM_DATE_INVALID" };
  }

  const tsa = (b.tsa ?? {}) as Record<string, unknown>;
  const aorte = (b.aorte_abdominale ?? {}) as Record<string, unknown>;
  const mi = (b.membres_inferieurs ?? {}) as Record<string, unknown>;

  const fields = {
    correspondant_dossier: optionalString(b.correspondant_dossier),
    indication: optionalString(b.indication),
    tsa_imt_droit: optionalNumber(tsa.imt_droit),
    tsa_imt_gauche: optionalNumber(tsa.imt_gauche),
    tsa_aci_acc_ratio_droit: optionalNumber(tsa.aci_acc_ratio_droit),
    tsa_aci_acc_ratio_gauche: optionalNumber(tsa.aci_acc_ratio_gauche),
    tsa_findings_text: optionalString(tsa.findings_text),
    aorte_diametre: optionalString(aorte.diametre),
    aorte_anevrisme: optionalBoolean(aorte.anevrisme),
    aorte_anevrisme_diametre_mm: optionalNumber(aorte.anevrisme_diametre_mm),
    aorte_findings_text: optionalString(aorte.findings_text),
    mi_pression_cheville_droite: optionalNumber(mi.pression_cheville_droite),
    mi_pression_cheville_gauche: optionalNumber(mi.pression_cheville_gauche),
    mi_pression_bras_droit: optionalNumber(mi.pression_bras_droit),
    mi_pression_bras_gauche: optionalNumber(mi.pression_bras_gauche),
    mi_findings_text: optionalString(mi.findings_text),
    conclusion: optionalString(b.conclusion),
  };

  for (const value of Object.values(fields)) {
    if (value === INVALID) {
      return { valid: false, error: "REPORT_FIELD_INVALID" };
    }
  }

  return {
    valid: true,
    data: {
      doctor_name: b.doctor_name.trim(),
      exam_date: b.exam_date,
      ...fields,
    } as unknown as CreateReportInput,
  };
}
