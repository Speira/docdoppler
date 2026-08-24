import { isValidIsoDate } from "./patients.js";
import type { UpdateClinicSettingsInput } from "../db/settings.js";

export type SettingsValidationErrorCode =
  | "SETTINGS_FIELD_INVALID"
  | "MINDRAY_SERVICE_DATE_INVALID";

export type SettingsValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: SettingsValidationErrorCode };

const INVALID = Symbol("invalid");

function optionalString(value: unknown): string | typeof INVALID {
  if (value === undefined) return "";
  if (typeof value !== "string") return INVALID;
  return value;
}

export function validateUpdateSettings(
  body: unknown,
): SettingsValidationResult<UpdateClinicSettingsInput> {
  const b = (body ?? {}) as Record<string, unknown>;

  const fields = {
    doctor_name: optionalString(b.doctor_name),
    professional_membership: optionalString(b.professional_membership),
    rpps_number: optionalString(b.rpps_number),
    adeli_number: optionalString(b.adeli_number),
    address: optionalString(b.address),
    mindray_characteristics: optionalString(b.mindray_characteristics),
  };

  for (const value of Object.values(fields)) {
    if (value === INVALID) {
      return { valid: false, error: "SETTINGS_FIELD_INVALID" };
    }
  }

  let mindrayServiceDate: string | null = null;
  if (
    b.mindray_service_date !== undefined &&
    b.mindray_service_date !== null &&
    b.mindray_service_date !== ""
  ) {
    if (
      typeof b.mindray_service_date !== "string" ||
      !isValidIsoDate(b.mindray_service_date)
    ) {
      return { valid: false, error: "MINDRAY_SERVICE_DATE_INVALID" };
    }
    mindrayServiceDate = b.mindray_service_date;
  }

  return {
    valid: true,
    data: {
      ...(fields as Record<
        Exclude<keyof UpdateClinicSettingsInput, "mindray_service_date">,
        string
      >),
      mindray_service_date: mindrayServiceDate,
    },
  };
}
