import type Database from "better-sqlite3";

export const RISK_FACTOR_FIELDS = [
  "diabetes",
  "hypertension",
  "cholesterol",
  "obesity",
  "vertigo",
  "carotid_bruit",
  "avc",
  "smoking",
] as const;

export type RiskFactorField = (typeof RISK_FACTOR_FIELDS)[number];

const PATIENT_FIELDS = ["first_name", "last_name", "dob", "sex"] as const;

export interface PatientRow {
  id: number;
  first_name: string;
  last_name: string;
  dob: string;
  sex: "M" | "F";
  created_at: string;
  updated_at: string;
}

export interface RiskFactorsRow {
  id: number;
  patient_id: number;
  diabetes: number;
  hypertension: number;
  cholesterol: number;
  obesity: number;
  vertigo: number;
  carotid_bruit: number;
  avc: number;
  smoking: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePatientInput {
  first_name: string;
  last_name: string;
  dob: string;
  sex: "M" | "F";
}

export function createPatient(
  db: Database.Database,
  input: CreatePatientInput,
): PatientRow {
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
    )
    .run(input.first_name, input.last_name, input.dob, input.sex);
  return getPatient(db, Number(lastInsertRowid)) as PatientRow;
}

export function getPatient(
  db: Database.Database,
  id: number,
): PatientRow | undefined {
  return db.prepare("SELECT * FROM patients WHERE id = ?").get(id) as
    | PatientRow
    | undefined;
}

export function listPatients(db: Database.Database): PatientRow[] {
  return db
    .prepare("SELECT * FROM patients ORDER BY last_name, first_name")
    .all() as PatientRow[];
}

export function updatePatient(
  db: Database.Database,
  id: number,
  input: Partial<CreatePatientInput>,
): PatientRow | undefined {
  const existing = getPatient(db, id);
  if (!existing) return undefined;

  const fields = (Object.keys(input) as (keyof CreatePatientInput)[]).filter(
    (field) => (PATIENT_FIELDS as readonly string[]).includes(field),
  );
  if (fields.length === 0) return existing;

  const assignments = fields.map((field) => `${field} = ?`).join(", ");
  const values = fields.map((field) => input[field]);
  db.prepare(`UPDATE patients SET ${assignments} WHERE id = ?`).run(
    ...values,
    id,
  );
  return getPatient(db, id);
}

export function getLatestRiskFactors(
  db: Database.Database,
  patientId: number,
): RiskFactorsRow | undefined {
  return db
    .prepare(
      "SELECT * FROM risk_factors WHERE patient_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
    )
    .get(patientId) as RiskFactorsRow | undefined;
}

export function createRiskFactorsEntry(
  db: Database.Database,
  patientId: number,
  input: Partial<Record<RiskFactorField, boolean>>,
): RiskFactorsRow {
  const fields = (Object.keys(input) as RiskFactorField[]).filter((field) =>
    (RISK_FACTOR_FIELDS as readonly string[]).includes(field),
  );
  const columns = ["patient_id", ...fields];
  const placeholders = columns.map(() => "?").join(", ");
  const values = [patientId, ...fields.map((field) => (input[field] ? 1 : 0))];

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO risk_factors (${columns.join(", ")}) VALUES (${placeholders})`,
    )
    .run(...values);

  return db
    .prepare("SELECT * FROM risk_factors WHERE id = ?")
    .get(lastInsertRowid) as RiskFactorsRow;
}
