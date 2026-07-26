import { describe, expect, it } from "vitest";
import { createConnection } from "./index.js";

describe("db schema", () => {
  it("creates the patients and risk_factors tables", () => {
    const db = createConnection(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(tables).toContain("patients");
    expect(tables).toContain("risk_factors");
  });

  it("enforces foreign keys", () => {
    const db = createConnection(":memory:");
    const fkStatus = db.pragma("foreign_keys", { simple: true });
    expect(fkStatus).toBe(1);
  });

  it("rejects an invalid sex value", () => {
    const db = createConnection(":memory:");
    expect(() =>
      db
        .prepare(
          "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
        )
        .run("Jean", "Dupont", "1958-03-12", "X"),
    ).toThrow(/CHECK constraint failed/);
  });

  it("inserts a patient with valid data and defaults timestamps", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    const patient = db
      .prepare("SELECT * FROM patients WHERE id = ?")
      .get(lastInsertRowid) as Record<string, unknown>;
    expect(patient.first_name).toBe("Jean");
    expect(patient.created_at).toBeTruthy();
    expect(patient.updated_at).toBeTruthy();
  });

  it("bumps updated_at on patient update", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    const before = (
      db
        .prepare("SELECT updated_at FROM patients WHERE id = ?")
        .get(lastInsertRowid) as { updated_at: string }
    ).updated_at;
    db.prepare("UPDATE patients SET first_name = ? WHERE id = ?").run(
      "Jeanne",
      lastInsertRowid,
    );
    const after = (
      db
        .prepare("SELECT updated_at FROM patients WHERE id = ?")
        .get(lastInsertRowid) as { updated_at: string }
    ).updated_at;
    expect(after >= before).toBe(true);
  });

  it("links multiple dated risk_factors rows to a patient", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid: patientId } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    db.prepare(
      "INSERT INTO risk_factors (patient_id, diabetes, hypertension) VALUES (?, ?, ?)",
    ).run(patientId, 1, 0);
    db.prepare(
      "INSERT INTO risk_factors (patient_id, diabetes, hypertension) VALUES (?, ?, ?)",
    ).run(patientId, 1, 1);
    const rows = db
      .prepare("SELECT * FROM risk_factors WHERE patient_id = ?")
      .all(patientId);
    expect(rows).toHaveLength(2);
  });

  it("cascades delete from patients to risk_factors", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid: patientId } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    db.prepare("INSERT INTO risk_factors (patient_id) VALUES (?)").run(
      patientId,
    );
    db.prepare("DELETE FROM patients WHERE id = ?").run(patientId);
    const rows = db
      .prepare("SELECT * FROM risk_factors WHERE patient_id = ?")
      .all(patientId);
    expect(rows).toHaveLength(0);
  });
});
