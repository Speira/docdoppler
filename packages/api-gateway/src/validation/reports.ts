import { isValidIsoDate } from "./patients.js";
import type { CreateReportInput } from "../db/reports.js";
import {
  MI_ARTERY_KEYS,
  MI_SIDES,
  SPECTRE_OPTIONS,
  type MiArteryKey,
  type MiSide,
  type Spectre,
} from "@speira-docdoppler/shared-labels";
import type { ArteriesBySide } from "../db/arteries.js";

export type ReportValidationErrorCode =
  | "DOCTOR_NAME_REQUIRED"
  | "EXAM_DATE_REQUIRED"
  | "EXAM_DATE_INVALID"
  | "REPORT_FIELD_INVALID"
  | "REPORT_PAGINATION_INVALID";

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

function optionalSpectre(value: unknown): Spectre | "" | typeof INVALID {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return INVALID;
  return (SPECTRE_OPTIONS as readonly string[]).includes(value)
    ? (value as Spectre)
    : INVALID;
}

function validateArteries(value: unknown): ArteriesBySide | typeof INVALID {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return INVALID;
  const bySideInput = value as Record<string, unknown>;
  const arteres: ArteriesBySide = {};

  for (const sideKey of Object.keys(bySideInput)) {
    if (!(MI_SIDES as readonly string[]).includes(sideKey)) return INVALID;
    const side = sideKey as MiSide;
    const sideValue = bySideInput[sideKey];
    if (Array.isArray(sideValue)) return INVALID;
    const arteriesInput = (sideValue ?? {}) as Record<string, unknown>;
    if (typeof arteriesInput !== "object") return INVALID;

    for (const arteryKey of Object.keys(arteriesInput)) {
      if (!(MI_ARTERY_KEYS as readonly string[]).includes(arteryKey)) return INVALID;
      const artery = arteryKey as MiArteryKey;
      const entryValue = arteriesInput[arteryKey];
      if (Array.isArray(entryValue)) return INVALID;
      const entry = (entryValue ?? {}) as Record<string, unknown>;
      if (typeof entry !== "object") return INVALID;

      const vsm = optionalNumber(entry.vsm);
      const spectre = optionalSpectre(entry.spectre);
      if (vsm === INVALID || spectre === INVALID) return INVALID;

      (arteres[side] ??= {})[artery] = { vsm, spectre };
    }
  }
  return arteres;
}

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
    mi_arteres: validateArteries(mi.arteres),
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

/** How many reports a list request returns when it doesn't say. */
export const REPORT_LIST_DEFAULT_LIMIT = 10;

/** The most any single request can pull, however large a limit it asks for. */
export const REPORT_LIST_MAX_LIMIT = 100;

export interface ReportListQuery {
  limit: number;
  offset: number;
}

const WHOLE_NUMBER_PATTERN = /^\d+$/;

/**
 * Malformed and oversized are different failures, so they get different
 * answers: `?limit=abc` is a client bug and is rejected, while `?limit=5000`
 * is a legitimate ask the server declines to fully honour and is clamped to
 * `REPORT_LIST_MAX_LIMIT`. The response echoes the limit actually applied so
 * the caller can see which it got.
 */
function parseWholeNumber(value: unknown): number | undefined | typeof INVALID {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") return INVALID;
  const trimmed = value.trim();
  if (!WHOLE_NUMBER_PATTERN.test(trimmed)) return INVALID;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : INVALID;
}

export function validateReportListQuery(
  query: unknown,
): ReportValidationResult<ReportListQuery> {
  const q = (query ?? {}) as Record<string, unknown>;

  const rawLimit = parseWholeNumber(q.limit);
  const rawOffset = parseWholeNumber(q.offset);
  if (rawLimit === INVALID || rawOffset === INVALID) {
    return { valid: false, error: "REPORT_PAGINATION_INVALID" };
  }
  // A page of zero rows is a request that can never make progress, so it is
  // treated as malformed rather than clamped up to something the caller
  // didn't ask for.
  if (rawLimit === 0) {
    return { valid: false, error: "REPORT_PAGINATION_INVALID" };
  }

  return {
    valid: true,
    data: {
      limit: Math.min(rawLimit ?? REPORT_LIST_DEFAULT_LIMIT, REPORT_LIST_MAX_LIMIT),
      offset: rawOffset ?? 0,
    },
  };
}
