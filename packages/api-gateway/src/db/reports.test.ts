import { describe, expect, it } from "vitest";
import { createConnection } from "./index.js";
import { createPatient } from "./patients.js";
import { createReport, getReport, listReportsByPatient } from "./reports.js";
import type { CreateReportInput } from "./reports.js";

const MINIMAL_INPUT: CreateReportInput = {
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
  conclusion: "",
};

const FULL_INPUT: CreateReportInput = {
  ...MINIMAL_INPUT,
  correspondant_dossier: "Dr. Petit",
  indication: "Bilan vasculaire (tabagisme, hypertension)",
  tsa_imt_droit: 0.62,
  tsa_imt_gauche: 0.64,
  tsa_aci_acc_ratio_droit: 0.81,
  tsa_aci_acc_ratio_gauche: 0.81,
  tsa_findings_text: "Plaque athéromateuse modérée",
  aorte_diametre: "14 à 18 mm",
  aorte_anevrisme: true,
  aorte_anevrisme_diametre_mm: 34,
  aorte_findings_text: "Anévrisme fusiforme sous-rénal",
  mi_pression_cheville_droite: 120,
  mi_pression_cheville_gauche: 130,
  mi_pression_bras_droit: 130,
  mi_pression_bras_gauche: 140,
  mi_findings_text: "Athéromatose diffuse",
  conclusion: "Athéromatose polyvasculaire.",
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
    expect(report.correspondant_dossier).toBe("Dr. Petit");
    expect(report.tsa_findings_text).toBe("Plaque athéromateuse modérée");
    expect(report.aorte_anevrisme).toBe(1);
    expect(report.aorte_anevrisme_diametre_mm).toBe(34);
    expect(report.created_at).toBeTruthy();
  });

  it("computes IPS as ankle pressure / higher of the two brachial pressures", () => {
    const db = createConnection(":memory:");
    const patient = makePatient(db);
    // Worked example confirmed by the doctor: bras droit 130, bras gauche 140
    // -> reference 140 for both sides; cheville droite 120 -> 0,86; cheville
    // gauche 130 -> 0,93.
    const report = createReport(db, patient.id, FULL_INPUT);
    expect(report.mi_ips_droit).toBe(0.86);
    expect(report.mi_ips_gauche).toBe(0.93);
  });

  it("leaves IPS null when any of the four pressures is missing", () => {
    const db = createConnection(":memory:");
    const patient = makePatient(db);
    const report = createReport(db, patient.id, {
      ...MINIMAL_INPUT,
      mi_pression_cheville_droite: 120,
    });
    expect(report.mi_ips_droit).toBeNull();
    expect(report.mi_ips_gauche).toBeNull();
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
    const first = createReport(db, patient.id, MINIMAL_INPUT);
    const second = createReport(db, patient.id, {
      ...MINIMAL_INPUT,
      doctor_name: "Dr. Leroy",
    });
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
    createReport(db, patientA.id, MINIMAL_INPUT);
    expect(listReportsByPatient(db, patientB.id)).toEqual([]);
  });
});
