import { describe, expect, it } from "vitest";
import { VESSEL_KEYS, VESSEL_LABELS, RISK_FACTOR_KEYS, RISK_FACTOR_LABELS } from "./index.js";

describe("shared labels", () => {
  it("has exactly 5 vessel keys, each with a non-empty French label", () => {
    expect(VESSEL_KEYS).toHaveLength(5);
    for (const key of VESSEL_KEYS) {
      expect(VESSEL_LABELS[key]).toBeTruthy();
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
});
