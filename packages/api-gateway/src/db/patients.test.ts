import { describe, expect, it } from "vitest";
import { createConnection } from "./index.js";
import {
  createPatient,
  getPatient,
  listPatients,
  updatePatient,
  createRiskFactorsEntry,
  getLatestRiskFactors,
  type CreatePatientInput,
  type RiskFactorField,
} from "./patients.js";

describe("patients data access", () => {
  it("creates a patient and returns the full row", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    expect(patient.id).toBeTypeOf("number");
    expect(patient.first_name).toBe("Jean");
    expect(patient.sex).toBe("M");
    expect(patient.created_at).toBeTruthy();
  });

  it("gets a patient by id", () => {
    const db = createConnection(":memory:");
    const created = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    const found = getPatient(db, created.id);
    expect(found?.first_name).toBe("Jean");
  });

  it("returns undefined for an unknown patient id", () => {
    const db = createConnection(":memory:");
    expect(getPatient(db, 999)).toBeUndefined();
  });

  it("lists patients ordered by last name then first name", () => {
    const db = createConnection(":memory:");
    createPatient(db, {
      first_name: "Bernard",
      last_name: "Martin",
      dob: "1970-01-01",
      sex: "M",
    });
    createPatient(db, {
      first_name: "Alice",
      last_name: "Durand",
      dob: "1980-01-01",
      sex: "F",
    });
    const rows = listPatients(db);
    expect(rows.map((r) => r.last_name)).toEqual(["Durand", "Martin"]);
  });

  it("updates only the provided fields", () => {
    const db = createConnection(":memory:");
    const created = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    const updated = updatePatient(db, created.id, { first_name: "Jeanne" });
    expect(updated?.first_name).toBe("Jeanne");
    expect(updated?.last_name).toBe("Dupont");
  });

  it("returns undefined when updating an unknown patient", () => {
    const db = createConnection(":memory:");
    expect(updatePatient(db, 999, { first_name: "Jeanne" })).toBeUndefined();
  });

  it("ignores unknown keys instead of interpolating them into SQL", () => {
    const db = createConnection(":memory:");
    const created = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    const maliciousInput = {
      first_name: "Jeanne",
      "not_a_column; DROP TABLE patients;--": "x",
    } as unknown as Partial<CreatePatientInput>;
    const updated = updatePatient(db, created.id, maliciousInput);
    expect(updated?.first_name).toBe("Jeanne");
    expect(updated?.last_name).toBe("Dupont");
    // The patients table must still exist and be queryable.
    expect(listPatients(db)).toHaveLength(1);
  });

  it("creates a risk-factors entry with defaults for omitted fields", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    const entry = createRiskFactorsEntry(db, patient.id, { diabetes: true });
    expect(entry.diabetes).toBe(1);
    expect(entry.hypertension).toBe(0);
    expect(entry.patient_id).toBe(patient.id);
  });

  it("accepts smoking as a risk-factors field", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    const entry = createRiskFactorsEntry(db, patient.id, { smoking: true });
    expect(entry.smoking).toBe(1);
    expect(entry.diabetes).toBe(0);
  });

  it("ignores unknown keys instead of interpolating them into SQL", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    const maliciousInput = {
      diabetes: true,
      "not_a_column; DROP TABLE risk_factors;--": true,
    } as unknown as Partial<Record<RiskFactorField, boolean>>;
    const entry = createRiskFactorsEntry(db, patient.id, maliciousInput);
    expect(entry.diabetes).toBe(1);
    expect(entry.patient_id).toBe(patient.id);
    // The risk_factors table must still exist and be queryable.
    expect(getLatestRiskFactors(db, patient.id)?.id).toBe(entry.id);
  });

  it("returns the most recently created risk-factors entry", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    createRiskFactorsEntry(db, patient.id, { diabetes: true });
    const latest = createRiskFactorsEntry(db, patient.id, {
      diabetes: false,
      hypertension: true,
    });
    const result = getLatestRiskFactors(db, patient.id);
    expect(result?.id).toBe(latest.id);
    expect(result?.hypertension).toBe(1);
  });

  it("returns undefined when a patient has no risk-factors entries", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    expect(getLatestRiskFactors(db, patient.id)).toBeUndefined();
  });
});
