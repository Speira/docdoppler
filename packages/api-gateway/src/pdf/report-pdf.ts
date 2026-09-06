import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  MI_ARTERY_KEYS,
  MI_ARTERY_LABELS,
  MI_SIDES,
  MI_SIDE_LABELS,
  REPORT_SECTION_LABELS,
  RISK_FACTOR_KEYS,
  RISK_FACTOR_LABELS,
  fluxForSpectre,
} from "@speira-docdoppler/shared-labels";
import type { PatientRow, RiskFactorsRow } from "../db/patients.js";
import type { ReportRow, ReportWithArteries } from "../db/reports.js";
import type { ClinicSettingsRow } from "../db/settings.js";

const TSA_REFERENCE_NOTE =
  "Repères : ACC = IMT. Bulbe = présence ou absence de plaque. " +
  "ACI (VSM) : < 180 cm/s pas de sténose, 180-230 cm/s sténose modérée, > 230 cm/s sténose sévère. " +
  "Artères vertébrales : flux antérograde normal, flux rétrograde pathologique.";

const AORTE_REFERENCE_NOTE =
  "Repères : diamètre antéro-postérieur normal < 25 mm, ectasie 25 à 29 mm, anévrisme > 30 mm.";

const MI_REFERENCE_NOTE =
  "Repères : artère fémorale commune (VSM et spectre) - triphasique normal, diphasique artériopathie débutante, " +
  "monophasique pathologique ; AFS, poplitée, tibiale antérieure, tibiale postérieure, fibulaire : spectre. " +
  "IPS normal 1,00 à 1,40 ; IPS < 0,90 = AOMI ; IPS > 1,40 = médiacalcose (artères incompressibles).";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const LINE_HEIGHT = 16;
const ADDRESS_COLUMN_WIDTH = 230;
// The letterhead's left block must stop short of the right-aligned address.
const LETTERHEAD_COLUMN_WIDTH = PAGE_WIDTH - MARGIN * 2 - ADDRESS_COLUMN_WIDTH - 20;
// Submenu indentation: level-1 (e.g. "Bilan vasculaire", "TSA") indents once,
// level-2 (e.g. "Droite"/"Gauche" under TSA) indents twice as much.
const INDENT_1 = 14;
const INDENT_2 = 28;
const INDENT_3 = 42;
const FOOTER_SIZE = 8;
const FOOTER_BASELINE = 30; // inside the bottom margin, below the content area
const CONTINUATION_HEADER_SIZE = 8;
// The 8pt "Repères" notes were set at the 10pt body's 16pt leading, which
// double-spaced them and wasted several lines per report.
const NOTE_LINE_HEIGHT = 11;
// A real list bullet rather than a hyphen. Liberation Sans carries U+2022,
// so this is safe with the embedded font (a StandardFont would not be).
// One size for every top-level section title and one for every subsection,
// so they cannot drift apart again: "Compte rendu" used to be 11 while its
// neighbours were 12.
// The letterhead reads as one block: doctor name, activity line, credentials
// and address all share this size, none of them bold.
const LETTERHEAD_SIZE = 10;
const SECTION_HEADING_SIZE = 11;
const SUBSECTION_HEADING_SIZE = 11;
const BULLET = "•";
// The letterhead credentials read as one run-on line, so the gaps between
// membership / RPPS / Adeli carry em spaces (U+2003) for real separation.
// The flanking ASCII spaces matter: wrapText splits on " ", so they keep the
// line breakable between items instead of at an arbitrary character.
const CREDENTIAL_SEPARATOR = " \u2003—\u2003 ";
// Label/value pairs that share a line put the second field in a fixed
// column, so "Sexe" and "Médecin" align under each other and each pair
// gets real breathing room instead of a cramped separator.
const PAIR_COLUMN = 210;

// Liberation Sans is metrically compatible with Helvetica (so the column
// widths above still hold) but, unlike pdf-lib's built-in StandardFonts, it is
// embedded as a real Unicode font. The built-ins are WinAnsi/CP1252-only and
// throw on characters a vascular report legitimately contains — "sténose
// ≥ 70%", "IPS ≤ 0,90", "ACI → ACC" — which crashed PDF generation outright.
// Bundled locally (SIL OFL, see assets/fonts/LICENSE.txt): no runtime download.
const FONT_DIR = fileURLToPath(new URL("../../assets/fonts/", import.meta.url));

let fontBytesPromise: Promise<{
  regular: Uint8Array;
  bold: Uint8Array;
}> | null = null;

function loadFontBytes(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  // Read the TTFs once per process, not once per report.
  fontBytesPromise ??= Promise.all([
    readFile(`${FONT_DIR}LiberationSans-Regular.ttf`),
    readFile(`${FONT_DIR}LiberationSans-Bold.ttf`),
  ]).then(([regular, bold]) => ({ regular, bold }));
  return fontBytesPromise;
}

const dateFormatterFR = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDateFR(isoDate: string | null): string {
  if (!isoDate) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  // Leave anything that isn't a plain ISO date untouched rather than risk
  // rendering "Invalid Date" on a report.
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return dateFormatterFR.format(
    new Date(Number(year), Number(month) - 1, Number(day)),
  );
}

// "O" is the DICOM code for a sex that is neither M nor F; it renders as the
// epicene "né(e)" and as "non précisé" rather than forcing a gendered form.
function bornLabel(sex: PatientRow["sex"]): string {
  if (sex === "F") return "née";
  if (sex === "M") return "né";
  return "né(e)";
}

function sexLabel(sex: PatientRow["sex"]): string {
  if (sex === "F") return "féminin";
  if (sex === "M") return "masculin";
  return "non précisé";
}

function sanitizeForFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildReportPdfFilename(
  patient: PatientRow,
  report: ReportRow,
): string {
  const lastName = sanitizeForFilename(patient.last_name).toUpperCase();
  const firstName = sanitizeForFilename(patient.first_name);
  return `Rapport_Echodoppler_${lastName}_${firstName}_${report.exam_date}_${report.id}.pdf`;
}

const FALLBACK_TECHNIQUE_SENTENCE =
  "Examen réalisé avec l'échographe vasculaire (appareil à renseigner via les paramètres du cabinet).";

function buildTechniqueParagraph(settings: ClinicSettingsRow): string {
  const characteristics = settings.mindray_characteristics.trim();
  if (!characteristics && !settings.mindray_service_date) {
    return FALLBACK_TECHNIQUE_SENTENCE;
  }
  const machine = characteristics || "l'échographe vasculaire du cabinet";
  const servicePart = settings.mindray_service_date
    ? `, mis en service le ${formatDateFR(settings.mindray_service_date)}`
    : "";
  return `Examen réalisé avec ${machine}${servicePart}.`;
}

const AORTE_BAND_OPTIONS = "Normal/Ectasie/Anévrisme";

// The report builder's diameter input is numeric, so it sends a bare "22".
// Legacy rows were free text and already carry their own unit ("22 mm",
// "14 à 18 mm") — appending to those would print "22 mm mm".
export function formatAorteDiametre(diametre: string): string {
  const trimmed = diametre.trim();
  return /^[\d.,\s]+$/.test(trimmed) ? `${trimmed} mm` : diametre;
}

// Bands from AORTE_REFERENCE_NOTE: normal < 25 mm, ectasie 25 to 29 mm,
// anévrisme > 30 mm. The note leaves 29-30 open, so the boundary is closed at
// the clinical convention (>= 30 = anévrisme).
//
// `aorte_diametre` is free text, so a value that isn't one measurement — a
// range ("14 à 18 mm"), prose ("non visualisée"), empty — cannot be
// classified: those fall back to printing the three options, unresolved.
export function classifyAorteDiameter(diametre: string): string {
  const numbers = diametre.match(/\d+(?:[.,]\d+)?/g);
  if (numbers?.length !== 1) return AORTE_BAND_OPTIONS;
  const mm = Number(numbers[0].replace(",", "."));
  if (!Number.isFinite(mm)) return AORTE_BAND_OPTIONS;
  if (mm < 25) return "Normal";
  if (mm < 30) return "Ectasie";
  return "Anévrisme";
}

type Measure = (text: string) => number;

// Split a token that cannot fit on a line of its own (a long accession number,
// a pasted URL) so it wraps instead of running off the page edge.
function breakToken(
  measure: Measure,
  maxWidth: number,
  token: string,
): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const char of token) {
    const candidate = current + char;
    if (current && measure(candidate) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function wrapText(
  measure: Measure,
  maxWidth: number,
  text: string,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && measure(candidate) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
      if (measure(current) > maxWidth) {
        const chunks = breakToken(measure, maxWidth, current);
        lines.push(...chunks.slice(0, -1));
        current = chunks[chunks.length - 1] ?? "";
      }
    }
    lines.push(current);
  }
  return lines;
}

export async function buildReportPdf(
  patient: PatientRow,
  riskFactors: RiskFactorsRow | undefined,
  report: ReportWithArteries,
  settings: ClinicSettingsRow,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontBytes = await loadFontBytes();
  const font = await doc.embedFont(fontBytes.regular, { subset: true });
  const boldFont = await doc.embedFont(fontBytes.bold, { subset: true });
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const patientIdentity = `${patient.last_name.toUpperCase()} ${patient.first_name}`;
  // Repeated at the top of every continuation page: a loose second sheet has
  // to be identifiable on its own.
  const continuationHeader =
    `${patientIdentity} — ${bornLabel(patient.sex)} le ${formatDateFR(patient.dob)}` +
    ` — examen du ${formatDateFR(report.exam_date)}`;

  const startContinuationPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText(continuationHeader, {
      x: MARGIN,
      y: y - CONTINUATION_HEADER_SIZE,
      size: CONTINUATION_HEADER_SIZE,
      font,
    });
    y -= CONTINUATION_HEADER_SIZE + 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
    });
    y -= LINE_HEIGHT;
  };

  const ensureSpace = () => {
    if (y < MARGIN + LINE_HEIGHT) {
      startContinuationPage();
    }
  };

  // Keep-with-next: a section header printed at the foot of a page, with its
  // body overleaf, wastes a whole sheet — a real report spent an entire A4 on
  // the words "Non renseignée.". Break before the header instead, so it
  // travels with the first lines of what it introduces.
  const KEEP_WITH_HEADER_LINES = 2;
  const drawHeading = (text: string, size: number, indent = 0) => {
    if (y - (KEEP_WITH_HEADER_LINES + 1) * LINE_HEIGHT < MARGIN) {
      startContinuationPage();
    }
    draw(text, size, true, indent);
  };

  const draw = (
    text: string,
    size: number,
    useBold = false,
    indent = 0,
    lineHeight = LINE_HEIGHT,
  ) => {
    ensureSpace();
    page.drawText(text, {
      x: MARGIN + indent,
      y: y - size,
      size,
      font: useBold ? boldFont : font,
    });
    y -= lineHeight;
  };

  const drawWrapped = (
    text: string,
    size: number,
    indent = 0,
    lineHeight = LINE_HEIGHT,
  ) => {
    const measure = (line: string) => font.widthOfTextAtSize(line, size);
    for (const line of wrapText(
      measure,
      PAGE_WIDTH - MARGIN * 2 - indent,
      text,
    )) {
      draw(line, size, false, indent, lineHeight);
    }
  };

  const drawField = (
    label: string,
    value: string | number | null,
    indent = 0,
  ) => {
    if (value === null || value === "") return;
    draw(`${label} : ${value}`, 10, false, indent);
  };

  // Two label/value pairs on one line: the second starts at a fixed column so
  // successive pairs align under each other. If the first value is long enough
  // to reach that column, fall back to a spaced separator rather than letting
  // the two collide.
  const drawPair = (left: string, right: string, size: number) => {
    const leftWidth = font.widthOfTextAtSize(left, size);
    if (leftWidth + 12 > PAIR_COLUMN) {
      draw(`${left}   —   ${right}`, size);
      return;
    }
    ensureSpace();
    page.drawText(left, { x: MARGIN, y: y - size, size, font });
    page.drawText(right, { x: MARGIN + PAIR_COLUMN, y: y - size, size, font });
    y -= LINE_HEIGHT;
  };

  // A side's measurements read as one inline sentence-style row —
  // "- Droite : IMT : 0.62 mm. Ratio ACI/ACC : 1.8" — rather than as a
  // side-by-side column pair. A side with nothing measured prints nothing.
  const sidePart = (
    label: string,
    value: string | number | null,
    unit = "",
  ): string | null =>
    value === null || value === "" ? null : `${label} : ${value}${unit}`;

  const drawSideRow = (side: string, parts: (string | null)[]) => {
    const measured = parts.filter((part): part is string => part !== null);
    if (measured.length === 0) return;
    drawWrapped(`${BULLET} ${side} : ${measured.join(". ")}`, 10, INDENT_2);
  };

  // pdf-lib draws one font per drawText call, so a line that is part bold and
  // part regular has to be composed by hand: draw the bold prefix, measure it,
  // then continue in the regular font at that offset.
  const drawInlineBold = (prefix: string, rest: string, indent: number) => {
    const size = 10;
    const prefixWidth = boldFont.widthOfTextAtSize(`${prefix} `, size);
    const restX = MARGIN + indent + prefixWidth;
    const restWidth = PAGE_WIDTH - MARGIN - restX;
    const measure = (line: string) => font.widthOfTextAtSize(line, size);
    const [firstLine, ...moreLines] = wrapText(measure, restWidth, rest);

    ensureSpace();
    page.drawText(prefix, {
      x: MARGIN + indent,
      y: y - size,
      size,
      font: boldFont,
    });
    if (firstLine) {
      page.drawText(firstLine, { x: restX, y: y - size, size, font });
    }
    y -= LINE_HEIGHT;

    // Continuation lines align under the remainder, not under the bold name.
    for (const line of moreLines) {
      ensureSpace();
      page.drawText(line, { x: restX, y: y - size, size, font });
      y -= LINE_HEIGHT;
    }
  };

  // Letterhead: doctor identity block on the left, clinic address on the
  // right (see example-reports/Echodoppler_plan.pdf) — two independent
  // column cursors, reconciled back into the shared `y` afterwards.
  let leftY = y;
  const drawLeft = (text: string, size: number, useBold = false) => {
    page.drawText(text, {
      x: MARGIN,
      y: leftY - size,
      size,
      font: useBold ? boldFont : font,
    });
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
    drawLeft(settings.doctor_name, LETTERHEAD_SIZE);
    drawLeft("Écho-Doppler Vasculaire", LETTERHEAD_SIZE);
  } else {
    drawLeft("Cabinet d'écho-Doppler vasculaire", LETTERHEAD_SIZE);
  }
  const measureLetterhead = (line: string) =>
    font.widthOfTextAtSize(line, LETTERHEAD_SIZE);
  const addressLines = settings.address
    ? wrapText(
        measureLetterhead,
        ADDRESS_COLUMN_WIDTH,
        `Adresse : ${settings.address}`,
      )
    : [];

  // Membership, RPPS and Adeli share one line to keep the letterhead compact.
  // Any of the three may be unset, so empties drop out rather than leaving a
  // dangling separator.
  const credentials = [
    settings.professional_membership,
    settings.rpps_number && `RPPS : ${settings.rpps_number}`,
    settings.adeli_number && `N° Adeli : ${settings.adeli_number}`,
  ].filter((part): part is string => Boolean(part));
  if (credentials.length > 0) {
    // The address is right-aligned from the top, so it only steals width on the
    // rows it actually occupies. Reserving its column on every row wrapped this
    // line early and stranded "RPPS :" from its number; only narrow it when the
    // address really does reach this far down.
    const addressBottom = y - addressLines.length * LINE_HEIGHT;
    const width =
      leftY > addressBottom ? LETTERHEAD_COLUMN_WIDTH : PAGE_WIDTH - MARGIN * 2;
    for (const line of wrapText(
      measureLetterhead,
      width,
      credentials.join(CREDENTIAL_SEPARATOR),
    )) {
      drawLeft(line, LETTERHEAD_SIZE);
    }
  }

  if (addressLines.length > 0) {
    for (const line of addressLines) {
      drawRight(line, LETTERHEAD_SIZE);
    }
  }

  y = Math.min(leftY, rightY);
  y -= LINE_HEIGHT;

  // The identity reads as one sentence rather than a headed block of
  // label/value lines — it labels itself, so it needs no "Identité du patient"
  // heading above it, and it is not bold.
  drawWrapped(
    `Patient(e) : ${patientIdentity}, né(e) le ${formatDateFR(patient.dob)}` +
      ` de sexe ${sexLabel(patient.sex)}`,
    10,
  );
  // The referring physician belongs with the patient's identity, not with the
  // exam metadata. Still backed by `reports.correspondant_dossier`.
  drawField("Médecin correspondant", report.correspondant_dossier || null);
  y -= LINE_HEIGHT / 2;

  drawHeading(
    "Compte rendu : Echodoppler des TSA, de la aorte abdominal, et des membres inférieurs et IPS",
    SECTION_HEADING_SIZE,
  );
  drawPair(
    `Date de l'examen : ${formatDateFR(report.exam_date)}`,
    `Médecin : ${report.doctor_name}`,
    10,
  );
  y -= LINE_HEIGHT / 2;

  drawHeading("INDICATION", SECTION_HEADING_SIZE);
  if (report.indication.trim().length > 0) {
    drawWrapped(report.indication, 10);
  }
  // Inline "label : a, b, c" rather than a bulleted column — the doctor reads
  // this as one line of history, not as a checklist.
  const activeRiskFactors = RISK_FACTOR_KEYS.filter(
    (key) => riskFactors?.[key] === 1,
  );
  const riskFactorList =
    activeRiskFactors.length === 0
      ? "Aucun antécédent renseigné."
      : activeRiskFactors.map((key) => RISK_FACTOR_LABELS[key]).join(", ");
  drawWrapped(`Bilan vasculaire : ${riskFactorList}`, 10);
  y -= LINE_HEIGHT / 2;

  drawHeading("TECHNIQUE", SECTION_HEADING_SIZE);
  drawWrapped(buildTechniqueParagraph(settings), 10);
  y -= LINE_HEIGHT / 2;

  drawHeading("RÉSULTATS", SECTION_HEADING_SIZE);

  // A region the doctor did not examine is omitted entirely — header, fields
  // and its "Repères" boilerplate — so the report only carries what was done.
  const hasValue = (value: string | number | null) =>
    value !== null && value !== "";
  const tsaHasSides =
    hasValue(report.tsa_imt_gauche) ||
    hasValue(report.tsa_imt_droit) ||
    hasValue(report.tsa_aci_acc_ratio_gauche) ||
    hasValue(report.tsa_aci_acc_ratio_droit);
  const tsaHasContent =
    tsaHasSides || report.tsa_findings_text.trim().length > 0;
  // `aorte_anevrisme` / `aorte_anevrisme_diametre_mm` are retired: no longer
  // printed, so they can't make a section worth showing either — a report
  // carrying only those would render an empty header plus a reference note.
  const aorteHasContent =
    hasValue(report.aorte_diametre) || report.aorte_findings_text.trim().length > 0;
  const ipsBySide = {
    droite: report.mi_ips_droit,
    gauche: report.mi_ips_gauche,
  } as const;

  const sideHasContent = (side: (typeof MI_SIDES)[number]) =>
    hasValue(ipsBySide[side]) ||
    MI_ARTERY_KEYS.some((artery) => report.arteres[side]?.[artery] !== undefined);

  const miHasContent =
    MI_SIDES.some(sideHasContent) || report.mi_findings_text.trim().length > 0;

  if (!tsaHasContent && !aorteHasContent && !miHasContent) {
    draw("Aucun résultat renseigné.", 10, false, INDENT_1);
    y -= LINE_HEIGHT / 2;
  }

  if (tsaHasContent) {
    drawHeading(REPORT_SECTION_LABELS.tsa, SUBSECTION_HEADING_SIZE, INDENT_1);
    if (tsaHasSides) {
      drawSideRow("Droite", [
        sidePart("IMT", report.tsa_imt_droit, " mm"),
        sidePart("Ratio ACI/ACC", report.tsa_aci_acc_ratio_droit),
      ]);
      drawSideRow("Gauche", [
        sidePart("IMT", report.tsa_imt_gauche, " mm"),
        sidePart("Ratio ACI/ACC", report.tsa_aci_acc_ratio_gauche),
      ]);
    }
    if (report.tsa_findings_text.trim().length > 0) {
      drawWrapped(report.tsa_findings_text, 10, INDENT_1);
    }
    drawWrapped(TSA_REFERENCE_NOTE, 8, INDENT_1, NOTE_LINE_HEIGHT);
    y -= LINE_HEIGHT / 2;
  }

  if (aorteHasContent) {
    drawHeading(
      REPORT_SECTION_LABELS.aorte_abdominale,
      SUBSECTION_HEADING_SIZE,
      INDENT_1,
    );
    // The band is derived from the measurement itself, so the aorta reads as a
    // single line: no "Anévrisme : Oui/Non" tick and no separate aneurysm
    // diameter — when there is an aneurysm, this measurement *is* its diameter.
    drawField(
      "Diamètre antéro-postérieur",
      report.aorte_diametre
        ? `${formatAorteDiametre(report.aorte_diametre)} (${classifyAorteDiameter(report.aorte_diametre)})`
        : null,
      INDENT_1,
    );
    if (report.aorte_findings_text.trim().length > 0) {
      drawWrapped(report.aorte_findings_text, 10, INDENT_1);
    }
    drawWrapped(AORTE_REFERENCE_NOTE, 8, INDENT_1, NOTE_LINE_HEIGHT);
    y -= LINE_HEIGHT / 2;
  }

  if (miHasContent) {
    drawHeading(
      REPORT_SECTION_LABELS.membres_inferieurs,
      SUBSECTION_HEADING_SIZE,
      INDENT_1,
    );
    for (const side of MI_SIDES) {
      if (!sideHasContent(side)) continue;
      // Unlike drawSideRow (still used by TSA), this header must print even
      // when there is no IPS: the artery rows that follow are only
      // attributable to this side because of this header. Losing it (e.g. an
      // IPS-only early return) would let a left-leg artery row render
      // directly under the right-leg heading — the most safety-critical
      // mislabelling this section can produce.
      const ips = sidePart("IPS", ipsBySide[side]);
      drawWrapped(
        `${BULLET} ${MI_SIDE_LABELS[side]} :${ips ? ` ${ips}` : ""}`,
        10,
        INDENT_2,
      );
      for (const artery of MI_ARTERY_KEYS) {
        const entry = report.arteres[side]?.[artery];
        if (!entry) continue;
        const flux = fluxForSpectre(entry.spectre);
        const parts = [
          sidePart("VSM", entry.vsm, " cm/s"),
          sidePart("Spectre", entry.spectre),
          flux === null ? null : `Flux : ${flux}`,
        ].filter((part): part is string => part !== null);
        if (parts.length === 0) continue;
        drawInlineBold(
          `${BULLET} ${MI_ARTERY_LABELS[artery]}`,
          parts.join(". "),
          INDENT_3,
        );
      }
    }
    if (report.mi_findings_text.trim().length > 0) {
      drawWrapped(report.mi_findings_text, 10, INDENT_1);
    }
    drawWrapped(MI_REFERENCE_NOTE, 8, INDENT_1, NOTE_LINE_HEIGHT);
    y -= LINE_HEIGHT / 2;
  }

  drawHeading("CONCLUSION", SECTION_HEADING_SIZE);
  if (report.conclusion.trim().length > 0) {
    drawWrapped(report.conclusion, 10);
  } else {
    draw("Non renseignée.", 10);
  }

  // Page numbers can only be stamped once the total is known, so this is a
  // second pass. A one-page report gets no "Page 1/1" noise.
  const pages = doc.getPages();
  if (pages.length > 1) {
    pages.forEach((stampedPage, index) => {
      const label = `Page ${index + 1}/${pages.length}`;
      const width = font.widthOfTextAtSize(label, FOOTER_SIZE);
      stampedPage.drawText(label, {
        x: PAGE_WIDTH - MARGIN - width,
        y: FOOTER_BASELINE,
        size: FOOTER_SIZE,
        font,
      });
    });
  }

  // Metadata: these files are archived on the clinic LAN, where the viewer tab
  // and the file manager only ever show what is set here.
  doc.setTitle(
    `Compte rendu Écho-Doppler — ${patientIdentity} — ${formatDateFR(report.exam_date)}`,
  );
  doc.setAuthor(report.doctor_name);
  doc.setSubject("Compte rendu d'examen Écho-Doppler vasculaire artériel");
  doc.setCreator("DocDoppler");
  doc.setProducer("DocDoppler");
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());

  // useObjectStreams: false — pdf-lib defaults to compressed cross-reference
  // streams (PDF 1.5+), which pdf-parse's bundled pdf.js (v1.10.100, a much
  // older release) intermittently fails to parse ("Invalid PDF structure").
  // Classic xref tables are readable by both.
  return doc.save({ useObjectStreams: false });
}
