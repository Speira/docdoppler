import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { PDFDocument } from "pdf-lib";
import {
  buildReportPdf,
  buildReportPdfFilename,
  classifyAorteDiameter,
  formatAorteDiametre,
  wrapText,
} from "./report-pdf.js";
import type { PatientRow, RiskFactorsRow } from "../db/patients.js";
import type { ReportWithArteries } from "../db/reports.js";
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

function makeReport(overrides: Partial<ReportWithArteries> = {}): ReportWithArteries {
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
    arteres: {},
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
  // Line wrapping can split a phrase across a "\n" purely based on where a
  // line happened to break — collapse all whitespace so substring
  // assertions test content, not incidental line width.
  return { text: text.replace(/\s+/g, " "), numpages: totalPages };
}

describe("buildReportPdf", () => {
  it("produces a single-page PDF containing the patient identity, doctor, and exam date", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.numpages).toBe(1);
    expect(parsed.text).toContain("DUPONT Jean");
    expect(parsed.text).toContain("Dr. Martin");
    expect(parsed.text).toContain("13/08/2026");
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

  it("orders the sections: identity, compte rendu, indication, technique, résultats, conclusion", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    const sections = [
      "Identité du patient",
      "Compte rendu",
      "INDICATION",
      "TECHNIQUE",
      "RÉSULTATS",
      "CONCLUSION",
    ];
    const positions = sections.map((section) => parsed.text.indexOf(section));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("puts the médecin correspondant in the Identité du patient block", async () => {
    const report = makeReport({ correspondant_dossier: "Dr Durand" });
    const bytes = await buildReportPdf(makePatient(), undefined, report, makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Médecin correspondant : Dr Durand");
    expect(parsed.text).not.toContain("Correspondant du dossier");
    expect(parsed.text.indexOf("Médecin correspondant")).toBeLessThan(
      parsed.text.indexOf("Compte rendu"),
    );
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
        aorte_diametre: "34 mm",
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
    expect(parsed.text).toContain("Diamètre antéro-postérieur : 34 mm (Anévrisme)");
    expect(parsed.text).toContain("IPS : 0.86");
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
    expect(parsed.text).toContain("mis en service le 01/03/2020");
  });

  it("falls back to a generic TECHNIQUE sentence when Mindray settings are unfilled", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("échographe vasculaire");
  });

  it("lists the active risk factors inline after 'Bilan vasculaire :', not as bullets", async () => {
    const riskFactors = makeRiskFactors({ diabetes: 1, hypertension: 1, smoking: 1 });
    const bytes = await buildReportPdf(makePatient(), riskFactors, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Bilan vasculaire : Diabète, HTA, Tabagisme");
    expect(parsed.text).not.toContain("- HTA");
  });

  it("still shows 'no risk factors recorded' under Bilan vasculaire when there are none", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Bilan vasculaire : Aucun antécédent renseigné.");
  });

  it("lists each TSA side inline on its own row, Droite before Gauche", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        tsa_imt_droit: 0.62,
        tsa_imt_gauche: 0.58,
        tsa_aci_acc_ratio_droit: 1.8,
        tsa_aci_acc_ratio_gauche: 1.2,
      }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("- Droite : IMT : 0.62 mm. Ratio ACI/ACC : 1.8");
    expect(parsed.text).toContain("- Gauche : IMT : 0.58 mm. Ratio ACI/ACC : 1.2");
    expect(parsed.text.indexOf("- Droite")).toBeLessThan(parsed.text.indexOf("- Gauche"));
    // The side-by-side column header is gone.
    expect(parsed.text).not.toContain("Gauche Droite");
  });

  it("lists each membres inférieurs side inline on its own row", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        mi_ips_droit: 0.86,
        mi_ips_gauche: 0.93,
        mi_pression_cheville_droite: 120,
        mi_pression_cheville_gauche: 130,
      }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("- Droite : IPS : 0.86");
    expect(parsed.text).toContain("- Gauche : IPS : 0.93");
  });

  it("omits a side that has no measurement of its own", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({ tsa_imt_droit: 0.62 }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("- Droite : IMT : 0.62 mm");
    expect(parsed.text).not.toContain("- Gauche");
  });

  it("prints the TSA reference criteria (VSM stenosis thresholds and vertebral flow)", async () => {
    const report = makeReport({ tsa_imt_droit: 0.62 });
    const bytes = await buildReportPdf(makePatient(), undefined, report, makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("sténose sévère");
    expect(parsed.text).toContain("flux rétrograde pathologique");
  });

  it("renders the aorte diameter as 'Diamètre antéro-postérieur' with its resolved band", async () => {
    const report = makeReport({ aorte_diametre: "22" });
    const bytes = await buildReportPdf(makePatient(), undefined, report, makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Diamètre antéro-postérieur : 22 mm (Normal)");
    expect(parsed.text).not.toContain("Diamètre / calibre");
  });

  it("does not double the unit on a legacy diameter that already has one", async () => {
    const report = makeReport({ aorte_diametre: "22 mm" });
    const bytes = await buildReportPdf(makePatient(), undefined, report, makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Diamètre antéro-postérieur : 22 mm (Normal)");
    expect(parsed.text).not.toContain("mm mm");
  });

  it("prints no aneurysm line at all — the derived band is the only verdict", async () => {
    const aneurysm = makeReport({
      aorte_diametre: "34 mm",
      aorte_anevrisme: 1,
      aorte_anevrisme_diametre_mm: 34,
    });
    const parsedAneurysm = await parsePdf(
      await buildReportPdf(makePatient(), undefined, aneurysm, makeSettings()),
    );
    expect(parsedAneurysm.text).toContain("Diamètre antéro-postérieur : 34 mm (Anévrisme)");
    expect(parsedAneurysm.text).not.toContain("Anévrisme : Oui");
    expect(parsedAneurysm.text).not.toContain("Diamètre de l'anévrisme");

    const normal = makeReport({ aorte_diametre: "22 mm" });
    const parsedNormal = await parsePdf(
      await buildReportPdf(makePatient(), undefined, normal, makeSettings()),
    );
    expect(parsedNormal.text).not.toContain("Anévrisme : Non");
  });

  it("prints the aorte abdominale reference criteria (diameter thresholds)", async () => {
    const report = makeReport({ aorte_diametre: "22 mm" });
    const bytes = await buildReportPdf(makePatient(), undefined, report, makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("ectasie 25 à 29 mm");
    expect(parsed.text).toContain("anévrisme > 30 mm");
  });

  it("prints the membres inférieurs reference criteria (spectre and IPS thresholds)", async () => {
    const report = makeReport({ mi_ips_droit: 1.02 });
    const bytes = await buildReportPdf(makePatient(), undefined, report, makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("monophasique pathologique");
    expect(parsed.text).toContain("médiacalcose");
  });

  it("renders symbols outside CP1252 (≥, ≤, →) that Helvetica cannot encode", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        tsa_findings_text: "Sténose ACI droite ≥ 70%.",
        conclusion: "IPS ≤ 0,90 → AOMI confirmée.",
      }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("≥ 70%");
    expect(parsed.text).toContain("≤ 0,90 → AOMI confirmée.");
  });

  it("formats the exam date as dd/mm/yyyy, like the date of birth", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Date de l'examen : 13/08/2026");
    expect(parsed.text).not.toContain("2026-08-13");
  });

  it("omits the Gauche/Droite column headers when a section has no per-side values", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({ tsa_findings_text: "Axes carotidiens perméables." }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Axes carotidiens perméables.");
    expect(parsed.text).not.toContain("Gauche");
    expect(parsed.text).not.toContain("Droite");
  });

  it("omits result sections that have no data, including their reference criteria", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({ tsa_imt_droit: 0.62 }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Troncs supra-aortiques");
    expect(parsed.text).not.toContain("Aorte abdominale");
    expect(parsed.text).not.toContain("ectasie 25 à 29 mm");
    expect(parsed.text).not.toContain("Artères des membres inférieurs");
    expect(parsed.text).not.toContain("médiacalcose");
  });

  it("says no results were recorded when every result section is empty", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("RÉSULTATS");
    expect(parsed.text).toContain("Aucun résultat renseigné.");
  });

  it("sets PDF metadata so archived files are identifiable outside the app", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain("DUPONT Jean");
    expect(doc.getTitle()).toContain("13/08/2026");
    expect(doc.getAuthor()).toBe("Dr. Martin");
    expect(doc.getSubject()).toContain("Écho-Doppler");
  });

  it("repeats the patient identity and paginates when the report spills onto a second page", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        tsa_imt_droit: 0.62,
        tsa_findings_text: "Plaque athéromateuse du bulbe carotidien droit. ".repeat(30),
        conclusion: "Athéromatose polyvasculaire à surveiller. ".repeat(30),
      }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.numpages).toBeGreaterThan(1);
    expect(parsed.text).toContain(`Page 1/${parsed.numpages}`);
    expect(parsed.text).toContain(`Page ${parsed.numpages}/${parsed.numpages}`);
    // Identity appears in the letterhead block and again on each continuation page.
    const identityCount = parsed.text.split("DUPONT Jean").length - 1;
    expect(identityCount).toBeGreaterThanOrEqual(parsed.numpages);
  });

  it("does not stamp a page number on a single-page report", async () => {
    const bytes = await buildReportPdf(makePatient(), undefined, makeReport(), makeSettings());
    const parsed = await parsePdf(bytes);
    expect(parsed.numpages).toBe(1);
    expect(parsed.text).not.toContain("Page 1/1");
  });

  it("keeps a bold-prefixed line on one row and wraps its remainder", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        mi_ips_droit: 0.86,
        arteres: {
          droite: { afc: { vsm: 90, spectre: "triphasique" } },
        },
      }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain(
      "Artère fémorale commune (AFC) VSM : 90 cm/s. Spectre : triphasique. Flux : laminaire",
    );
  });

  it("prints each side's IPS then its arteries, droite before gauche", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        mi_ips_droit: 0.86,
        mi_ips_gauche: 0.93,
        arteres: {
          droite: { afs: { vsm: null, spectre: "monophasique" } },
          gauche: { poplitee: { vsm: null, spectre: "diphasique" } },
        },
      }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("- Droite : IPS : 0.86");
    expect(parsed.text).toContain(
      "Artère fémorale superficielle (AFS) Spectre : monophasique. Flux : amortie",
    );
    expect(parsed.text).toContain("- Gauche : IPS : 0.93");
    expect(parsed.text).toContain("Artère poplitée Spectre : diphasique");
    expect(parsed.text.indexOf("- Droite")).toBeLessThan(parsed.text.indexOf("- Gauche"));
  });

  it("no longer prints any systolic pressure line", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        mi_pression_bras_droit: 140,
        mi_pression_bras_gauche: 135,
        mi_pression_cheville_droite: 120,
        mi_ips_droit: 0.86,
      }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).not.toContain("Pression systolique bras");
    expect(parsed.text).not.toContain("Pression cheville");
    expect(parsed.text).toContain("- Droite : IPS : 0.86");
  });

  it("omits an artery with no spectre and no vsm, and a side with nothing at all", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        mi_ips_droit: 0.86,
        arteres: { droite: { afc: { vsm: null, spectre: "triphasique" } } },
      }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Artère fémorale commune (AFC) Spectre : triphasique");
    expect(parsed.text).not.toContain("Artère fibulaire");
    expect(parsed.text).not.toContain("- Gauche");
  });

  it("still prints the constatations and the MI reference note", async () => {
    const bytes = await buildReportPdf(
      makePatient(),
      undefined,
      makeReport({
        mi_ips_droit: 0.86,
        mi_findings_text: "Axe droit calcifié.",
      }),
      makeSettings(),
    );
    const parsed = await parsePdf(bytes);
    expect(parsed.text).toContain("Axe droit calcifié.");
    expect(parsed.text).toContain("médiacalcose");
  });
});

describe("formatAorteDiametre", () => {
  it("appends mm to a bare number, as the form's numeric input now sends", () => {
    expect(formatAorteDiametre("22")).toBe("22 mm");
    expect(formatAorteDiametre("24,5")).toBe("24,5 mm");
  });

  it("leaves a legacy value that already carries its own unit", () => {
    expect(formatAorteDiametre("22 mm")).toBe("22 mm");
    expect(formatAorteDiametre("14 à 18 mm")).toBe("14 à 18 mm");
    expect(formatAorteDiametre("non visualisée")).toBe("non visualisée");
  });
});

describe("classifyAorteDiameter", () => {
  it("classifies under 25 mm as normal", () => {
    expect(classifyAorteDiameter("22 mm")).toBe("Normal");
    expect(classifyAorteDiameter("24,9 mm")).toBe("Normal");
  });

  it("classifies 25 mm up to under 30 mm as ectasie", () => {
    expect(classifyAorteDiameter("25 mm")).toBe("Ectasie");
    expect(classifyAorteDiameter("29 mm")).toBe("Ectasie");
  });

  it("classifies 30 mm and above as anévrisme", () => {
    expect(classifyAorteDiameter("30 mm")).toBe("Anévrisme");
    expect(classifyAorteDiameter("34 mm")).toBe("Anévrisme");
  });

  it("reads a value with no unit and one written with a French decimal comma", () => {
    expect(classifyAorteDiameter("27")).toBe("Ectasie");
    expect(classifyAorteDiameter("32,5 mm")).toBe("Anévrisme");
  });

  it("falls back to the option list when the value is not one measurement", () => {
    const options = "Normal/Ectasie/Anévrisme";
    expect(classifyAorteDiameter("14 à 18 mm")).toBe(options);
    expect(classifyAorteDiameter("non visualisée")).toBe(options);
    expect(classifyAorteDiameter("")).toBe(options);
  });
});

describe("wrapText", () => {
  // 10pt per character keeps the arithmetic obvious: a 100pt line fits 10 chars.
  const measure = (text: string) => text.length * 10;

  it("wraps on word boundaries", () => {
    expect(wrapText(measure, 100, "aaa bbb ccc ddd")).toEqual(["aaa bbb", "ccc ddd"]);
  });

  it("preserves explicit line breaks", () => {
    expect(wrapText(measure, 100, "aaa\nbbb")).toEqual(["aaa", "bbb"]);
  });

  it("breaks a single token too long for the line instead of overflowing it", () => {
    const token = "A".repeat(25);
    const lines = wrapText(measure, 100, token);
    expect(lines.every((line) => measure(line) <= 100)).toBe(true);
    expect(lines.join("")).toBe(token);
  });
});

describe("buildReportPdfFilename", () => {
  it("builds Rapport_Echodoppler_LASTNAME_FirstName_examDate_id.pdf", () => {
    const filename = buildReportPdfFilename(
      makePatient({ last_name: "Dupont", first_name: "Jean" }),
      makeReport({ id: 42, exam_date: "2026-08-13" }),
    );
    expect(filename).toBe("Rapport_Echodoppler_DUPONT_Jean_2026-08-13_42.pdf");
  });

  it("strips accents and replaces unsafe characters", () => {
    const filename = buildReportPdfFilename(
      makePatient({ last_name: "Ünïçödé O'Brien", first_name: "Jean-Pierre" }),
      makeReport({ id: 7, exam_date: "2026-08-13" }),
    );
    expect(filename).toBe("Rapport_Echodoppler_UNICODE-O-BRIEN_Jean-Pierre_2026-08-13_7.pdf");
  });
});
