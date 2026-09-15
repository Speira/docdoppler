import { describe, expect, it } from "vitest";
import {
  REPORT_SECTION_KEYS,
  REPORT_SECTION_LABELS,
  REPORT_FIELD_LABELS,
  RISK_FACTOR_KEYS,
  RISK_FACTOR_LABELS,
  formatRiskFactorList,
} from "./index.js";

describe("shared labels", () => {
  it("has exactly 3 report section keys (arterial-only scope), each with a non-empty French label", () => {
    expect(REPORT_SECTION_KEYS).toEqual(["tsa", "aorte_abdominale", "membres_inferieurs"]);
    for (const key of REPORT_SECTION_KEYS) {
      expect(REPORT_SECTION_LABELS[key]).toBeTruthy();
    }
  });

  it("has a non-empty French label for every report field", () => {
    for (const label of Object.values(REPORT_FIELD_LABELS)) {
      expect(label).toBeTruthy();
    }
  });

  it("has exactly 8 risk-factor keys matching the risk_factors schema, each with a label", () => {
    expect(RISK_FACTOR_KEYS).toEqual([
      "diabetes",
      "hypertension",
      "cholesterol",
      "obesity",
      "vertigo",
      "carotid_bruit",
      "avc",
      "smoking",
    ]);
    for (const key of RISK_FACTOR_KEYS) {
      expect(RISK_FACTOR_LABELS[key]).toBeTruthy();
    }
  });

  it("labels hypertension as HTA and cholesterol as Dyslipidémie, per doctor feedback", () => {
    expect(RISK_FACTOR_LABELS.hypertension).toBe("HTA");
    expect(RISK_FACTOR_LABELS.cholesterol).toBe("Dyslipidémie");
  });
});

describe("formatRiskFactorList", () => {
  it("joins the set factors' labels in form order, whatever order they are given in", () => {
    expect(formatRiskFactorList({ smoking: 1, hypertension: 1, diabetes: 1 })).toBe(
      "Diabète, HTA, Tabagisme",
    );
  });

  it("skips factors stored as 0", () => {
    expect(formatRiskFactorList({ diabetes: 0, avc: 1 })).toBe("AVC");
  });

  it("returns null when nothing is set, leaving the fallback to the caller", () => {
    expect(formatRiskFactorList(undefined)).toBeNull();
    expect(formatRiskFactorList({})).toBeNull();
    expect(formatRiskFactorList({ diabetes: 0, smoking: 0 })).toBeNull();
  });
});
