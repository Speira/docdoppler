import { RISK_FACTOR_FIELDS, type RiskFactorField } from "../db/patients.js";

export type ValidationErrorCode =
  | "FIRST_NAME_REQUIRED"
  | "LAST_NAME_REQUIRED"
  | "DOB_REQUIRED"
  | "DOB_INVALID"
  | "DOB_IN_FUTURE"
  | "SEX_REQUIRED"
  | "SEX_INVALID"
  | "EXAM_DATE_INVALID"
  | "RISK_FACTOR_VALUE_INVALID";

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: ValidationErrorCode };

export interface CreatePatientInput {
  first_name: string;
  last_name: string;
  dob: string;
  sex: "M" | "F";
  exam_date: string;
}

export type UpdatePatientInput = Partial<CreatePatientInput>;

export type RiskFactorsInput = Partial<Record<RiskFactorField, boolean>>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function todayIsoString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDobInFuture(dob: string): boolean {
  return dob > todayIsoString();
}

export function validateCreatePatient(
  body: unknown,
): ValidationResult<CreatePatientInput> {
  const b = (body ?? {}) as Record<string, unknown>;

  if (typeof b.first_name !== "string" || b.first_name.trim().length === 0) {
    return { valid: false, error: "FIRST_NAME_REQUIRED" };
  }
  if (typeof b.last_name !== "string" || b.last_name.trim().length === 0) {
    return { valid: false, error: "LAST_NAME_REQUIRED" };
  }
  if (typeof b.dob !== "string" || b.dob.trim().length === 0) {
    return { valid: false, error: "DOB_REQUIRED" };
  }
  if (!isValidIsoDate(b.dob)) {
    return { valid: false, error: "DOB_INVALID" };
  }
  if (isDobInFuture(b.dob)) {
    return { valid: false, error: "DOB_IN_FUTURE" };
  }
  if (typeof b.sex !== "string" || b.sex.trim().length === 0) {
    return { valid: false, error: "SEX_REQUIRED" };
  }
  if (b.sex !== "M" && b.sex !== "F") {
    return { valid: false, error: "SEX_INVALID" };
  }
  let examDate = todayIsoString();
  if (b.exam_date !== undefined) {
    if (typeof b.exam_date !== "string" || !isValidIsoDate(b.exam_date)) {
      return { valid: false, error: "EXAM_DATE_INVALID" };
    }
    examDate = b.exam_date;
  }

  return {
    valid: true,
    data: {
      first_name: b.first_name.trim(),
      last_name: b.last_name.trim(),
      dob: b.dob,
      sex: b.sex,
      exam_date: examDate,
    },
  };
}

export function validateUpdatePatient(
  body: unknown,
): ValidationResult<UpdatePatientInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: UpdatePatientInput = {};

  if (b.first_name !== undefined) {
    if (
      typeof b.first_name !== "string" ||
      b.first_name.trim().length === 0
    ) {
      return { valid: false, error: "FIRST_NAME_REQUIRED" };
    }
    data.first_name = b.first_name.trim();
  }
  if (b.last_name !== undefined) {
    if (typeof b.last_name !== "string" || b.last_name.trim().length === 0) {
      return { valid: false, error: "LAST_NAME_REQUIRED" };
    }
    data.last_name = b.last_name.trim();
  }
  if (b.dob !== undefined) {
    if (typeof b.dob !== "string" || !isValidIsoDate(b.dob)) {
      return { valid: false, error: "DOB_INVALID" };
    }
    if (isDobInFuture(b.dob)) {
      return { valid: false, error: "DOB_IN_FUTURE" };
    }
    data.dob = b.dob;
  }
  if (b.sex !== undefined) {
    if (b.sex !== "M" && b.sex !== "F") {
      return { valid: false, error: "SEX_INVALID" };
    }
    data.sex = b.sex;
  }
  if (b.exam_date !== undefined) {
    if (typeof b.exam_date !== "string" || !isValidIsoDate(b.exam_date)) {
      return { valid: false, error: "EXAM_DATE_INVALID" };
    }
    data.exam_date = b.exam_date;
  }

  return { valid: true, data };
}

export function validateRiskFactorsEntry(
  body: unknown,
): ValidationResult<RiskFactorsInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: RiskFactorsInput = {};

  for (const field of RISK_FACTOR_FIELDS) {
    if (b[field] !== undefined) {
      if (typeof b[field] !== "boolean") {
        return { valid: false, error: "RISK_FACTOR_VALUE_INVALID" };
      }
      data[field] = b[field] as boolean;
    }
  }

  return { valid: true, data };
}
