import type Database from "better-sqlite3";
import {
  insertArteries,
  getArteriesForReport,
  getArteriesForReports,
  type ArteriesBySide,
} from "./arteries.js";

export interface ReportRow {
  id: number;
  patient_id: number;
  doctor_name: string;
  exam_date: string;
  correspondant_dossier: string;
  indication: string;
  tsa_imt_droit: number | null;
  tsa_imt_gauche: number | null;
  tsa_aci_acc_ratio_droit: number | null;
  tsa_aci_acc_ratio_gauche: number | null;
  tsa_findings_text: string;
  aorte_diametre: string;
  aorte_anevrisme: number;
  aorte_anevrisme_diametre_mm: number | null;
  aorte_findings_text: string;
  mi_pression_cheville_droite: number | null;
  mi_pression_cheville_gauche: number | null;
  mi_pression_bras_droit: number | null;
  mi_pression_bras_gauche: number | null;
  mi_ips_droit: number | null;
  mi_ips_gauche: number | null;
  mi_findings_text: string;
  conclusion: string;
  created_at: string;
}

export interface CreateReportInput {
  doctor_name: string;
  exam_date: string;
  correspondant_dossier: string;
  indication: string;
  tsa_imt_droit: number | null;
  tsa_imt_gauche: number | null;
  tsa_aci_acc_ratio_droit: number | null;
  tsa_aci_acc_ratio_gauche: number | null;
  tsa_findings_text: string;
  aorte_diametre: string;
  aorte_anevrisme: boolean;
  aorte_anevrisme_diametre_mm: number | null;
  aorte_findings_text: string;
  mi_pression_cheville_droite: number | null;
  mi_pression_cheville_gauche: number | null;
  mi_pression_bras_droit: number | null;
  mi_pression_bras_gauche: number | null;
  mi_findings_text: string;
  mi_arteres: ArteriesBySide;
  conclusion: string;
}

export interface ReportWithArteries extends ReportRow {
  arteres: ArteriesBySide;
}

/**
 * What a list view needs and nothing more. The patient file's history panel
 * renders an exam date, a creation date and a PDF link per row, so it must
 * not drag every finding — nor the per-artery child rows — across the wire.
 * `getReport` still serves the full shape for the PDF and the report builder.
 */
export interface ReportSummaryRow {
  id: number;
  patient_id: number;
  exam_date: string;
  created_at: string;
}

export interface ReportListOptions {
  limit: number;
  offset: number;
}

// IPS = pression systolique cheville / pression brachiale de référence (la
// plus élevée des deux bras, même dénominateur pour les deux côtés) — formule
// confirmée par le médecin le 2026-08-21, voir docs/report-module.md.
function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeIps(
  presssionCheville: number | null,
  bras1: number | null,
  bras2: number | null,
): number | null {
  if (presssionCheville === null || bras1 === null || bras2 === null) {
    return null;
  }
  return roundTo2(presssionCheville / Math.max(bras1, bras2));
}

export function createReport(
  db: Database.Database,
  patientId: number,
  input: CreateReportInput,
): ReportWithArteries {
  const ipsDroit = computeIps(
    input.mi_pression_cheville_droite,
    input.mi_pression_bras_droit,
    input.mi_pression_bras_gauche,
  );
  const ipsGauche = computeIps(
    input.mi_pression_cheville_gauche,
    input.mi_pression_bras_droit,
    input.mi_pression_bras_gauche,
  );

  const insert = db.transaction((): number => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO reports (
          patient_id, doctor_name, exam_date, correspondant_dossier, indication,
          tsa_imt_droit, tsa_imt_gauche, tsa_aci_acc_ratio_droit, tsa_aci_acc_ratio_gauche, tsa_findings_text,
          aorte_diametre, aorte_anevrisme, aorte_anevrisme_diametre_mm, aorte_findings_text,
          mi_pression_cheville_droite, mi_pression_cheville_gauche, mi_pression_bras_droit, mi_pression_bras_gauche,
          mi_ips_droit, mi_ips_gauche, mi_findings_text, conclusion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        patientId,
        input.doctor_name,
        input.exam_date,
        input.correspondant_dossier,
        input.indication,
        input.tsa_imt_droit,
        input.tsa_imt_gauche,
        input.tsa_aci_acc_ratio_droit,
        input.tsa_aci_acc_ratio_gauche,
        input.tsa_findings_text,
        input.aorte_diametre,
        input.aorte_anevrisme ? 1 : 0,
        input.aorte_anevrisme_diametre_mm,
        input.aorte_findings_text,
        input.mi_pression_cheville_droite,
        input.mi_pression_cheville_gauche,
        input.mi_pression_bras_droit,
        input.mi_pression_bras_gauche,
        ipsDroit,
        ipsGauche,
        input.mi_findings_text,
        input.conclusion,
      );
    const reportId = Number(lastInsertRowid);
    insertArteries(db, reportId, input.mi_arteres);
    return reportId;
  });

  return getReport(db, insert()) as ReportWithArteries;
}

export function getReport(
  db: Database.Database,
  id: number,
): ReportWithArteries | undefined {
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as
    | ReportRow
    | undefined;
  if (!row) return undefined;
  return { ...row, arteres: getArteriesForReport(db, id) };
}

export function listReportsByPatient(
  db: Database.Database,
  patientId: number,
): ReportWithArteries[] {
  const rows = db
    .prepare(
      "SELECT * FROM reports WHERE patient_id = ? ORDER BY created_at DESC, id DESC",
    )
    .all(patientId) as ReportRow[];
  const arteries = getArteriesForReports(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    ...row,
    arteres: arteries.get(row.id) ?? {},
  }));
}

export function listReportSummaries(
  db: Database.Database,
  patientId: number,
  { limit, offset }: ReportListOptions,
): ReportSummaryRow[] {
  return db
    .prepare(
      `SELECT id, patient_id, exam_date, created_at FROM reports
       WHERE patient_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(patientId, limit, offset) as ReportSummaryRow[];
}

export function countReportsByPatient(
  db: Database.Database,
  patientId: number,
): number {
  const row = db
    .prepare("SELECT COUNT(*) AS total FROM reports WHERE patient_id = ?")
    .get(patientId) as { total: number };
  return row.total;
}
