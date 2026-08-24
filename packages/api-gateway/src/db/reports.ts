import type Database from "better-sqlite3";

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
  conclusion: string;
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
): ReportRow {
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
  return getReport(db, Number(lastInsertRowid)) as ReportRow;
}

export function getReport(db: Database.Database, id: number): ReportRow | undefined {
  return db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as
    | ReportRow
    | undefined;
}

export function listReportsByPatient(
  db: Database.Database,
  patientId: number,
): ReportRow[] {
  return db
    .prepare(
      "SELECT * FROM reports WHERE patient_id = ? ORDER BY created_at DESC, id DESC",
    )
    .all(patientId) as ReportRow[];
}
