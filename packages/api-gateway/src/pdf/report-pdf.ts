import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import {
  VESSEL_KEYS,
  VESSEL_LABELS,
  RISK_FACTOR_KEYS,
  RISK_FACTOR_LABELS,
  type VesselKey,
} from "@speira-docdoppler/shared-labels";
import type { PatientRow, RiskFactorsRow } from "../db/patients.js";
import type { ReportRow } from "../db/reports.js";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const LINE_HEIGHT = 16;

function wrapText(font: PDFFont, size: number, maxWidth: number, text: string): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(" ");
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

function vesselFindings(
  report: ReportRow,
): Record<VesselKey, { text: string; abnormal: boolean }> {
  return {
    carotide: { text: report.carotide_text, abnormal: report.carotide_abnormal === 1 },
    artere_membre_sup: {
      text: report.artere_membre_sup_text,
      abnormal: report.artere_membre_sup_abnormal === 1,
    },
    veine_membre_sup: {
      text: report.veine_membre_sup_text,
      abnormal: report.veine_membre_sup_abnormal === 1,
    },
    artere_membre_inf: {
      text: report.artere_membre_inf_text,
      abnormal: report.artere_membre_inf_abnormal === 1,
    },
    veine_membre_inf: {
      text: report.veine_membre_inf_text,
      abnormal: report.veine_membre_inf_abnormal === 1,
    },
  };
}

export async function buildReportPdf(
  patient: PatientRow,
  riskFactors: RiskFactorsRow | undefined,
  report: ReportRow,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const draw = (text: string, size: number, useBold = false) => {
    page.drawText(text, { x: MARGIN, y: y - size, size, font: useBold ? boldFont : font });
    y -= LINE_HEIGHT;
  };

  draw("Cabinet d'écho-Doppler vasculaire", 16, true);
  draw(`Date de l'examen : ${report.exam_date}`, 10);
  draw(`Médecin : ${report.doctor_name}`, 10);
  y -= LINE_HEIGHT / 2;

  draw("Identité du patient", 12, true);
  draw(`${patient.last_name.toUpperCase()} ${patient.first_name}`, 10);
  draw(`Date de naissance : ${patient.dob}`, 10);
  draw(`Sexe : ${patient.sex === "F" ? "Féminin" : "Masculin"}`, 10);
  y -= LINE_HEIGHT / 2;

  draw("Antécédents médicaux", 12, true);
  const activeRiskFactors = RISK_FACTOR_KEYS.filter((key) => riskFactors?.[key] === 1);
  if (activeRiskFactors.length === 0) {
    draw("Aucun antécédent renseigné.", 10);
  } else {
    for (const key of activeRiskFactors) {
      draw(`- ${RISK_FACTOR_LABELS[key]}`, 10);
    }
  }
  y -= LINE_HEIGHT / 2;

  draw("Constatations", 12, true);
  const findings = vesselFindings(report);
  const examinedVessels = VESSEL_KEYS.filter((key) => findings[key].text.trim().length > 0);
  if (examinedVessels.length === 0) {
    draw("Aucune constatation renseignée.", 10);
  } else {
    for (const vessel of examinedVessels) {
      const { text, abnormal } = findings[vessel];
      draw(`${VESSEL_LABELS[vessel]}${abnormal ? " (anormal)" : ""}`, 10, true);
      for (const line of wrapText(font, 10, PAGE_WIDTH - MARGIN * 2, text)) {
        draw(line, 10);
      }
    }
  }

  // useObjectStreams: false — pdf-lib defaults to compressed cross-reference
  // streams (PDF 1.5+), which pdf-parse's bundled pdf.js (v1.10.100, a much
  // older release) intermittently fails to parse ("Invalid PDF structure").
  // Classic xref tables are readable by both.
  return doc.save({ useObjectStreams: false });
}
