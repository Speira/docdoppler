import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { buildReportPdf } from "./report-pdf.js";
import type { PatientRow, RiskFactorsRow } from "../db/patients.js";
import type { ReportRow } from "../db/reports.js";

function makePatient(overrides: Partial<PatientRow> = {}): PatientRow {
  return {
    id: 1,
    first_name: "Jean",
    last_name: "Dupont",
    dob: "1958-03-12",
    sex: "M",
    exam_date: "2026-08-13",
    accession_number: "20260813-001",
    created_at: "2026-08-13 08:00:00",
    updated_at: "2026-08-13 08:00:00",
    ...overrides,
  };
}

function makeReport(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: 1,
    patient_id: 1,
    doctor_name: "Dr. Martin",
    exam_date: "2026-08-13",
    carotide_text: "",
    carotide_abnormal: 0,
    artere_membre_sup_text: "",
    artere_membre_sup_abnormal: 0,
    veine_membre_sup_text: "",
    veine_membre_sup_abnormal: 0,
    artere_membre_inf_text: "",
    artere_membre_inf_abnormal: 0,
    veine_membre_inf_text: "",
    veine_membre_inf_abnormal: 0,
    created_at: "2026-08-13 08:00:00",
    ...overrides,
  };
}

function makeRiskFactors(overrides: Partial<RiskFactorsRow> = {}): RiskFactorsRow {
  return {
    id: 1,
    patient_id: 1,
    diabetes: 0,
    hypertension: 0,
    cholesterol: 0,
    obesity: 0,
    vertigo: 0,
    carotid_bruit: 0,
    avc: 0,
    smoking: 0,
    created_at: "2026-08-13 08:00:00",
    updated_at: "2026-08-13 08:00:00",
    ...overrides,
  };
}

async function parsePdf(bytes: Uint8Array): Promise<{ text: string; numpages: number }> {
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text, numpages: totalPages };
}

describe("buildReportPdf", () => {
  it("produces a single-page PDF containing the patient identity, doctor, and exam date", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport());
    const parsed = await parsePdf(bytes);
    expect(parsed.numpages).toBe(1);
    expect(parsed.text).toContain("DUPONT Jean");
    expect(parsed.text).toContain("Dr. Martin");
    expect(parsed.text).toContain("2026-08-13");
  });

  it("includes only the active risk factors, by French label", async () => {
    const riskFactors = makeRiskFactors({ diabetes: 1, smoking: 1 });
    const bytes = await buildReportPdf(makePatient(), riskFactors, makeReport());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Diabète");
    expect(parsed.text).toContain("Tabagisme");
    expect(parsed.text).not.toContain("Hypertension");
  });

  it("says no risk factors were recorded when there are none", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Aucun antécédent renseigné.");
  });

  it("flags an abnormal vessel finding and includes its free text", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        carotide_text: "Plaque athéromateuse significative",
        carotide_abnormal: 1,
      }),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Carotide");
    expect(parsed.text).toContain("anormal");
    expect(parsed.text).toContain("Plaque athéromateuse significative");
  });

  it("says no findings were recorded when every vessel is empty", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Aucune constatation renseignée.");
  });
});
