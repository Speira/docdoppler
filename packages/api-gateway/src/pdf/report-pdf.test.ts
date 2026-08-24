import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { buildReportPdf } from "./report-pdf.js";
import type { PatientRow, RiskFactorsRow } from "../db/patients.js";
import type { ReportRow } from "../db/reports.js";
import type { ClinicSettingsRow } from "../db/settings.js";

function makeSettings(overrides: Partial<ClinicSettingsRow> = {}): ClinicSettingsRow {
  return {
    id: 1,
    doctor_name: "",
    professional_membership: "",
    rpps_number: "",
    adeli_number: "",
    address: "",
    mindray_service_date: null,
    mindray_characteristics: "",
    updated_at: "2026-08-13 08:00:00",
    ...overrides,
  };
}

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
    correspondant_dossier: "",
    indication: "",
    tsa_imt_droit: null,
    tsa_imt_gauche: null,
    tsa_aci_acc_ratio_droit: null,
    tsa_aci_acc_ratio_gauche: null,
    tsa_findings_text: "",
    aorte_diametre: "",
    aorte_anevrisme: 0,
    aorte_anevrisme_diametre_mm: null,
    aorte_findings_text: "",
    mi_pression_cheville_droite: null,
    mi_pression_cheville_gauche: null,
    mi_pression_bras_droit: null,
    mi_pression_bras_gauche: null,
    mi_ips_droit: null,
    mi_ips_gauche: null,
    mi_findings_text: "",
    conclusion: "",
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
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.numpages).toBe(1);
    expect(parsed.text).toContain("DUPONT Jean");
    expect(parsed.text).toContain("Dr. Martin");
    expect(parsed.text).toContain("2026-08-13");
  });

  it("includes only the active risk factors, by French label", async () => {
    const riskFactors = makeRiskFactors({ diabetes: 1, smoking: 1 });
    const bytes = await buildReportPdf(makePatient(), riskFactors, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Diabète");
    expect(parsed.text).toContain("Tabagisme");
    expect(parsed.text).not.toContain("Hypertension");
  });

  it("says no risk factors were recorded when there are none", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Aucun antécédent renseigné.");
  });

  it("includes the four top-level section headers", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("INDICATION");
    expect(parsed.text).toContain("TECHNIQUE");
    expect(parsed.text).toContain("RÉSULTATS");
    expect(parsed.text).toContain("CONCLUSION");
  });

  it("includes TSA, aorte abdominale, and membres inférieurs findings", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        tsa_imt_droit: 0.62,
        tsa_findings_text: "Plaque athéromateuse significative",
        aorte_anevrisme: 1,
        aorte_anevrisme_diametre_mm: 34,
        mi_pression_cheville_droite: 120,
        mi_pression_bras_droit: 130,
        mi_pression_bras_gauche: 140,
        mi_ips_droit: 0.86,
      }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Troncs supra-aortiques");
    expect(parsed.text).toContain("Plaque athéromateuse significative");
    expect(parsed.text).toContain("Aorte abdominale");
    expect(parsed.text).toContain("34");
    expect(parsed.text).toContain("IPS droit");
    expect(parsed.text).toContain("0.86");
  });

  it("includes the indication and conclusion free text", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        indication: "Bilan vasculaire (tabagisme, hypertension)",
        conclusion: "Athéromatose polyvasculaire.",
      }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Bilan vasculaire");
    expect(parsed.text).toContain("Athéromatose polyvasculaire.");
  });

  it("renders the clinic settings as a letterhead: doctor identity, membership, RPPS/Adeli, and address", async () => {
    const settings = makeSettings({
      doctor_name: "Dr Pembele",
      professional_membership: "Membre de la société française de radiologie",
      rpps_number: "12345678901",
      adeli_number: "939912345",
      address: "6 avenue Yuri Gagarine 93270 Sevran",
    });
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), settings);
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Dr Pembele");
    expect(parsed.text).toContain("Membre de la société française de radiologie");
    expect(parsed.text).toContain("12345678901");
    expect(parsed.text).toContain("939912345");
    expect(parsed.text).toContain("6 avenue Yuri Gagarine 93270 Sevran");
  });

  it("builds the TECHNIQUE paragraph from the Mindray service date and characteristics", async () => {
    const settings = makeSettings({
      mindray_service_date: "2020-03-01",
      mindray_characteristics: "Mindray Resona 7, sonde linéaire L14-5",
    });
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), settings);
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Mindray Resona 7, sonde linéaire L14-5");
    expect(parsed.text).toContain("2020-03-01");
  });

  it("falls back to a generic TECHNIQUE sentence when Mindray settings are unfilled", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("échographe vasculaire");
  });
});
