import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatAccessionNumber } from "./patients.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, "schema.sql");
const DEFAULT_DB_PATH =
  process.env.DB_PATH ?? path.join(__dirname, "../../data/docdoppler.sqlite3");

export function createConnection(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  ensureExamDateColumn(db);
  ensureAccessionNumberColumn(db);
  ensureSexAllowsOther(db);
  return db;
}

export function ensureExamDateColumn(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(patients)").all() as {
    name: string;
  }[];
  const hasExamDate = columns.some((column) => column.name === "exam_date");
  if (!hasExamDate) {
    // SQLite's ALTER TABLE ADD COLUMN only allows a constant literal default
    // (CURRENT_DATE and expressions are rejected), so backfill in a second step.
    // Backfilled rows get today's date (the migration date) as a placeholder,
    // not their actual historical exam date, which this schema has no record of.
    db.exec("ALTER TABLE patients ADD COLUMN exam_date TEXT NOT NULL DEFAULT ''");
    db.exec("UPDATE patients SET exam_date = CURRENT_DATE");
  }
}

export function ensureAccessionNumberColumn(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(patients)").all() as {
    name: string;
  }[];
  const hasColumn = columns.some(
    (column) => column.name === "accession_number",
  );
  if (!hasColumn) {
    db.exec(
      "ALTER TABLE patients ADD COLUMN accession_number TEXT NOT NULL DEFAULT ''",
    );
    backfillAccessionNumbers(db);
  }
}

// The patients table shipped with CHECK (sex IN ('M', 'F')). Widening it to
// include the DICOM "O" (other) code means rebuilding the table: SQLite has no
// ALTER TABLE for a CHECK constraint, and `CREATE TABLE IF NOT EXISTS` in
// schema.sql leaves an existing table's definition alone.
export function ensureSexAllowsOther(db: Database.Database): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'patients'")
    .get() as { sql: string } | undefined;
  if (!row) return;
  const check = /CHECK\s*\(\s*sex\s+IN\s*\(([^)]*)\)/i.exec(row.sql);
  if (!check || check[1].includes("'O'")) return;

  // Follow SQLite's documented table-redefinition recipe: foreign keys off
  // (children point at patients(id) and must survive the drop), copy into a new
  // table, swap the names, then put the trigger back and re-check the keys.
  db.pragma("foreign_keys = OFF");
  try {
    db.exec(`
      BEGIN;
      CREATE TABLE patients_new (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name       TEXT NOT NULL,
        last_name        TEXT NOT NULL,
        dob              TEXT NOT NULL,
        sex              TEXT NOT NULL CHECK (sex IN ('M', 'F', 'O')),
        exam_date        TEXT NOT NULL DEFAULT CURRENT_DATE,
        accession_number TEXT NOT NULL DEFAULT '',
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO patients_new
        (id, first_name, last_name, dob, sex, exam_date, accession_number, created_at, updated_at)
        SELECT id, first_name, last_name, dob, sex, exam_date, accession_number, created_at, updated_at
        FROM patients;
      DROP TABLE patients;
      ALTER TABLE patients_new RENAME TO patients;
      CREATE TRIGGER IF NOT EXISTS patients_set_updated_at
      AFTER UPDATE ON patients
      BEGIN
        UPDATE patients SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
      COMMIT;
    `);
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  } finally {
    db.pragma("foreign_keys = ON");
  }
  const violations = db.pragma("foreign_key_check") as unknown[];
  if (violations.length > 0) {
    throw new Error("Migration du sexe : contraintes de clés étrangères rompues.");
  }
}

function backfillAccessionNumbers(db: Database.Database): void {
  const rows = db
    .prepare("SELECT id, exam_date FROM patients ORDER BY exam_date, id")
    .all() as { id: number; exam_date: string }[];
  const sequenceByDate = new Map<string, number>();
  for (const row of rows) {
    const sequence = (sequenceByDate.get(row.exam_date) ?? 0) + 1;
    sequenceByDate.set(row.exam_date, sequence);
    db.prepare("UPDATE patients SET accession_number = ? WHERE id = ?").run(
      formatAccessionNumber(row.exam_date, sequence),
      row.id,
    );
  }
}

let instance: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!instance) {
    mkdirSync(path.dirname(DEFAULT_DB_PATH), { recursive: true });
    instance = createConnection(DEFAULT_DB_PATH);
  }
  return instance;
}
