# Patients + Risk Factors SQLite Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `patients` and `risk_factors` SQLite tables inside `packages/api-gateway`, with a connection module that boots the schema idempotently, and wire it into the server's startup so the real database file gets created when the app runs.

**Architecture:** A `db/schema.sql` file holds the DDL (two tables + two `updated_at` triggers + one index). A `db/index.ts` module exposes `createConnection(dbPath)` — a pure factory that opens a `better-sqlite3` connection, turns on `PRAGMA foreign_keys`, and executes `schema.sql` — plus `getDb()`, a lazy singleton that calls `createConnection()` against the real on-disk file only when the app actually needs it (so importing the module in tests never touches disk). `app.ts` calls `getDb()` once at boot.

**Tech Stack:** `better-sqlite3` (sync SQLite driver), `vitest` (test runner, added fresh — no test framework exists in this repo yet), TypeScript run directly by Node's native type-stripping (no build step, matches the existing `tsconfig.json`).

## Global Constraints

- Local-only, single SQLite file, no cloud DB, no auth (from `CLAUDE.md`).
- No ORM at this schema size (from `CLAUDE.md`).
- French UI labels are out of scope for this plan — this plan only touches `packages/api-gateway` (backend), not `packages/client-secretary`.
- Design decisions are locked in by `docs/superpowers/specs/2026-07-26-patients-risk-factors-schema-design.md` — table shapes, `better-sqlite3`, idempotent `schema.sql`, code living inside `packages/api-gateway`, integer autoincrement PKs, timestamps on both tables. Do not deviate from that spec without checking with the user first.
- `reports` table is out of scope (deferred per the spec).
- Every `git add` in this plan lists explicit file paths — never `git add -A` or `git add .` — because `packages/api-gateway/node_modules` is currently untracked and un-ignored at the repo root.

---

### Task 1: DB schema + connection module

**Files:**
- Create: `packages/api-gateway/src/db/schema.sql`
- Create: `packages/api-gateway/src/db/index.ts`
- Create: `packages/api-gateway/src/db/index.test.ts`
- Create: `packages/api-gateway/.gitignore`
- Modify: `packages/api-gateway/package.json`

**Interfaces:**
- Produces: `createConnection(dbPath: string): Database.Database` — opens a connection at `dbPath`, enables foreign keys, runs `schema.sql`, returns the connection. Used directly by tests (with `":memory:"`) and internally by `getDb()`.
- Produces: `getDb(): Database.Database` — lazy singleton over the real on-disk DB file (`packages/api-gateway/data/docdoppler.sqlite3`, overridable via `DB_PATH` env var). Task 2 calls this from `app.ts`.

- [ ] **Step 1: Add dependencies and a gitignore for the new data directory**

From `packages/api-gateway`:

```bash
cd packages/api-gateway
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3 vitest
```

Expected: both commands exit 0 and `package.json` gains `better-sqlite3` under `dependencies` and `@types/better-sqlite3` + `vitest` under `devDependencies`.

Create `packages/api-gateway/.gitignore`:

```
node_modules/
data/
```

- [ ] **Step 2: Add test and dev scripts to package.json**

Edit `packages/api-gateway/package.json`. Leave every field `pnpm add` wrote in Step 1 untouched (dependency versions, etc.) — only replace the `"scripts"` block's contents with:

```json
  "scripts": {
    "dev": "node --watch src/app.ts",
    "test": "vitest run"
  },
```

This replaces the old placeholder `"test": "echo \"Error: no test specified\" && exit 1"` line and adds the new `dev` script.

- [ ] **Step 3: Write the failing tests**

Create `packages/api-gateway/src/db/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createConnection } from "./index.js";

describe("db schema", () => {
  it("creates the patients and risk_factors tables", () => {
    const db = createConnection(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(tables).toContain("patients");
    expect(tables).toContain("risk_factors");
  });

  it("enforces foreign keys", () => {
    const db = createConnection(":memory:");
    const fkStatus = db.pragma("foreign_keys", { simple: true });
    expect(fkStatus).toBe(1);
  });

  it("rejects an invalid sex value", () => {
    const db = createConnection(":memory:");
    expect(() =>
      db
        .prepare(
          "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
        )
        .run("Jean", "Dupont", "1958-03-12", "X"),
    ).toThrow(/CHECK constraint failed/);
  });

  it("inserts a patient with valid data and defaults timestamps", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    const patient = db
      .prepare("SELECT * FROM patients WHERE id = ?")
      .get(lastInsertRowid) as Record<string, unknown>;
    expect(patient.first_name).toBe("Jean");
    expect(patient.created_at).toBeTruthy();
    expect(patient.updated_at).toBeTruthy();
  });

  it("bumps updated_at on patient update", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    const before = (
      db
        .prepare("SELECT updated_at FROM patients WHERE id = ?")
        .get(lastInsertRowid) as { updated_at: string }
    ).updated_at;
    db.prepare("UPDATE patients SET first_name = ? WHERE id = ?").run(
      "Jeanne",
      lastInsertRowid,
    );
    const after = (
      db
        .prepare("SELECT updated_at FROM patients WHERE id = ?")
        .get(lastInsertRowid) as { updated_at: string }
    ).updated_at;
    expect(after >= before).toBe(true);
  });

  it("links multiple dated risk_factors rows to a patient", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid: patientId } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    db.prepare(
      "INSERT INTO risk_factors (patient_id, diabetes, hypertension) VALUES (?, ?, ?)",
    ).run(patientId, 1, 0);
    db.prepare(
      "INSERT INTO risk_factors (patient_id, diabetes, hypertension) VALUES (?, ?, ?)",
    ).run(patientId, 1, 1);
    const rows = db
      .prepare("SELECT * FROM risk_factors WHERE patient_id = ?")
      .all(patientId);
    expect(rows).toHaveLength(2);
  });

  it("cascades delete from patients to risk_factors", () => {
    const db = createConnection(":memory:");
    const { lastInsertRowid: patientId } = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex) VALUES (?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M");
    db.prepare("INSERT INTO risk_factors (patient_id) VALUES (?)").run(
      patientId,
    );
    db.prepare("DELETE FROM patients WHERE id = ?").run(patientId);
    const rows = db
      .prepare("SELECT * FROM risk_factors WHERE patient_id = ?")
      .all(patientId);
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

From `packages/api-gateway`:

```bash
pnpm test
```

Expected: FAIL — `Cannot find module './index.js'` (or similar), since `db/index.ts` and `db/schema.sql` don't exist yet.

- [ ] **Step 5: Create the schema**

Create `packages/api-gateway/src/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS patients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  dob        TEXT NOT NULL,
  sex        TEXT NOT NULL CHECK (sex IN ('M', 'F')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS patients_set_updated_at
AFTER UPDATE ON patients
BEGIN
  UPDATE patients SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS risk_factors (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id    INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  diabetes      INTEGER NOT NULL DEFAULT 0 CHECK (diabetes IN (0, 1)),
  hypertension  INTEGER NOT NULL DEFAULT 0 CHECK (hypertension IN (0, 1)),
  cholesterol   INTEGER NOT NULL DEFAULT 0 CHECK (cholesterol IN (0, 1)),
  obesity       INTEGER NOT NULL DEFAULT 0 CHECK (obesity IN (0, 1)),
  vertigo       INTEGER NOT NULL DEFAULT 0 CHECK (vertigo IN (0, 1)),
  carotid_bruit INTEGER NOT NULL DEFAULT 0 CHECK (carotid_bruit IN (0, 1)),
  avc           INTEGER NOT NULL DEFAULT 0 CHECK (avc IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS risk_factors_set_updated_at
AFTER UPDATE ON risk_factors
BEGIN
  UPDATE risk_factors SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_risk_factors_patient_id ON risk_factors(patient_id);
```

- [ ] **Step 6: Write the connection module**

Create `packages/api-gateway/src/db/index.ts`:

```ts
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
```

- [ ] **Step 7: Run the tests to verify they pass**

From `packages/api-gateway`:

```bash
pnpm test
```

Expected: PASS — all 7 tests in `src/db/index.test.ts` green. No file is created under `data/` by this run, since every test uses `createConnection(":memory:")` and `getDb()` is never called.

- [ ] **Step 8: Commit**

From the repository root:

```bash
git add packages/api-gateway/package.json packages/api-gateway/pnpm-lock.yaml \
  packages/api-gateway/.gitignore packages/api-gateway/src/db/schema.sql \
  packages/api-gateway/src/db/index.ts packages/api-gateway/src/db/index.test.ts
git commit -m "Add patients + risk_factors SQLite schema and connection module"
```

---

### Task 2: Wire the database into server boot

**Files:**
- Modify: `packages/api-gateway/src/app.ts`

**Interfaces:**
- Consumes: `getDb(): Database.Database` from `./db/index.js` (Task 1).

- [ ] **Step 1: Call getDb() at boot**

Modify `packages/api-gateway/src/app.ts`:

```ts
import express, { type Express, type Request, type Response } from "express";
import { getDb } from "./db/index.js";

const app: Express = express();

getDb();

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

app.listen(3000);
```

- [ ] **Step 2: Verify the server boots and creates the real database file**

From `packages/api-gateway`:

```bash
rm -f data/docdoppler.sqlite3
pnpm dev &
sleep 1
curl -s http://localhost:3000/
ls -la data/docdoppler.sqlite3
kill %1
```

Expected: `curl` prints `Hello World!`, `ls` shows `data/docdoppler.sqlite3` exists (non-zero size), and no errors are printed by `pnpm dev` in the background output.

- [ ] **Step 3: Commit**

From the repository root:

```bash
git add packages/api-gateway/src/app.ts
git commit -m "Initialize the SQLite database on server boot"
```
