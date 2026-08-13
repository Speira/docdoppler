import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  createConnection,
  ensureExamDateColumn,
  ensureAccessionNumberColumn,
} from "./index.js";
import { createPatient } from "./patients.js";

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

  it("rejects an invalid smoking value", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid: patientId } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    expect(() =>
      db
        .prepare(
          "INSERT INTO risk_factors (patient_id, smoking) VALUES (?, ?)",
        )
        .run(patientId, 2),
    ).toThrow(/CHECK constraint failed/);
  });

  it("defaults smoking to 0 and accepts 1", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid: patientId } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    const defaulted = db
      .prepare("INSERT INTO risk_factors (patient_id) VALUES (?)")
      .run(patientId);
    const defaultedRow = db
      .prepare("SELECT smoking FROM risk_factors WHERE id = ?")
      .get(defaulted.lastInsertRowid) as { smoking: number };
    expect(defaultedRow.smoking).toBe(0);

    const smoker = db
      .prepare("INSERT INTO risk_factors (patient_id, smoking) VALUES (?, ?)")
      .run(patientId, 1);
    const smokerRow = db
      .prepare("SELECT smoking FROM risk_factors WHERE id = ?")
      .get(smoker.lastInsertRowid) as { smoking: number };
    expect(smokerRow.smoking).toBe(1);
  });

  it("creates fresh patients rows with exam_date defaulted to today", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    const patient = db
      .prepare("SELECT exam_date FROM patients WHERE id = ?")
      .get(lastInsertRowid) as { exam_date: string };
    const today = new Date().toISOString().slice(0, 10);
    expect(patient.exam_date).toBe(today);
  });

  it("adds an exam_date column to a pre-existing patients table lacking it", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        dob TEXT NOT NULL,
        sex TEXT NOT NULL
      );
    `);
    db.prepare(
      "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
    ).run("Jean", "Dupont", "1958-03-12", "M");

    ensureExamDateColumn(db);

    const columns = db
      .prepare("PRAGMA table_info(patients)")
      .all()
      .map((c) => (c as { name: string }).name);
    expect(columns).toContain("exam_date");

    const today = new Date().toISOString().slice(0, 10);
    const backfilled = db
      .prepare("SELECT exam_date FROM patients")
      .get() as { exam_date: string };
    expect(backfilled.exam_date).toBe(today);
  });

  it("is a no-op when the patients table already has exam_date", () => {
    const db = createConnection(":memory:");
    expect(() => ensureExamDateColumn(db)).not.toThrow();
  });

  it("does not overwrite an existing exam_date when called again", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex, exam_date) VALUES (?, ?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M", "2020-01-01");

    ensureExamDateColumn(db);

    const patient = db
      .prepare("SELECT exam_date FROM patients WHERE id = ?")
      .get(lastInsertRowid) as { exam_date: string };
    expect(patient.exam_date).toBe("2020-01-01");
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

  it("adds an accession_number column to a pre-existing patients table lacking it, backfilling per exam_date", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        dob TEXT NOT NULL,
        sex TEXT NOT NULL,
        exam_date TEXT NOT NULL
      );
    `);
    const first = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex, exam_date) VALUES (?, ?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M", "2026-08-12");
    const second = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex, exam_date) VALUES (?, ?, ?, ?, ?)",
      )
      .run("Alice", "Martin", "1980-01-01", "F", "2026-08-12");

    ensureAccessionNumberColumn(db);

    const columns = db
      .prepare("PRAGMA table_info(patients)")
      .all()
      .map((c) => (c as { name: string }).name);
    expect(columns).toContain("accession_number");

    const firstRow = db
      .prepare("SELECT accession_number FROM patients WHERE id = ?")
      .get(first.lastInsertRowid) as { accession_number: string };
    const secondRow = db
      .prepare("SELECT accession_number FROM patients WHERE id = ?")
      .get(second.lastInsertRowid) as { accession_number: string };
    expect(firstRow.accession_number).toBe("20260812-001");
    expect(secondRow.accession_number).toBe("20260812-002");
  });

  it("is a no-op when the patients table already has accession_number", () => {
    const db = createConnection(":memory:");
    expect(() => ensureAccessionNumberColumn(db)).not.toThrow();
  });

  it("does not overwrite an existing accession_number when called again", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    ensureAccessionNumberColumn(db);
    const row = db
      .prepare("SELECT accession_number FROM patients WHERE id = ?")
      .get(patient.id) as { accession_number: string };
    expect(row.accession_number).toBe("20260812-001");
  });

  it("creates the reports table", () => {
    const db = createConnection(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(tables).toContain("reports");
  });

  it("rejects an invalid abnormal flag on a report", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid: patientId } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    expect(() =>
      db
        .prepare(
          "INSERT INTO reports (patient_id, doctor_name, exam_date, carotide_abnormal) VALUES (?, ?, ?, ?)",
        )
        .run(patientId, "Dr. Martin", "2026-08-13", 2),
    ).toThrow(/CHECK constraint failed/);
  });

  it("defaults report vessel columns to empty text and not-abnormal", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid: patientId } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO reports (patient_id, doctor_name, exam_date) VALUES (?, ?, ?)",
      )
      .run(patientId, "Dr. Martin", "2026-08-13");
    const report = db
      .prepare("SELECT * FROM reports WHERE id = ?")
      .get(lastInsertRowid) as Record<string, unknown>;
    expect(report.carotide_text).toBe("");
    expect(report.carotide_abnormal).toBe(0);
    expect(report.veine_membre_inf_text).toBe("");
    expect(report.veine_membre_inf_abnormal).toBe(0);
    expect(report.created_at).toBeTruthy();
  });

  it("cascades delete from patients to reports", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid: patientId } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    db.prepare(
      "INSERT INTO reports (patient_id, doctor_name, exam_date) VALUES (?, ?, ?)",
    ).run(patientId, "Dr. Martin", "2026-08-13");
    db.prepare("DELETE FROM patients WHERE id = ?").run(patientId);
    const rows = db.prepare("SELECT * FROM reports WHERE patient_id = ?").all(patientId);
    expect(rows).toHaveLength(0);
  });
});
