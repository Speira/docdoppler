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
  return db;
}

let instance: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!instance) {
    mkdirSync(path.dirname(DEFAULT_DB_PATH), { recursive: true });
    instance = createConnection(DEFAULT_DB_PATH);
  }
  return instance;
}
