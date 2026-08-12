import { describe, expect, it } from "vitest";
import { createConnection } from "./index.js";
import {
  createPatient,
  getPatient,
  listPatients,
  listPatientsByExamDate,
  updatePatient,
  deletePatient,
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
      exam_date: "2026-09-01",
    });
    expect(patient.id).toBeTypeOf("number");
    expect(patient.first_name).toBe("Jean");
    expect(patient.sex).toBe("M");
    expect(patient.exam_date).toBe("2026-09-01");
    expect(patient.created_at).toBeTruthy();
  });

  it("updates exam_date", () => {
    const db = createConnection(":memory:");
    const created = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-09-01",
    });
    const updated = updatePatient(db, created.id, {
      exam_date: "2026-10-15",
    });
    expect(updated?.exam_date).toBe("2026-10-15");
  });

  it("gets a patient by id", () => {
    const db = createConnection(":memory:");
    const created = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-01-15",
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
      exam_date: "2026-01-15",
    });
    createPatient(db, {
      first_name: "Alice",
      last_name: "Durand",
      dob: "1980-01-01",
      sex: "F",
      exam_date: "2026-01-15",
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
      exam_date: "2026-01-15",
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
      exam_date: "2026-01-15",
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
      exam_date: "2026-01-15",
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
      exam_date: "2026-01-15",
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
      exam_date: "2026-01-15",
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
      exam_date: "2026-01-15",
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
      exam_date: "2026-01-15",
    });
    expect(getLatestRiskFactors(db, patient.id)).toBeUndefined();
  });

  it("deletes a patient", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-01-15",
    });
    expect(deletePatient(db, patient.id)).toBe(true);
    expect(getPatient(db, patient.id)).toBeUndefined();
  });

  it("returns false when deleting an unknown patient", () => {
    const db = createConnection(":memory:");
    expect(deletePatient(db, 999)).toBe(false);
  });

  it("generates an accession_number in YYYYMMDD-NNN format on creation", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    expect(patient.accession_number).toBe("20260812-001");
  });

  it("increments the accession_number sequence for patients sharing an exam_date", () => {
    const db = createConnection(":memory:");
    createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    const second = createPatient(db, {
      first_name: "Alice",
      last_name: "Martin",
      dob: "1980-01-01",
      sex: "F",
      exam_date: "2026-08-12",
    });
    expect(second.accession_number).toBe("20260812-002");
  });

  it("resets the accession_number sequence for a different exam_date", () => {
    const db = createConnection(":memory:");
    createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    const other = createPatient(db, {
      first_name: "Alice",
      last_name: "Martin",
      dob: "1980-01-01",
      sex: "F",
      exam_date: "2026-08-13",
    });
    expect(other.accession_number).toBe("20260813-001");
  });
});

describe("listPatientsByExamDate", () => {
  it("returns only patients matching the given exam_date, ordered by created_at", () => {
    const db = createConnection(":memory:");
    createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    createPatient(db, {
      first_name: "Other",
      last_name: "Day",
      dob: "1990-01-01",
      sex: "F",
      exam_date: "2026-08-13",
    });
    const second = createPatient(db, {
      first_name: "Alice",
      last_name: "Martin",
      dob: "1980-01-01",
      sex: "F",
      exam_date: "2026-08-12",
    });
    const rows = listPatientsByExamDate(db, "2026-08-12");
    expect(rows.map((r) => r.last_name)).toEqual(["Dupont", "Martin"]);
    expect(rows[1].id).toBe(second.id);
  });

  it("returns an empty array when no patients match", () => {
    const db = createConnection(":memory:");
    expect(listPatientsByExamDate(db, "2026-08-12")).toEqual([]);
  });
});
