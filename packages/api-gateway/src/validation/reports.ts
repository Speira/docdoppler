import { isValidIsoDate } from "./patients.js";
import { VESSEL_KEYS } from "@speira-docdoppler/shared-labels";
import type { CreateReportInput } from "../db/reports.js";

export type ReportValidationErrorCode =
  | "DOCTOR_NAME_REQUIRED"
  | "EXAM_DATE_REQUIRED"
  | "EXAM_DATE_INVALID"
  | "FINDING_ABNORMAL_VALUE_INVALID";

export type ReportValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: ReportValidationErrorCode };

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

  const data: Record<string, unknown> = {
    doctor_name: b.doctor_name.trim(),
    exam_date: b.exam_date,
  };

  // Both a bad `text` and a bad `abnormal` map to the same closed-set code
  // (FINDING_ABNORMAL_VALUE_INVALID) — the spec doesn't split these into two
  // codes, and the frontend form never sends the wrong type for either.
  for (const vessel of VESSEL_KEYS) {
    const raw = (b[vessel] ?? {}) as Record<string, unknown>;
    if (raw.text !== undefined && typeof raw.text !== "string") {
      return { valid: false, error: "FINDING_ABNORMAL_VALUE_INVALID" };
    }
    if (raw.abnormal !== undefined && typeof raw.abnormal !== "boolean") {
      return { valid: false, error: "FINDING_ABNORMAL_VALUE_INVALID" };
    }
    data[`${vessel}_text`] = (raw.text as string) ?? "";
    data[`${vessel}_abnormal`] = (raw.abnormal as boolean) ?? false;
  }

  return { valid: true, data: data as unknown as CreateReportInput };
}
