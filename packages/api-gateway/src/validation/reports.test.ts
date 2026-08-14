import { describe, expect, it } from "vitest";
import { validateCreateReport } from "./reports.js";

describe("validateCreateReport", () => {
  const valid = { doctor_name: "Dr. Martin", exam_date: "2026-08-13" };

  it("accepts the minimal valid payload, defaulting every vessel to empty/not-abnormal", () => {
    const result = validateCreateReport(valid);
    expect(result).toEqual({
      valid: true,
      data: {
        doctor_name: "Dr. Martin",
        exam_date: "2026-08-13",
        carotide_text: "",
        carotide_abnormal: false,
        artere_membre_sup_text: "",
        artere_membre_sup_abnormal: false,
        veine_membre_sup_text: "",
        veine_membre_sup_abnormal: false,
        artere_membre_inf_text: "",
        artere_membre_inf_abnormal: false,
        veine_membre_inf_text: "",
        veine_membre_inf_abnormal: false,
      },
    });
  });

  it("accepts a partial vessel payload (only carotide filled in)", () => {
    const result = validateCreateReport({
      ...valid,
      carotide: { text: "Plaque modérée", abnormal: true },
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.carotide_text).toBe("Plaque modérée");
      expect(result.data.carotide_abnormal).toBe(true);
      expect(result.data.veine_membre_inf_text).toBe("");
    }
  });

  it("rejects a missing doctor_name", () => {
    expect(validateCreateReport({ exam_date: "2026-08-13" })).toEqual({
      valid: false,
      error: "DOCTOR_NAME_REQUIRED",
    });
  });

  it("rejects a blank doctor_name", () => {
    expect(validateCreateReport({ ...valid, doctor_name: "   " })).toEqual({
      valid: false,
      error: "DOCTOR_NAME_REQUIRED",
    });
  });

  it("rejects a missing exam_date", () => {
    expect(validateCreateReport({ doctor_name: "Dr. Martin" })).toEqual({
      valid: false,
      error: "EXAM_DATE_REQUIRED",
    });
  });

  it("rejects a malformed exam_date", () => {
    expect(validateCreateReport({ ...valid, exam_date: "13/08/2026" })).toEqual({
      valid: false,
      error: "EXAM_DATE_INVALID",
    });
  });

  it("rejects an impossible calendar exam_date", () => {
    expect(validateCreateReport({ ...valid, exam_date: "2026-02-30" })).toEqual({
      valid: false,
      error: "EXAM_DATE_INVALID",
    });
  });

  it("rejects a non-boolean abnormal flag", () => {
    const result = validateCreateReport({
      ...valid,
      carotide: { abnormal: "yes" },
    });
    expect(result).toEqual({ valid: false, error: "FINDING_ABNORMAL_VALUE_INVALID" });
  });

  it("rejects a non-string finding text", () => {
    const result = validateCreateReport({
      ...valid,
      carotide: { text: 123 },
    });
    expect(result).toEqual({ valid: false, error: "FINDING_ABNORMAL_VALUE_INVALID" });
  });
});
