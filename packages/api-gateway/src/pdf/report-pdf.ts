import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import {
  REPORT_SECTION_LABELS,
  RISK_FACTOR_KEYS,
  RISK_FACTOR_LABELS,
} from "@speira-docdoppler/shared-labels";
import type { PatientRow, RiskFactorsRow } from "../db/patients.js";
import type { ReportRow } from "../db/reports.js";
import type { ClinicSettingsRow } from "../db/settings.js";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const LINE_HEIGHT = 16;
const ADDRESS_COLUMN_WIDTH = 200;

const FALLBACK_TECHNIQUE_SENTENCE =
  "Examen réalisé avec l'échographe vasculaire (appareil à renseigner via les paramètres du cabinet).";

function buildTechniqueParagraph(settings: ClinicSettingsRow): string {
  const characteristics = settings.mindray_characteristics.trim();
  if (!characteristics && !settings.mindray_service_date) {
    return FALLBACK_TECHNIQUE_SENTENCE;
  }
  const machine = characteristics || "l'échographe vasculaire du cabinet";
  const servicePart = settings.mindray_service_date
    ? `, mis en service le ${settings.mindray_service_date}`
    : "";
  return `Examen réalisé avec ${machine}${servicePart}.`;
}

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

export async function buildReportPdf(
  patient: PatientRow,
  riskFactors: RiskFactorsRow | undefined,
  report: ReportRow,
  settings: ClinicSettingsRow,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = () => {
    if (y < MARGIN + LINE_HEIGHT) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const draw = (text: string, size: number, useBold = false) => {
    ensureSpace();
    page.drawText(text, { x: MARGIN, y: y - size, size, font: useBold ? boldFont : font });
    y -= LINE_HEIGHT;
  };

  const drawWrapped = (text: string, size: number) => {
    for (const line of wrapText(font, size, PAGE_WIDTH - MARGIN * 2, text)) {
      draw(line, size);
    }
  };

  const drawField = (label: string, value: string | number | null) => {
    if (value === null || value === "") return;
    draw(`${label} : ${value}`, 10);
  };

  // Letterhead: doctor identity block on the left, clinic address on the
  // right (see example-reports/Echodoppler_plan.pdf) — two independent
  // column cursors, reconciled back into the shared `y` afterwards.
  let leftY = y;
  const drawLeft = (text: string, size: number, useBold = false) => {
    page.drawText(text, { x: MARGIN, y: leftY - size, size, font: useBold ? boldFont : font });
    leftY -= LINE_HEIGHT;
  };

  let rightY = y;
  const drawRight = (text: string, size: number) => {
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: PAGE_WIDTH - MARGIN - width,
      y: rightY - size,
      size,
      font,
    });
    rightY -= LINE_HEIGHT;
  };

  if (settings.doctor_name) {
    drawLeft(settings.doctor_name, 16, true);
    drawLeft("Écho-Doppler Vasculaire", 10);
  } else {
    drawLeft("Cabinet d'écho-Doppler vasculaire", 16, true);
  }
  if (settings.professional_membership) drawLeft(settings.professional_membership, 9);
  if (settings.rpps_number) drawLeft(`RPPS : ${settings.rpps_number}`, 9);
  if (settings.adeli_number) drawLeft(`N° Adeli : ${settings.adeli_number}`, 9);

  if (settings.address) {
    for (const line of wrapText(font, 9, ADDRESS_COLUMN_WIDTH, settings.address)) {
      drawRight(line, 9);
    }
  }

  y = Math.min(leftY, rightY);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
  });
  y -= LINE_HEIGHT;

  draw("Compte rendu", 13, true);
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

  draw("INDICATION", 12, true);
  drawField("Correspondant du dossier", report.correspondant_dossier || null);
  if (report.indication.trim().length > 0) {
    drawWrapped(report.indication, 10);
  } else {
    draw("Non renseignée.", 10);
  }
  y -= LINE_HEIGHT / 2;

  draw("TECHNIQUE", 12, true);
  drawWrapped(buildTechniqueParagraph(settings), 10);
  y -= LINE_HEIGHT / 2;

  draw("RÉSULTATS", 12, true);

  draw(REPORT_SECTION_LABELS.tsa, 11, true);
  drawField("IMT droit (mm)", report.tsa_imt_droit);
  drawField("IMT gauche (mm)", report.tsa_imt_gauche);
  drawField("Ratio ACI/ACC droit", report.tsa_aci_acc_ratio_droit);
  drawField("Ratio ACI/ACC gauche", report.tsa_aci_acc_ratio_gauche);
  if (report.tsa_findings_text.trim().length > 0) {
    drawWrapped(report.tsa_findings_text, 10);
  }
  y -= LINE_HEIGHT / 2;

  draw(REPORT_SECTION_LABELS.aorte_abdominale, 11, true);
  drawField("Diamètre / calibre", report.aorte_diametre || null);
  draw(`Anévrisme : ${report.aorte_anevrisme === 1 ? "Oui" : "Non"}`, 10);
  if (report.aorte_anevrisme === 1) {
    drawField("Diamètre de l'anévrisme (mm)", report.aorte_anevrisme_diametre_mm);
  }
  if (report.aorte_findings_text.trim().length > 0) {
    drawWrapped(report.aorte_findings_text, 10);
  }
  y -= LINE_HEIGHT / 2;

  draw(REPORT_SECTION_LABELS.membres_inferieurs, 11, true);
  drawField("Pression systolique cheville droite (mmHg)", report.mi_pression_cheville_droite);
  drawField("Pression systolique cheville gauche (mmHg)", report.mi_pression_cheville_gauche);
  drawField("Pression systolique bras droit (mmHg)", report.mi_pression_bras_droit);
  drawField("Pression systolique bras gauche (mmHg)", report.mi_pression_bras_gauche);
  drawField("IPS droit", report.mi_ips_droit);
  drawField("IPS gauche", report.mi_ips_gauche);
  if (report.mi_findings_text.trim().length > 0) {
    drawWrapped(report.mi_findings_text, 10);
  }
  y -= LINE_HEIGHT / 2;

  draw("CONCLUSION", 12, true);
  if (report.conclusion.trim().length > 0) {
    drawWrapped(report.conclusion, 10);
  } else {
    draw("Non renseignée.", 10);
  }

  // useObjectStreams: false — pdf-lib defaults to compressed cross-reference
  // streams (PDF 1.5+), which pdf-parse's bundled pdf.js (v1.10.100, a much
  // older release) intermittently fails to parse ("Invalid PDF structure").
  // Classic xref tables are readable by both.
  return doc.save({ useObjectStreams: false });
}
