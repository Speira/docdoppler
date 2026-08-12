# DICOM Worklist Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone DICOM Modality Worklist SCP (C-ECHO + C-FIND) backed by a new read-only endpoint on the existing Express API, without wiring it into the save-patient flow.

**Architecture:** `packages/api-gateway` gains a generated `accession_number` per patient and a `GET /worklist?date=` endpoint. A new, separate Python package `packages/dicom-bridge` runs a `pynetdicom` Application Entity that answers C-ECHO directly and answers C-FIND by calling that endpoint and mapping each patient row to a DICOM dataset. The two processes only talk over that one HTTP endpoint — nothing calls the bridge from the Node app, and nothing in the existing patient-save path changes.

**Tech Stack:** TypeScript/Express/better-sqlite3/vitest (existing, `packages/api-gateway`); Python 3.10+/pynetdicom/pydicom/pytest (new, `packages/dicom-bridge`).

## Global Constraints

- Local-only, no cloud services, no internet dependency at runtime (CLAUDE.md).
- No authentication for MVP — the new `/worklist` endpoint is unauthenticated, matching every existing route.
- SQLite is the only datastore; the Python bridge never opens the `.sqlite` file itself — it only calls the Express endpoint (design decision, avoids cross-process file locking).
- Do NOT wire "save patient" to push into the worklist SCP. This module stays inert/standalone until a real on-site C-ECHO + C-FIND test against the Mindray ME8 succeeds (`docs/dicom-worklist-bridge.md`, CLAUDE.md). No task in this plan adds such wiring.
- Only two DICOM SOP classes are implemented: Verification and Modality Worklist FIND. No C-STORE, Query/Retrieve, or Print.
- `Modality` is hardcoded `"US"`; `ScheduledProcedureStepDescription` is hardcoded `"Echo Doppler Vasculaire"` (single exam type per clinic, per existing spec).
- AE title and port are configurable via environment variables, not hardcoded (both are unconfirmed against the real Mindray unit).
- This dev environment has no `pip`, `dcmtk`, or the `pynetdicom` console-script apps installed — `pip` must be bootstrapped via `python3 -m ensurepip`, and DICOM protocol tests use pynetdicom's own `AE`/`Association` client API directly rather than shelling out to `echoscu`/`findscu` binaries. Installing `pynetdicom`/`pydicom` requires the implementer's environment to have PyPI network access; if that's unavailable, Task 3 onward will fail at the `pip install` step and that failure is expected/blocking, not a bug to work around.

Reference spec: `docs/superpowers/specs/2026-08-12-dicom-worklist-bridge-design.md`.

---

### Task 1: Accession number generation + migration (`packages/api-gateway`)

**Files:**
- Modify: `packages/api-gateway/src/db/schema.sql`
- Modify: `packages/api-gateway/src/db/index.ts`
- Modify: `packages/api-gateway/src/db/patients.ts`
- Modify: `packages/api-gateway/src/db/index.test.ts`
- Modify: `packages/api-gateway/src/db/patients.test.ts`

**Interfaces:**
- Produces: `formatAccessionNumber(examDate: string, sequence: number): string` (exported from `db/patients.ts`)
- Produces: `PatientRow` gains `accession_number: string` (exported from `db/patients.ts`)
- Produces: `listPatientsByExamDate(db: Database.Database, examDate: string): PatientRow[]` (exported from `db/patients.ts`)
- Produces: `ensureAccessionNumberColumn(db: Database.Database): void` (exported from `db/index.ts`)
- Consumes: nothing new (uses existing `getPatient`, `createConnection`)

- [ ] **Step 1: Write the failing tests for accession-number generation on insert**

Add to `packages/api-gateway/src/db/patients.test.ts` (inside the existing `describe("patients data access", ...)` block, alongside the other `it(...)` cases):

```typescript
  it("generates an accession_number in YYYYMMDD-NNN format on creation", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    expect(patient.accession_number).toBe("20260812-001");
  });

  it("increments the accession_number sequence for patients sharing an exam_date", () => {
    const db = createConnection(":memory:");
    createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    const second = createPatient(db, {
      first_name: "Alice",
      last_name: "Martin",
      dob: "1980-01-01",
      sex: "F",
      exam_date: "2026-08-12",
    });
    expect(second.accession_number).toBe("20260812-002");
  });

  it("resets the accession_number sequence for a different exam_date", () => {
    const db = createConnection(":memory:");
    createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    const other = createPatient(db, {
      first_name: "Alice",
      last_name: "Martin",
      dob: "1980-01-01",
      sex: "F",
      exam_date: "2026-08-13",
    });
    expect(other.accession_number).toBe("20260813-001");
  });
```

Also add a new `describe` block for the new query function at the bottom of the same file, before the final closing `});`:

```typescript
describe("listPatientsByExamDate", () => {
  it("returns only patients matching the given exam_date, ordered by created_at", () => {
    const db = createConnection(":memory:");
    createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    createPatient(db, {
      first_name: "Other",
      last_name: "Day",
      dob: "1990-01-01",
      sex: "F",
      exam_date: "2026-08-13",
    });
    const second = createPatient(db, {
      first_name: "Alice",
      last_name: "Martin",
      dob: "1980-01-01",
      sex: "F",
      exam_date: "2026-08-12",
    });
    const rows = listPatientsByExamDate(db, "2026-08-12");
    expect(rows.map((r) => r.last_name)).toEqual(["Dupont", "Martin"]);
    expect(rows[1].id).toBe(second.id);
  });

  it("returns an empty array when no patients match", () => {
    const db = createConnection(":memory:");
    expect(listPatientsByExamDate(db, "2026-08-12")).toEqual([]);
  });
});
```

And update the import list at the top of the file to include the two new functions:

```typescript
import {
  createPatient,
  getPatient,
  listPatients,
  listPatientsByExamDate,
  updatePatient,
  deletePatient,
  createRiskFactorsEntry,
  getLatestRiskFactors,
  type CreatePatientInput,
  type RiskFactorField,
} from "./patients.js";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/api-gateway && pnpm test`
Expected: FAIL — `listPatientsByExamDate` is not exported, and `accession_number` is `undefined` on created rows.

- [ ] **Step 3: Add the `accession_number` column to the schema**

In `packages/api-gateway/src/db/schema.sql`, change the `patients` table definition (lines 1-10) so `exam_date` is followed by the new column:

```sql
CREATE TABLE IF NOT EXISTS patients (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  dob              TEXT NOT NULL,
  sex              TEXT NOT NULL CHECK (sex IN ('M', 'F')),
  exam_date        TEXT NOT NULL DEFAULT CURRENT_DATE,
  accession_number TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
```

(Only the column list changes — the trigger below it and the rest of the file are untouched.)

- [ ] **Step 4: Implement `formatAccessionNumber`, accession-number generation in `createPatient`, and `listPatientsByExamDate`**

In `packages/api-gateway/src/db/patients.ts`:

Add `accession_number: string;` to the `PatientRow` interface, right after `exam_date: string;`.

Add this new exported function near the top of the file, after the `PatientRow` interface:

```typescript
export function formatAccessionNumber(
  examDate: string,
  sequence: number,
): string {
  const datePart = examDate.replace(/-/g, "");
  const sequencePart = String(sequence).padStart(3, "0");
  return `${datePart}-${sequencePart}`;
}

function nextAccessionNumber(
  db: Database.Database,
  examDate: string,
): string {
  const rows = db
    .prepare("SELECT accession_number FROM patients WHERE exam_date = ?")
    .all(examDate) as { accession_number: string }[];
  const maxSequence = rows.reduce((max, row) => {
    const sequence = Number(row.accession_number.split("-")[1]);
    return Number.isFinite(sequence) && sequence > max ? sequence : max;
  }, 0);
  return formatAccessionNumber(examDate, maxSequence + 1);
}
```

Replace the body of `createPatient` with:

```typescript
export function createPatient(
  db: Database.Database,
  input: CreatePatientInput,
): PatientRow {
  const accessionNumber = nextAccessionNumber(db, input.exam_date);
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO patients (first_name, last_name, dob, sex, exam_date, accession_number) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.first_name,
      input.last_name,
      input.dob,
      input.sex,
      input.exam_date,
      accessionNumber,
    );
  return getPatient(db, Number(lastInsertRowid)) as PatientRow;
}
```

Add this new exported function after `listPatients`:

```typescript
export function listPatientsByExamDate(
  db: Database.Database,
  examDate: string,
): PatientRow[] {
  return db
    .prepare("SELECT * FROM patients WHERE exam_date = ? ORDER BY created_at")
    .all(examDate) as PatientRow[];
}
```

- [ ] **Step 5: Run tests to verify the new ones pass**

Run: `cd packages/api-gateway && pnpm test`
Expected: The tests from Step 1 PASS. (Migration/backfill tests from Step 6 below don't exist yet — ignore those for now.)

- [ ] **Step 6: Write the failing tests for the column migration**

Add to `packages/api-gateway/src/db/index.test.ts`, inside the existing `describe("db schema", ...)` block:

```typescript
  it("adds an accession_number column to a pre-existing patients table lacking it, backfilling per exam_date", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        dob TEXT NOT NULL,
        sex TEXT NOT NULL,
        exam_date TEXT NOT NULL
      );
    `);
    const first = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex, exam_date) VALUES (?, ?, ?, ?, ?)",
      )
      .run("Jean", "Dupont", "1958-03-12", "M", "2026-08-12");
    const second = db
      .prepare(
        "INSERT INTO patients (first_name, last_name, dob, sex, exam_date) VALUES (?, ?, ?, ?, ?)",
      )
      .run("Alice", "Martin", "1980-01-01", "F", "2026-08-12");

    ensureAccessionNumberColumn(db);

    const columns = db
      .prepare("PRAGMA table_info(patients)")
      .all()
      .map((c) => (c as { name: string }).name);
    expect(columns).toContain("accession_number");

    const firstRow = db
      .prepare("SELECT accession_number FROM patients WHERE id = ?")
      .get(first.lastInsertRowid) as { accession_number: string };
    const secondRow = db
      .prepare("SELECT accession_number FROM patients WHERE id = ?")
      .get(second.lastInsertRowid) as { accession_number: string };
    expect(firstRow.accession_number).toBe("20260812-001");
    expect(secondRow.accession_number).toBe("20260812-002");
  });

  it("is a no-op when the patients table already has accession_number", () => {
    const db = createConnection(":memory:");
    expect(() => ensureAccessionNumberColumn(db)).not.toThrow();
  });

  it("does not overwrite an existing accession_number when called again", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    ensureAccessionNumberColumn(db);
    const row = db
      .prepare("SELECT accession_number FROM patients WHERE id = ?")
      .get(patient.id) as { accession_number: string };
    expect(row.accession_number).toBe("20260812-001");
  });
```

Update the imports at the top of `index.test.ts`:

```typescript
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  createConnection,
  ensureExamDateColumn,
  ensureAccessionNumberColumn,
} from "./index.js";
import { createPatient } from "./patients.js";
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `cd packages/api-gateway && pnpm test`
Expected: FAIL — `ensureAccessionNumberColumn` is not exported.

- [ ] **Step 8: Implement `ensureAccessionNumberColumn` and wire it into `createConnection`**

In `packages/api-gateway/src/db/index.ts`, add the import:

```typescript
import { formatAccessionNumber } from "./patients.js";
```

Change `createConnection` to also call the new migration, after `ensureExamDateColumn`:

```typescript
export function createConnection(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  ensureExamDateColumn(db);
  ensureAccessionNumberColumn(db);
  return db;
}
```

Add the new exported function after `ensureExamDateColumn`:

```typescript
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
```

Note: `patients.ts` already does not import anything from `index.ts`, so this one-directional import (`index.ts` → `patients.ts`) introduces no cycle.

- [ ] **Step 9: Run all tests to verify they pass**

Run: `cd packages/api-gateway && pnpm test`
Expected: PASS — all tests in `db/index.test.ts` and `db/patients.test.ts`.

- [ ] **Step 10: Commit**

```bash
git add packages/api-gateway/src/db/schema.sql packages/api-gateway/src/db/index.ts packages/api-gateway/src/db/patients.ts packages/api-gateway/src/db/index.test.ts packages/api-gateway/src/db/patients.test.ts
git commit -m "feat: generate accession_number on patient creation"
```

---

### Task 2: `GET /worklist` endpoint (`packages/api-gateway`)

**Files:**
- Modify: `packages/api-gateway/src/validation/patients.ts`
- Create: `packages/api-gateway/src/validation/worklist.ts`
- Create: `packages/api-gateway/src/validation/worklist.test.ts`
- Create: `packages/api-gateway/src/routes/worklist.ts`
- Create: `packages/api-gateway/src/routes/worklist.test.ts`
- Modify: `packages/api-gateway/src/app.ts`

**Interfaces:**
- Consumes: `isValidIsoDate` (newly exported from `validation/patients.ts`), `listPatientsByExamDate` (Task 1, `db/patients.ts`)
- Produces: `validateWorklistQuery(query: unknown): { valid: true; date: string } | { valid: false; error: "DATE_INVALID" }` (exported from `validation/worklist.ts`)
- Produces: `createWorklistRouter(db: Database.Database): Router` (exported from `routes/worklist.ts`), mounted at `/worklist` in `app.ts`

- [ ] **Step 1: Write the failing tests for query validation**

Create `packages/api-gateway/src/validation/worklist.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { validateWorklistQuery } from "./worklist.js";

describe("validateWorklistQuery", () => {
  it("accepts a valid ISO date", () => {
    const result = validateWorklistQuery({ date: "2026-08-12" });
    expect(result).toEqual({ valid: true, date: "2026-08-12" });
  });

  it("rejects a missing date", () => {
    const result = validateWorklistQuery({});
    expect(result).toEqual({ valid: false, error: "DATE_INVALID" });
  });

  it("rejects a malformed date string", () => {
    const result = validateWorklistQuery({ date: "12/08/2026" });
    expect(result).toEqual({ valid: false, error: "DATE_INVALID" });
  });

  it("rejects a calendar-invalid date", () => {
    const result = validateWorklistQuery({ date: "2026-02-30" });
    expect(result).toEqual({ valid: false, error: "DATE_INVALID" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/api-gateway && pnpm test`
Expected: FAIL — `./worklist.js` does not exist.

- [ ] **Step 3: Export `isValidIsoDate` and implement `validateWorklistQuery`**

In `packages/api-gateway/src/validation/patients.ts`, change:

```typescript
function isValidIsoDate(value: string): boolean {
```

to:

```typescript
export function isValidIsoDate(value: string): boolean {
```

Create `packages/api-gateway/src/validation/worklist.ts`:

```typescript
import { isValidIsoDate } from "./patients.js";

export type WorklistValidationResult =
  | { valid: true; date: string }
  | { valid: false; error: "DATE_INVALID" };

export function validateWorklistQuery(
  query: unknown,
): WorklistValidationResult {
  const q = (query ?? {}) as Record<string, unknown>;
  if (typeof q.date !== "string" || !isValidIsoDate(q.date)) {
    return { valid: false, error: "DATE_INVALID" };
  }
  return { valid: true, date: q.date };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/api-gateway && pnpm test`
Expected: PASS for `validation/worklist.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/api-gateway/src/validation/patients.ts packages/api-gateway/src/validation/worklist.ts packages/api-gateway/src/validation/worklist.test.ts
git commit -m "feat: add worklist date query validation"
```

- [ ] **Step 6: Write the failing tests for the route**

Create `packages/api-gateway/src/routes/worklist.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import supertest from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createConnection } from "../db/index.js";
import { createApp } from "../app.js";

describe("GET /worklist", () => {
  let db: Database.Database;
  let app: Express;

  beforeEach(() => {
    db = createConnection(":memory:");
    app = createApp(db);
  });

  it("returns patients matching the given exam_date", async () => {
    await supertest(app).post("/patients").send({
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    await supertest(app).post("/patients").send({
      first_name: "Other",
      last_name: "Day",
      dob: "1990-01-01",
      sex: "F",
      exam_date: "2026-08-13",
    });

    const response = await supertest(app).get("/worklist?date=2026-08-12");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].last_name).toBe("Dupont");
    expect(response.body[0].accession_number).toBe("20260812-001");
  });

  it("returns an empty array when no patients match the date", async () => {
    const response = await supertest(app).get("/worklist?date=2026-08-12");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns 400 for a missing date", async () => {
    const response = await supertest(app).get("/worklist");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "DATE_INVALID" });
  });

  it("returns 400 for a malformed date", async () => {
    const response = await supertest(app).get("/worklist?date=12-08-2026");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "DATE_INVALID" });
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `cd packages/api-gateway && pnpm test`
Expected: FAIL — `GET /worklist` returns 404 (no such route yet).

- [ ] **Step 8: Implement the route and mount it**

Create `packages/api-gateway/src/routes/worklist.ts`:

```typescript
import { Router, type Request, type Response } from "express";
import type Database from "better-sqlite3";
import { listPatientsByExamDate } from "../db/patients.js";
import { validateWorklistQuery } from "../validation/worklist.js";

export function createWorklistRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    const result = validateWorklistQuery(req.query);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json(listPatientsByExamDate(db, result.date));
  });

  return router;
}
```

In `packages/api-gateway/src/app.ts`, add the import:

```typescript
import { createWorklistRouter } from "./routes/worklist.js";
```

And mount it next to the existing `/patients` mount:

```typescript
  app.use("/patients", createPatientsRouter(db));
  app.use("/worklist", createWorklistRouter(db));
```

- [ ] **Step 9: Run all tests to verify they pass**

Run: `cd packages/api-gateway && pnpm test`
Expected: PASS — full suite green.

- [ ] **Step 10: Commit**

```bash
git add packages/api-gateway/src/routes/worklist.ts packages/api-gateway/src/routes/worklist.test.ts packages/api-gateway/src/app.ts
git commit -m "feat: add GET /worklist endpoint"
```

---

### Task 3: Scaffold `packages/dicom-bridge` + config + worklist HTTP client (Python)

**Files:**
- Create: `packages/dicom-bridge/pyproject.toml`
- Create: `packages/dicom-bridge/README.md`
- Create: `packages/dicom-bridge/dicom_bridge/__init__.py`
- Create: `packages/dicom-bridge/dicom_bridge/config.py`
- Create: `packages/dicom-bridge/dicom_bridge/worklist_client.py`
- Create: `packages/dicom-bridge/tests/__init__.py`
- Create: `packages/dicom-bridge/tests/test_worklist_client.py`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `config.AE_TITLE: str`, `config.PORT: int`, `config.WORKLIST_ENDPOINT_URL: str`
- Produces: `fetch_worklist(date: str) -> list[dict]`, `WorklistClientError(Exception)` (both from `dicom_bridge/worklist_client.py`)

- [ ] **Step 1: Scaffold the package**

Check the parent directory exists:

Run: `ls /home/devkiller/Projects/sass/docdoppler/codebase/packages`
Expected: `api-gateway` and `client-secretary` listed.

Create the directory tree:

```bash
mkdir -p packages/dicom-bridge/dicom_bridge packages/dicom-bridge/tests
```

Create `packages/dicom-bridge/dicom_bridge/__init__.py` (empty file):

```python
```

Create `packages/dicom-bridge/tests/__init__.py` (empty file):

```python
```

Create `packages/dicom-bridge/pyproject.toml`:

```toml
[project]
name = "dicom-bridge"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "pynetdicom>=2.0.2",
    "pydicom>=2.4.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0.0"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]
```

Create `packages/dicom-bridge/README.md`:

```markdown
# DICOM Worklist Bridge

Standalone Modality Worklist SCP (C-ECHO + C-FIND) for the clinic's Mindray
ME8. Reads patient data from the `packages/api-gateway` Express API over
HTTP — it does not touch SQLite directly, and nothing in the main app calls
into this module. See
`docs/superpowers/specs/2026-08-12-dicom-worklist-bridge-design.md` for the
full design and `docs/dicom-worklist-bridge.md` for the Mindray-side
configuration notes.

**This module is not wired into the "save patient" flow.** That wiring is
explicitly deferred until an on-site C-ECHO and C-FIND test against the real
Mindray unit succeeds.

## Setup

```bash
cd packages/dicom-bridge
python3 -m venv .venv
.venv/bin/python -m ensurepip --upgrade
.venv/bin/pip install -e ".[dev]"
```

## Running tests

```bash
.venv/bin/pytest -v
```

## Running the bridge manually

Requires `packages/api-gateway` running (`pnpm dev`, default `http://localhost:3000`).

```bash
BRIDGE_AE_TITLE=DOCDOPPLER BRIDGE_PORT=11112 .venv/bin/python -m dicom_bridge.run
```

Environment variables (all optional, shown with their defaults):

- `BRIDGE_AE_TITLE` — AE title this SCP presents to callers (default `DOCDOPPLER`)
- `BRIDGE_PORT` — port to listen on (default `11112`)
- `BRIDGE_WORKLIST_URL` — the api-gateway worklist endpoint (default `http://localhost:3000/worklist`)

## On-site validation checklist (not yet done)

- [ ] C-ECHO from the Mindray console succeeds against this SCP
- [ ] C-FIND (Patient → Worklist) from the Mindray console returns a test patient
- [ ] Confirm whether Mindray requires a specific AE title from this SCP, or accepts any registered device
- [ ] Confirm purpose of "Param. service DICOM" / "Déf stratégie DICOM" buttons
```

Add to the repo root `.gitignore` (append, don't remove existing lines):

```
.venv/
__pycache__/
*.pyc
```

- [ ] **Step 2: Write the failing tests for the worklist HTTP client**

Create `packages/dicom-bridge/tests/test_worklist_client.py`:

```python
import json
import urllib.error
from unittest.mock import MagicMock, patch

import pytest

from dicom_bridge.worklist_client import WorklistClientError, fetch_worklist


def _fake_response(status: int, body: list) -> MagicMock:
    response = MagicMock()
    response.status = status
    response.read.return_value = json.dumps(body).encode("utf-8")
    response.__enter__.return_value = response
    response.__exit__.return_value = False
    return response


def test_fetch_worklist_returns_parsed_json():
    response = _fake_response(200, [{"id": 1, "last_name": "Dupont"}])
    with patch(
        "dicom_bridge.worklist_client.urllib.request.urlopen",
        return_value=response,
    ) as mock_urlopen:
        result = fetch_worklist("2026-08-12")

    assert result == [{"id": 1, "last_name": "Dupont"}]
    called_url = mock_urlopen.call_args[0][0]
    assert "date=2026-08-12" in called_url


def test_fetch_worklist_raises_on_non_200_status():
    response = _fake_response(500, [])
    with patch(
        "dicom_bridge.worklist_client.urllib.request.urlopen",
        return_value=response,
    ):
        with pytest.raises(WorklistClientError):
            fetch_worklist("2026-08-12")


def test_fetch_worklist_raises_on_network_error():
    with patch(
        "dicom_bridge.worklist_client.urllib.request.urlopen",
        side_effect=urllib.error.URLError("connection refused"),
    ):
        with pytest.raises(WorklistClientError):
            fetch_worklist("2026-08-12")
```

- [ ] **Step 3: Install dependencies and run tests to verify they fail**

```bash
cd packages/dicom-bridge
python3 -m venv .venv
.venv/bin/python -m ensurepip --upgrade
.venv/bin/pip install -e ".[dev]"
.venv/bin/pytest -v
```

Expected: FAIL — `dicom_bridge.worklist_client` does not exist yet.

- [ ] **Step 4: Implement `config.py` and `worklist_client.py`**

Create `packages/dicom-bridge/dicom_bridge/config.py`:

```python
import os

AE_TITLE = os.environ.get("BRIDGE_AE_TITLE", "DOCDOPPLER")
PORT = int(os.environ.get("BRIDGE_PORT", "11112"))
WORKLIST_ENDPOINT_URL = os.environ.get(
    "BRIDGE_WORKLIST_URL", "http://localhost:3000/worklist"
)
```

Create `packages/dicom-bridge/dicom_bridge/worklist_client.py`:

```python
import json
import urllib.error
import urllib.parse
import urllib.request

from . import config


class WorklistClientError(Exception):
    pass


def fetch_worklist(date: str) -> list:
    query = urllib.parse.urlencode({"date": date})
    url = f"{config.WORKLIST_ENDPOINT_URL}?{query}"
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            if response.status != 200:
                raise WorklistClientError(f"unexpected status {response.status}")
            return json.loads(response.read())
    except urllib.error.URLError as exc:
        raise WorklistClientError(str(exc)) from exc
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/dicom-bridge && .venv/bin/pytest -v`
Expected: PASS — all 3 tests in `test_worklist_client.py`.

- [ ] **Step 6: Commit**

```bash
git add packages/dicom-bridge .gitignore
git commit -m "feat: scaffold dicom-bridge package with worklist HTTP client"
```

---

### Task 4: Patient → DICOM dataset mapping (Python)

**Files:**
- Create: `packages/dicom-bridge/dicom_bridge/mapping.py`
- Create: `packages/dicom-bridge/tests/test_mapping.py`

**Interfaces:**
- Consumes: nothing (pure function over a plain `dict`)
- Produces: `patient_to_worklist_item(patient: dict) -> pydicom.dataset.Dataset` (from `dicom_bridge/mapping.py`)

- [ ] **Step 1: Write the failing test**

Create `packages/dicom-bridge/tests/test_mapping.py`:

```python
from dicom_bridge.mapping import patient_to_worklist_item


def _patient(**overrides) -> dict:
    base = {
        "id": 1,
        "first_name": "Jean",
        "last_name": "Dupont",
        "dob": "1958-03-12",
        "sex": "M",
        "exam_date": "2026-08-12",
        "accession_number": "20260812-001",
    }
    base.update(overrides)
    return base


def test_maps_patient_identity_fields():
    ds = patient_to_worklist_item(_patient())
    assert ds.PatientName == "Dupont^Jean"
    assert ds.PatientID == "1"
    assert ds.PatientBirthDate == "19580312"
    assert ds.PatientSex == "M"
    assert ds.AccessionNumber == "20260812-001"


def test_maps_scheduled_procedure_step_fields():
    ds = patient_to_worklist_item(_patient())
    step = ds.ScheduledProcedureStepSequence[0]
    assert step.ScheduledProcedureStepStartDate == "20260812"
    assert step.Modality == "US"
    assert step.ScheduledProcedureStepDescription == "Echo Doppler Vasculaire"


def test_modality_and_description_are_constant_regardless_of_input():
    ds = patient_to_worklist_item(_patient(exam_date="2026-12-25"))
    step = ds.ScheduledProcedureStepSequence[0]
    assert step.ScheduledProcedureStepStartDate == "20261225"
    assert step.Modality == "US"
    assert step.ScheduledProcedureStepDescription == "Echo Doppler Vasculaire"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dicom-bridge && .venv/bin/pytest -v`
Expected: FAIL — `dicom_bridge.mapping` does not exist.

- [ ] **Step 3: Implement `mapping.py`**

Create `packages/dicom-bridge/dicom_bridge/mapping.py`:

```python
from pydicom.dataset import Dataset


def patient_to_worklist_item(patient: dict) -> Dataset:
    dataset = Dataset()
    dataset.PatientName = f"{patient['last_name']}^{patient['first_name']}"
    dataset.PatientID = str(patient["id"])
    dataset.PatientBirthDate = patient["dob"].replace("-", "")
    dataset.PatientSex = patient["sex"]
    dataset.AccessionNumber = patient["accession_number"]

    step = Dataset()
    step.ScheduledProcedureStepStartDate = patient["exam_date"].replace("-", "")
    step.Modality = "US"
    step.ScheduledProcedureStepDescription = "Echo Doppler Vasculaire"
    dataset.ScheduledProcedureStepSequence = [step]

    return dataset
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dicom-bridge && .venv/bin/pytest -v`
Expected: PASS — all tests in `test_mapping.py`.

- [ ] **Step 5: Commit**

```bash
git add packages/dicom-bridge/dicom_bridge/mapping.py packages/dicom-bridge/tests/test_mapping.py
git commit -m "feat: map patient records to DICOM worklist datasets"
```

---

### Task 5: SCP handlers (C-ECHO + C-FIND) and entrypoint (Python)

**Files:**
- Create: `packages/dicom-bridge/dicom_bridge/scp.py`
- Create: `packages/dicom-bridge/dicom_bridge/run.py`
- Create: `packages/dicom-bridge/tests/test_scp_echo.py`
- Create: `packages/dicom-bridge/tests/test_scp_find.py`

**Interfaces:**
- Consumes: `fetch_worklist`, `WorklistClientError` (Task 3); `patient_to_worklist_item` (Task 4); `config.AE_TITLE`, `config.PORT` (Task 3)
- Produces: `handle_echo(event) -> int`, `handle_find(event) -> Generator[tuple[int, Dataset | None], None, None]`, `_extract_requested_date(identifier) -> str` (all in `dicom_bridge/scp.py`); `main() -> None` (in `dicom_bridge/run.py`)

- [ ] **Step 1: Write the failing test for C-ECHO**

Create `packages/dicom-bridge/tests/test_scp_echo.py`:

```python
from pynetdicom import AE, evt
from pynetdicom.sop_class import Verification

from dicom_bridge.scp import handle_echo


def test_echo_returns_success_status():
    server_ae = AE(ae_title="DOCDOPPLER")
    server_ae.add_supported_context(Verification)
    server = server_ae.start_server(
        ("127.0.0.1", 0),
        evt_handlers=[(evt.EVT_C_ECHO, handle_echo)],
        block=False,
    )
    port = server.server_address[1]
    try:
        client_ae = AE(ae_title="TESTCLIENT")
        client_ae.add_requested_context(Verification)
        assoc = client_ae.associate("127.0.0.1", port, ae_title="DOCDOPPLER")
        assert assoc.is_established

        status = assoc.send_c_echo()

        assert status.Status == 0x0000
        assoc.release()
    finally:
        server.shutdown()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dicom-bridge && .venv/bin/pytest -v`
Expected: FAIL — `dicom_bridge.scp` does not exist.

- [ ] **Step 3: Implement `handle_echo`**

Create `packages/dicom-bridge/dicom_bridge/scp.py`:

```python
def handle_echo(event) -> int:
    return 0x0000
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/dicom-bridge && .venv/bin/pytest -v`
Expected: PASS — `test_scp_echo.py`.

- [ ] **Step 5: Commit**

```bash
git add packages/dicom-bridge/dicom_bridge/scp.py packages/dicom-bridge/tests/test_scp_echo.py
git commit -m "feat: implement DICOM C-ECHO handler"
```

- [ ] **Step 6: Write the failing tests for `_extract_requested_date`**

Add to `packages/dicom-bridge/tests/test_scp_find.py` (new file):

```python
import datetime

from pydicom.dataset import Dataset
from pynetdicom import AE, evt
from pynetdicom.sop_class import ModalityWorklistInformationFind

from dicom_bridge.scp import _extract_requested_date, handle_find
from dicom_bridge.worklist_client import WorklistClientError


def test_extract_requested_date_from_identifier():
    identifier = Dataset()
    step = Dataset()
    step.ScheduledProcedureStepStartDate = "20260812"
    identifier.ScheduledProcedureStepSequence = [step]

    assert _extract_requested_date(identifier) == "2026-08-12"


def test_extract_requested_date_defaults_to_today_when_absent():
    identifier = Dataset()

    assert _extract_requested_date(identifier) == datetime.date.today().isoformat()
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `cd packages/dicom-bridge && .venv/bin/pytest -v`
Expected: FAIL — `_extract_requested_date` does not exist.

- [ ] **Step 8: Implement `_extract_requested_date` and the happy-path of `handle_find`**

Add to `packages/dicom-bridge/dicom_bridge/scp.py`:

```python
import datetime

from .mapping import patient_to_worklist_item
from .worklist_client import fetch_worklist


def _extract_requested_date(identifier) -> str:
    steps = getattr(identifier, "ScheduledProcedureStepSequence", None)
    if steps:
        raw_date = getattr(steps[0], "ScheduledProcedureStepStartDate", "")
        if raw_date:
            return f"{raw_date[0:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
    return datetime.date.today().isoformat()


def handle_find(event):
    date = _extract_requested_date(event.identifier)
    patients = fetch_worklist(date)
    for patient in patients:
        yield 0xFF00, patient_to_worklist_item(patient)
```

- [ ] **Step 9: Run the date-extraction tests to verify they pass**

Run: `cd packages/dicom-bridge && .venv/bin/pytest -v`
Expected: PASS — both tests from Step 6.

- [ ] **Step 10: Write an end-to-end test for the C-FIND happy path over a real association**

This exercises `handle_find` through an actual DICOM association rather than
calling it directly, so it's a genuine addition even though the
happy-path logic underneath was already written in Step 8. Add to
`packages/dicom-bridge/tests/test_scp_find.py`:

```python
from unittest.mock import patch


def test_find_returns_matching_patients():
    fixture_patients = [
        {
            "id": 1,
            "first_name": "Jean",
            "last_name": "Dupont",
            "dob": "1958-03-12",
            "sex": "M",
            "exam_date": "2026-08-12",
            "accession_number": "20260812-001",
        }
    ]

    server_ae = AE(ae_title="DOCDOPPLER")
    server_ae.add_supported_context(ModalityWorklistInformationFind)
    server = server_ae.start_server(
        ("127.0.0.1", 0),
        evt_handlers=[(evt.EVT_C_FIND, handle_find)],
        block=False,
    )
    port = server.server_address[1]
    try:
        with patch(
            "dicom_bridge.scp.fetch_worklist", return_value=fixture_patients
        ):
            client_ae = AE(ae_title="TESTCLIENT")
            client_ae.add_requested_context(ModalityWorklistInformationFind)
            assoc = client_ae.associate("127.0.0.1", port, ae_title="DOCDOPPLER")
            assert assoc.is_established

            identifier = Dataset()
            step = Dataset()
            step.ScheduledProcedureStepStartDate = "20260812"
            identifier.ScheduledProcedureStepSequence = [step]

            matches = []
            for status, dataset in assoc.send_c_find(
                identifier, ModalityWorklistInformationFind
            ):
                if status and status.Status == 0xFF00:
                    matches.append(dataset)
            assoc.release()
    finally:
        server.shutdown()

    assert len(matches) == 1
    assert matches[0].PatientID == "1"
    assert matches[0].PatientName == "Dupont^Jean"
    assert matches[0].AccessionNumber == "20260812-001"
    assert matches[0].ScheduledProcedureStepSequence[0].Modality == "US"
```

- [ ] **Step 11: Run tests to verify this one passes**

Run: `cd packages/dicom-bridge && .venv/bin/pytest -v`
Expected: PASS — confirms `handle_find`'s happy path works over a real
association, not just at the unit level from Steps 6-9.

- [ ] **Step 12: Write the failing test for the C-FIND error path**

Add to `packages/dicom-bridge/tests/test_scp_find.py`:

```python
def test_find_returns_failure_status_when_worklist_client_errors():
    server_ae = AE(ae_title="DOCDOPPLER")
    server_ae.add_supported_context(ModalityWorklistInformationFind)
    server = server_ae.start_server(
        ("127.0.0.1", 0),
        evt_handlers=[(evt.EVT_C_FIND, handle_find)],
        block=False,
    )
    port = server.server_address[1]
    try:
        with patch(
            "dicom_bridge.scp.fetch_worklist",
            side_effect=WorklistClientError("api-gateway unreachable"),
        ):
            client_ae = AE(ae_title="TESTCLIENT")
            client_ae.add_requested_context(ModalityWorklistInformationFind)
            assoc = client_ae.associate("127.0.0.1", port, ae_title="DOCDOPPLER")
            assert assoc.is_established

            identifier = Dataset()
            step = Dataset()
            step.ScheduledProcedureStepStartDate = "20260812"
            identifier.ScheduledProcedureStepSequence = [step]

            statuses = [
                status.Status
                for status, _ in assoc.send_c_find(
                    identifier, ModalityWorklistInformationFind
                )
                if status
            ]
            assoc.release()
    finally:
        server.shutdown()

    assert 0xC000 in statuses
```

- [ ] **Step 13: Run test to verify it fails**

Run: `cd packages/dicom-bridge && .venv/bin/pytest -v`
Expected: FAIL — `handle_find` currently lets `WorklistClientError` propagate uncaught instead of yielding a failure status.

- [ ] **Step 14: Handle the error path in `handle_find`**

In `packages/dicom-bridge/dicom_bridge/scp.py`, update the import and `handle_find`:

```python
from .worklist_client import WorklistClientError, fetch_worklist
```

```python
def handle_find(event):
    date = _extract_requested_date(event.identifier)
    try:
        patients = fetch_worklist(date)
    except WorklistClientError:
        yield 0xC000, None
        return
    for patient in patients:
        yield 0xFF00, patient_to_worklist_item(patient)
```

- [ ] **Step 15: Run all tests to verify they pass**

Run: `cd packages/dicom-bridge && .venv/bin/pytest -v`
Expected: PASS — full suite green.

- [ ] **Step 16: Commit**

```bash
git add packages/dicom-bridge/dicom_bridge/scp.py packages/dicom-bridge/tests/test_scp_find.py
git commit -m "feat: implement DICOM C-FIND handler for modality worklist"
```

- [ ] **Step 17: Add the entrypoint**

Create `packages/dicom-bridge/dicom_bridge/run.py`:

```python
from pynetdicom import AE, evt
from pynetdicom.sop_class import ModalityWorklistInformationFind, Verification

from . import config
from .scp import handle_echo, handle_find


def main() -> None:
    ae = AE(ae_title=config.AE_TITLE)
    ae.add_supported_context(Verification)
    ae.add_supported_context(ModalityWorklistInformationFind)

    handlers = [
        (evt.EVT_C_ECHO, handle_echo),
        (evt.EVT_C_FIND, handle_find),
    ]

    print(
        f"DICOM Worklist Bridge listening on port {config.PORT}, "
        f"AE title {config.AE_TITLE}"
    )
    ae.start_server(("0.0.0.0", config.PORT), evt_handlers=handlers, block=True)


if __name__ == "__main__":
    main()
```

This file wires together `scp.py`'s already-tested handlers and isn't independently unit-testable (it blocks forever running the server) — that's expected; its correctness rests entirely on the tests already covering `handle_echo` and `handle_find`.

- [ ] **Step 18: Manually smoke-test the entrypoint starts without error**

With `packages/api-gateway` running in one terminal (`cd packages/api-gateway && pnpm dev`), run in another:

```bash
cd packages/dicom-bridge
timeout 3 .venv/bin/python -m dicom_bridge.run; echo "exit code: $?"
```

Expected: prints `DICOM Worklist Bridge listening on port 11112, AE title DOCDOPPLER`, then exits via the timeout (exit code 124) rather than crashing immediately with a Python traceback.

- [ ] **Step 19: Commit**

```bash
git add packages/dicom-bridge/dicom_bridge/run.py
git commit -m "feat: add dicom-bridge entrypoint"
```

---

## After this plan

The module exists and is fully tested against a local pynetdicom client, but per the Global Constraints above, it is **not** connected to the "save patient" flow and has **not** been tested against the real Mindray ME8. Next steps (out of scope here, tracked in `packages/dicom-bridge/README.md`'s on-site checklist and `docs/dicom-worklist-bridge.md`):

1. On-site: run `python -m dicom_bridge.run` on a machine on the clinic LAN, register it as a remote device on the Mindray console, and run C-ECHO (Verify) from the console.
2. On-site: run a real C-FIND (Patient → Worklist) against a test patient created via the secretary app.
3. Only after both succeed: revisit whether to wire patient creation to this module, in a separate spec/plan.
