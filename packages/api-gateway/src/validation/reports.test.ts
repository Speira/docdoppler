import { describe, expect, it } from "vitest";
import {
  REPORT_LIST_DEFAULT_LIMIT,
  REPORT_LIST_MAX_LIMIT,
  validateCreateReport,
  validateReportListQuery,
} from "./reports.js";

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
        mi_arteres: {},
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

  describe("membres_inferieurs.arteres", () => {
    it("accepts a body with no arteres at all", () => {
      const result = validateCreateReport(valid);
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.mi_arteres).toEqual({});
    });

    it("keeps the entered spectre and vsm", () => {
      const result = validateCreateReport({
        ...valid,
        membres_inferieurs: {
          arteres: { droite: { afc: { vsm: 90, spectre: "triphasique" } } },
        },
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.mi_arteres.droite?.afc).toEqual({
          vsm: 90,
          spectre: "triphasique",
        });
      }
    });

    it("rejects a spectre outside the allowed set", () => {
      const result = validateCreateReport({
        ...valid,
        membres_inferieurs: {
          arteres: { droite: { afc: { spectre: "bruit" } } },
        },
      });
      expect(result).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
    });

    it("rejects an unknown artery or side key", () => {
      expect(
        validateCreateReport({
          ...valid,
          membres_inferieurs: { arteres: { droite: { carotide: { spectre: "" } } } },
        }),
      ).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
      expect(
        validateCreateReport({
          ...valid,
          membres_inferieurs: { arteres: { milieu: { afc: { spectre: "" } } } },
        }),
      ).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
    });

    it("rejects a non-numeric vsm", () => {
      expect(
        validateCreateReport({
          ...valid,
          membres_inferieurs: { arteres: { droite: { afc: { vsm: "90" } } } },
        }),
      ).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
    });

    it("rejects an array where the arteres object is expected", () => {
      expect(
        validateCreateReport({
          ...valid,
          membres_inferieurs: { arteres: [] },
        }),
      ).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
    });

    it("rejects an array where a side's arteries object is expected", () => {
      expect(
        validateCreateReport({
          ...valid,
          membres_inferieurs: { arteres: { droite: [] } },
        }),
      ).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
    });

    it("rejects an array where an artery entry is expected", () => {
      expect(
        validateCreateReport({
          ...valid,
          membres_inferieurs: { arteres: { droite: { afc: [] } } },
        }),
      ).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
      expect(
        validateCreateReport({
          ...valid,
          membres_inferieurs: { arteres: { droite: { afc: ["x", "y"] } } },
        }),
      ).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
    });

    it("still accepts null side and null entry values", () => {
      expect(
        validateCreateReport({
          ...valid,
          membres_inferieurs: { arteres: { droite: null } },
        }).valid,
      ).toBe(true);
      expect(
        validateCreateReport({
          ...valid,
          membres_inferieurs: { arteres: { droite: { afc: null } } },
        }).valid,
      ).toBe(true);
    });
  });
});

describe("validateReportListQuery", () => {
  it("defaults to the first page when nothing is asked for", () => {
    expect(validateReportListQuery({})).toEqual({
      valid: true,
      data: { limit: REPORT_LIST_DEFAULT_LIMIT, offset: 0 },
    });
    expect(validateReportListQuery(undefined).valid).toBe(true);
  });

  it("honours a well-formed limit and offset", () => {
    expect(validateReportListQuery({ limit: "5", offset: "10" })).toEqual({
      valid: true,
      data: { limit: 5, offset: 10 },
    });
  });

  it("treats an empty value as absent", () => {
    expect(validateReportListQuery({ limit: "", offset: "" })).toEqual({
      valid: true,
      data: { limit: REPORT_LIST_DEFAULT_LIMIT, offset: 0 },
    });
  });

  it("clamps an oversized limit instead of failing the request", () => {
    expect(validateReportListQuery({ limit: "5000" })).toEqual({
      valid: true,
      data: { limit: REPORT_LIST_MAX_LIMIT, offset: 0 },
    });
  });

  it("rejects a limit of zero, which could never make progress", () => {
    expect(validateReportListQuery({ limit: "0" })).toEqual({
      valid: false,
      error: "REPORT_PAGINATION_INVALID",
    });
  });

  it("accepts an offset of zero", () => {
    expect(validateReportListQuery({ offset: "0" }).valid).toBe(true);
  });

  it("rejects non-numeric, negative and fractional values", () => {
    for (const query of [
      { limit: "abc" },
      { limit: "-1" },
      { limit: "1.5" },
      { limit: "1e3" },
      { offset: "abc" },
      { offset: "-1" },
      { offset: "2.5" },
    ]) {
      expect(validateReportListQuery(query)).toEqual({
        valid: false,
        error: "REPORT_PAGINATION_INVALID",
      });
    }
  });

  it("rejects a repeated query param, which arrives as an array", () => {
    expect(validateReportListQuery({ limit: ["1", "2"] })).toEqual({
      valid: false,
      error: "REPORT_PAGINATION_INVALID",
    });
  });

  it("rejects an integer beyond safe precision", () => {
    expect(validateReportListQuery({ offset: "9007199254740993" })).toEqual({
      valid: false,
      error: "REPORT_PAGINATION_INVALID",
    });
  });
});
