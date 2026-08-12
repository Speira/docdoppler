import { isValidIsoDate } from "./patients.js";

export type WorklistValidationResult =
  | { valid: true; date: string }
  | { valid: false; error: "DATE_INVALID" };

export function validateWorklistQuery(
  query: unknown,
): WorklistValidationResult {
  const q = (query ?? {}) as Record<string, unknown>;
  if (typeof q.date !== "string" || !isValidIsoDate(q.date)) {
    return { valid: false, error: "DATE_INVALID" };
  }
  return { valid: true, date: q.date };
}
