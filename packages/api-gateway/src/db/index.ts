import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, "schema.sql");
const DEFAULT_DB_PATH =
  process.env.DB_PATH ?? path.join(__dirname, "../../data/docdoppler.sqlite3");

export function createConnection(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  ensureExamDateColumn(db);
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

let instance: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!instance) {
    mkdirSync(path.dirname(DEFAULT_DB_PATH), { recursive: true });
    instance = createConnection(DEFAULT_DB_PATH);
  }
  return instance;
}
