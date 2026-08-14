import type Database from "better-sqlite3";

export interface ReportRow {
  id: number;
  patient_id: number;
  doctor_name: string;
  exam_date: string;
  carotide_text: string;
  carotide_abnormal: number;
  artere_membre_sup_text: string;
  artere_membre_sup_abnormal: number;
  veine_membre_sup_text: string;
  veine_membre_sup_abnormal: number;
  artere_membre_inf_text: string;
  artere_membre_inf_abnormal: number;
  veine_membre_inf_text: string;
  veine_membre_inf_abnormal: number;
  created_at: string;
}

export interface CreateReportInput {
  doctor_name: string;
  exam_date: string;
  carotide_text: string;
  carotide_abnormal: boolean;
  artere_membre_sup_text: string;
  artere_membre_sup_abnormal: boolean;
  veine_membre_sup_text: string;
  veine_membre_sup_abnormal: boolean;
  artere_membre_inf_text: string;
  artere_membre_inf_abnormal: boolean;
  veine_membre_inf_text: string;
  veine_membre_inf_abnormal: boolean;
}

export function createReport(
  db: Database.Database,
  patientId: number,
  input: CreateReportInput,
): ReportRow {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO reports (
        patient_id, doctor_name, exam_date,
        carotide_text, carotide_abnormal,
        artere_membre_sup_text, artere_membre_sup_abnormal,
        veine_membre_sup_text, veine_membre_sup_abnormal,
        artere_membre_inf_text, artere_membre_inf_abnormal,
        veine_membre_inf_text, veine_membre_inf_abnormal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      patientId,
      input.doctor_name,
      input.exam_date,
      input.carotide_text,
      input.carotide_abnormal ? 1 : 0,
      input.artere_membre_sup_text,
      input.artere_membre_sup_abnormal ? 1 : 0,
      input.veine_membre_sup_text,
      input.veine_membre_sup_abnormal ? 1 : 0,
      input.artere_membre_inf_text,
      input.artere_membre_inf_abnormal ? 1 : 0,
      input.veine_membre_inf_text,
      input.veine_membre_inf_abnormal ? 1 : 0,
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
