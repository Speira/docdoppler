import { describe, expect, it } from "vitest";
import { createConnection } from "./index.js";
import { createPatient } from "./patients.js";
import { createReport, getReport, listReportsByPatient } from "./reports.js";
import type { CreateReportInput } from "./reports.js";

const FULL_INPUT: CreateReportInput = {
  doctor_name: "Dr. Martin",
  exam_date: "2026-08-13",
  carotide_text: "Plaque athéromateuse modérée",
  carotide_abnormal: true,
  artere_membre_sup_text: "",
  artere_membre_sup_abnormal: false,
  veine_membre_sup_text: "",
  veine_membre_sup_abnormal: false,
  artere_membre_inf_text: "",
  artere_membre_inf_abnormal: false,
  veine_membre_inf_text: "",
  veine_membre_inf_abnormal: false,
};

function makePatient(db: ReturnType<typeof createConnection>) {
  return createPatient(db, {
    first_name: "Jean",
    last_name: "Dupont",
    dob: "1958-03-12",
    sex: "M",
    exam_date: "2026-08-13",
  });
}

describe("reports data access", () => {
  it("creates a report and returns the full row", () => {
    const db = createConnection(":memory:");
    const patient = makePatient(db);
    const report = createReport(db, patient.id, FULL_INPUT);
    expect(report.id).toBeTypeOf("number");
    expect(report.patient_id).toBe(patient.id);
    expect(report.doctor_name).toBe("Dr. Martin");
    expect(report.carotide_text).toBe("Plaque athéromateuse modérée");
    expect(report.carotide_abnormal).toBe(1);
    expect(report.artere_membre_sup_abnormal).toBe(0);
    expect(report.created_at).toBeTruthy();
  });

  it("gets a report by id", () => {
    const db = createConnection(":memory:");
    const patient = makePatient(db);
    const created = createReport(db, patient.id, FULL_INPUT);
    const found = getReport(db, created.id);
    expect(found?.doctor_name).toBe("Dr. Martin");
  });

  it("returns undefined for an unknown report id", () => {
    const db = createConnection(":memory:");
    expect(getReport(db, 999)).toBeUndefined();
  });

  it("lists a patient's reports newest first", () => {
    const db = createConnection(":memory:");
    const patient = makePatient(db);
    const first = createReport(db, patient.id, FULL_INPUT);
    const second = createReport(db, patient.id, { ...FULL_INPUT, doctor_name: "Dr. Leroy" });
    const rows = listReportsByPatient(db, patient.id);
    expect(rows.map((r) => r.id)).toEqual([second.id, first.id]);
  });

  it("returns an empty array when a patient has no reports", () => {
    const db = createConnection(":memory:");
    const patient = makePatient(db);
    expect(listReportsByPatient(db, patient.id)).toEqual([]);
  });

  it("does not list another patient's reports", () => {
    const db = createConnection(":memory:");
    const patientA = makePatient(db);
    const patientB = createPatient(db, {
      first_name: "Alice",
      last_name: "Martin",
      dob: "1980-01-01",
      sex: "F",
      exam_date: "2026-08-13",
    });
    createReport(db, patientA.id, FULL_INPUT);
    expect(listReportsByPatient(db, patientB.id)).toEqual([]);
  });
});
