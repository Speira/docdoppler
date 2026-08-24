import { describe, expect, it } from "vitest";
import { createConnection } from "./index.js";
import { getSettings, updateSettings } from "./settings.js";

describe("clinic settings data access", () => {
  it("returns an empty singleton row when no settings have been saved yet", () => {
    const db = createConnection(":memory:");
    const settings = getSettings(db);
    expect(settings.id).toBe(1);
    expect(settings.doctor_name).toBe("");
    expect(settings.professional_membership).toBe("");
    expect(settings.rpps_number).toBe("");
    expect(settings.adeli_number).toBe("");
    expect(settings.address).toBe("");
    expect(settings.mindray_service_date).toBeNull();
    expect(settings.mindray_characteristics).toBe("");
  });

  it("updates the singleton row and returns it", () => {
    const db = createConnection(":memory:");
    const updated = updateSettings(db, {
      doctor_name: "Dr Pembele",
      professional_membership: "Membre de la société française de radiologie",
      rpps_number: "12345678901",
      adeli_number: "939912345",
      address: "6 avenue Yuri Gagarine 93270 Sevran",
      mindray_service_date: "2020-03-01",
      mindray_characteristics: "Mindray Resona 7, sonde linéaire L14-5",
    });
    expect(updated.doctor_name).toBe("Dr Pembele");
    expect(updated.mindray_service_date).toBe("2020-03-01");

    const fetched = getSettings(db);
    expect(fetched).toEqual(updated);
  });

  it("overwrites previous values instead of creating a second row", () => {
    const db = createConnection(":memory:");
    updateSettings(db, {
      doctor_name: "Dr Pembele",
      professional_membership: "",
      rpps_number: "",
      adeli_number: "",
      address: "",
      mindray_service_date: null,
      mindray_characteristics: "",
    });
    updateSettings(db, {
      doctor_name: "Dr Pembele-Nzuzi",
      professional_membership: "",
      rpps_number: "",
      adeli_number: "",
      address: "",
      mindray_service_date: null,
      mindray_characteristics: "",
    });

    const rowCount = db
      .prepare("SELECT COUNT(*) as count FROM clinic_settings")
      .get() as { count: number };
    expect(rowCount.count).toBe(1);
    expect(getSettings(db).doctor_name).toBe("Dr Pembele-Nzuzi");
  });
});
