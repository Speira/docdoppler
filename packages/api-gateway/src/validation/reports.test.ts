import { describe, expect, it } from "vitest";
import { validateCreateReport } from "./reports.js";

describe("validateCreateReport", () => {
  const valid = { doctor_name: "Dr. Martin", exam_date: "2026-08-13" };

  it("accepts the minimal valid payload, defaulting every optional field to empty/null", () => {
    const result = validateCreateReport(valid);
    expect(result).toEqual({
      valid: true,
      data: {
        doctor_name: "Dr. Martin",
        exam_date: "2026-08-13",
        correspondant_dossier: "",
        indication: "",
        tsa_imt_droit: null,
        tsa_imt_gauche: null,
        tsa_aci_acc_ratio_droit: null,
        tsa_aci_acc_ratio_gauche: null,
        tsa_findings_text: "",
        aorte_diametre: "",
        aorte_anevrisme: false,
        aorte_anevrisme_diametre_mm: null,
        aorte_findings_text: "",
        mi_pression_cheville_droite: null,
        mi_pression_cheville_gauche: null,
        mi_pression_bras_droit: null,
        mi_pression_bras_gauche: null,
        mi_findings_text: "",
        conclusion: "",
      },
    });
  });

  it("accepts a partial payload (only TSA filled in)", () => {
    const result = validateCreateReport({
      ...valid,
      tsa: { findings_text: "Plaque modérée", imt_droit: 0.62 },
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.tsa_findings_text).toBe("Plaque modérée");
      expect(result.data.tsa_imt_droit).toBe(0.62);
      expect(result.data.mi_findings_text).toBe("");
    }
  });

  it("accepts the four IPS pressure inputs and the aneurysm fields", () => {
    const result = validateCreateReport({
      ...valid,
      membres_inferieurs: {
        pression_cheville_droite: 120,
        pression_cheville_gauche: 130,
        pression_bras_droit: 130,
        pression_bras_gauche: 140,
      },
      aorte_abdominale: { anevrisme: true, anevrisme_diametre_mm: 34 },
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.mi_pression_cheville_droite).toBe(120);
      expect(result.data.aorte_anevrisme).toBe(true);
      expect(result.data.aorte_anevrisme_diametre_mm).toBe(34);
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

  it("rejects a non-numeric IMT value", () => {
    const result = validateCreateReport({
      ...valid,
      tsa: { imt_droit: "élevé" },
    });
    expect(result).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
  });

  it("rejects a non-string findings text", () => {
    const result = validateCreateReport({
      ...valid,
      tsa: { findings_text: 123 },
    });
    expect(result).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
  });

  it("rejects a non-boolean anevrisme flag", () => {
    const result = validateCreateReport({
      ...valid,
      aorte_abdominale: { anevrisme: "yes" },
    });
    expect(result).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
  });
});
