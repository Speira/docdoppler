import { describe, expect, it } from "vitest";
import { validateUpdateSettings } from "./settings.js";

describe("validateUpdateSettings", () => {
  it("accepts a fully-filled body", () => {
    const result = validateUpdateSettings({
      doctor_name: "Dr Pembele",
      professional_membership: "Membre de la société française de radiologie",
      rpps_number: "12345678901",
      adeli_number: "939912345",
      address: "6 avenue Yuri Gagarine 93270 Sevran",
      mindray_service_date: "2020-03-01",
      mindray_characteristics: "Mindray Resona 7, sonde linéaire L14-5",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.doctor_name).toBe("Dr Pembele");
      expect(result.data.mindray_service_date).toBe("2020-03-01");
    }
  });

  it("defaults missing optional string fields to empty strings", () => {
    const result = validateUpdateSettings({});
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.doctor_name).toBe("");
      expect(result.data.mindray_characteristics).toBe("");
      expect(result.data.mindray_service_date).toBeNull();
    }
  });

  it("rejects a non-string field", () => {
    const result = validateUpdateSettings({ doctor_name: 42 });
    expect(result).toEqual({ valid: false, error: "SETTINGS_FIELD_INVALID" });
  });

  it("rejects a malformed mindray_service_date", () => {
    const result = validateUpdateSettings({ mindray_service_date: "01/03/2020" });
    expect(result).toEqual({
      valid: false,
      error: "MINDRAY_SERVICE_DATE_INVALID",
    });
  });

  it("accepts an empty string mindray_service_date as null", () => {
    const result = validateUpdateSettings({ mindray_service_date: "" });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.mindray_service_date).toBeNull();
    }
  });
});
