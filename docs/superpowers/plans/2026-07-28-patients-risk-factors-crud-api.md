# Patients + Risk Factors CRUD API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing `patients`/`risk_factors` SQLite schema over HTTP in `packages/api-gateway`: create/read/update a patient, list patients, and append a dated risk-factors entry.

**Architecture:** A data-access module (`db/patients.ts`) wraps raw `better-sqlite3` queries; a validation module (`validation/patients.ts`) turns request bodies into either validated data or an error code; an Express router (`routes/patients.ts`) wires HTTP to the two. `app.ts` becomes a `createApp(db)` factory (currently it calls `app.listen()` at import time, which makes it untestable) so routes can be exercised with `supertest` against an in-memory DB, with a new `server.ts` as the real entry point.

**Tech Stack:** Node/Express 5, TypeScript, `better-sqlite3`, `vitest`, `supertest` (new devDependency).

## Global Constraints

- Local-only, no cloud services, no external APIs at runtime.
- No authentication for MVP.
- SQLite only, no ORM.
- API error responses are `{ "error": "CODE_NAME" }` — upper-snake-case codes, no message text, no French. The frontend maps codes to French labels. The closed set of codes for this slice: `FIRST_NAME_REQUIRED`, `LAST_NAME_REQUIRED`, `DOB_REQUIRED`, `DOB_INVALID`, `DOB_IN_FUTURE`, `SEX_REQUIRED`, `SEX_INVALID`, `PATIENT_NOT_FOUND`, `RISK_FACTOR_VALUE_INVALID`.
- `sex` uses internal codes `M`/`F` (matches the DB `CHECK` constraint); French translation ("Homme"/"Femme") happens in the frontend, not here.
- Risk factors are append-only history: no update/delete endpoint for a past entry.
- Patient updates are partial (only send fields that changed).
- Out of scope for this slice: deleting a patient, editing/deleting a past risk-factors entry, listing full risk-factors history, `reports` endpoints, search/filter on the patient list.

---

### Task 1: Patient + Risk-Factors Data Access

**Files:**
- Create: `packages/api-gateway/src/db/patients.ts`
- Test: `packages/api-gateway/src/db/patients.test.ts`

**Interfaces:**
- Consumes: `createConnection` from `packages/api-gateway/src/db/index.ts` (existing) — used only in the test file to get an in-memory DB.
- Produces (for later tasks):
  - `RISK_FACTOR_FIELDS: readonly ["diabetes", "hypertension", "cholesterol", "obesity", "vertigo", "carotid_bruit", "avc"]`
  - `type RiskFactorField = (typeof RISK_FACTOR_FIELDS)[number]`
  - `interface PatientRow { id: number; first_name: string; last_name: string; dob: string; sex: "M" | "F"; created_at: string; updated_at: string }`
  - `interface RiskFactorsRow { id: number; patient_id: number; diabetes: number; hypertension: number; cholesterol: number; obesity: number; vertigo: number; carotid_bruit: number; avc: number; created_at: string; updated_at: string }`
  - `interface CreatePatientInput { first_name: string; last_name: string; dob: string; sex: "M" | "F" }`
  - `createPatient(db: Database.Database, input: CreatePatientInput): PatientRow`
  - `getPatient(db: Database.Database, id: number): PatientRow | undefined`
  - `listPatients(db: Database.Database): PatientRow[]`
  - `updatePatient(db: Database.Database, id: number, input: Partial<CreatePatientInput>): PatientRow | undefined`
  - `createRiskFactorsEntry(db: Database.Database, patientId: number, input: Partial<Record<RiskFactorField, boolean>>): RiskFactorsRow`
  - `getLatestRiskFactors(db: Database.Database, patientId: number): RiskFactorsRow | undefined`

- [ ] **Step 1: Write the failing test**

Create `packages/api-gateway/src/db/patients.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createConnection } from "./index.js";
import {
  createPatient,
  getPatient,
  listPatients,
  updatePatient,
  createRiskFactorsEntry,
  getLatestRiskFactors,
} from "./patients.js";

describe("patients data access", () => {
  it("creates a patient and returns the full row", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    expect(patient.id).toBeTypeOf("number");
    expect(patient.first_name).toBe("Jean");
    expect(patient.sex).toBe("M");
    expect(patient.created_at).toBeTruthy();
  });

  it("gets a patient by id", () => {
    const db = createConnection(":memory:");
    const created = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    const found = getPatient(db, created.id);
    expect(found?.first_name).toBe("Jean");
  });

  it("returns undefined for an unknown patient id", () => {
    const db = createConnection(":memory:");
    expect(getPatient(db, 999)).toBeUndefined();
  });

  it("lists patients ordered by last name then first name", () => {
    const db = createConnection(":memory:");
    createPatient(db, {
      first_name: "Bernard",
      last_name: "Martin",
      dob: "1970-01-01",
      sex: "M",
    });
    createPatient(db, {
      first_name: "Alice",
      last_name: "Durand",
      dob: "1980-01-01",
      sex: "F",
    });
    const rows = listPatients(db);
    expect(rows.map((r) => r.last_name)).toEqual(["Durand", "Martin"]);
  });

  it("updates only the provided fields", () => {
    const db = createConnection(":memory:");
    const created = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    const updated = updatePatient(db, created.id, { first_name: "Jeanne" });
    expect(updated?.first_name).toBe("Jeanne");
    expect(updated?.last_name).toBe("Dupont");
  });

  it("returns undefined when updating an unknown patient", () => {
    const db = createConnection(":memory:");
    expect(updatePatient(db, 999, { first_name: "Jeanne" })).toBeUndefined();
  });

  it("creates a risk-factors entry with defaults for omitted fields", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    const entry = createRiskFactorsEntry(db, patient.id, { diabetes: true });
    expect(entry.diabetes).toBe(1);
    expect(entry.hypertension).toBe(0);
    expect(entry.patient_id).toBe(patient.id);
  });

  it("returns the most recently created risk-factors entry", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    createRiskFactorsEntry(db, patient.id, { diabetes: true });
    const latest = createRiskFactorsEntry(db, patient.id, {
      diabetes: false,
      hypertension: true,
    });
    const result = getLatestRiskFactors(db, patient.id);
    expect(result?.id).toBe(latest.id);
    expect(result?.hypertension).toBe(1);
  });

  it("returns undefined when a patient has no risk-factors entries", () => {
    const db = createConnection(":memory:");
    const patient = createPatient(db, {
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    expect(getLatestRiskFactors(db, patient.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api-gateway && pnpm test -- patients.test.ts`
Expected: FAIL — `./patients.js` cannot be found (module doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `packages/api-gateway/src/db/patients.ts`:

```ts
import type Database from "better-sqlite3";

export const RISK_FACTOR_FIELDS = [
  "diabetes",
  "hypertension",
  "cholesterol",
  "obesity",
  "vertigo",
  "carotid_bruit",
  "avc",
] as const;

export type RiskFactorField = (typeof RISK_FACTOR_FIELDS)[number];

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

  const fields = Object.keys(input) as (keyof CreatePatientInput)[];
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
  const fields = Object.keys(input) as RiskFactorField[];
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/api-gateway && pnpm test -- patients.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/api-gateway/src/db/patients.ts packages/api-gateway/src/db/patients.test.ts
git commit -m "Add patients/risk-factors data-access module"
```

---

### Task 2: Validation Module

**Files:**
- Create: `packages/api-gateway/src/validation/patients.ts`
- Test: `packages/api-gateway/src/validation/patients.test.ts`

**Interfaces:**
- Consumes: `RISK_FACTOR_FIELDS`, `type RiskFactorField` from `packages/api-gateway/src/db/patients.ts` (Task 1).
- Produces (for later tasks):
  - `type ValidationErrorCode = "FIRST_NAME_REQUIRED" | "LAST_NAME_REQUIRED" | "DOB_REQUIRED" | "DOB_INVALID" | "DOB_IN_FUTURE" | "SEX_REQUIRED" | "SEX_INVALID" | "RISK_FACTOR_VALUE_INVALID"`
  - `type ValidationResult<T> = { valid: true; data: T } | { valid: false; error: ValidationErrorCode }`
  - `interface CreatePatientInput { first_name: string; last_name: string; dob: string; sex: "M" | "F" }` (structurally identical to the one in `db/patients.ts`; kept separate since this one represents *validated* input)
  - `type UpdatePatientInput = Partial<CreatePatientInput>`
  - `type RiskFactorsInput = Partial<Record<RiskFactorField, boolean>>`
  - `validateCreatePatient(body: unknown): ValidationResult<CreatePatientInput>`
  - `validateUpdatePatient(body: unknown): ValidationResult<UpdatePatientInput>`
  - `validateRiskFactorsEntry(body: unknown): ValidationResult<RiskFactorsInput>`

- [ ] **Step 1: Write the failing test**

Create `packages/api-gateway/src/validation/patients.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  validateCreatePatient,
  validateUpdatePatient,
  validateRiskFactorsEntry,
} from "./patients.js";

describe("validateCreatePatient", () => {
  const valid = {
    first_name: "Jean",
    last_name: "Dupont",
    dob: "1958-03-12",
    sex: "M",
  };

  it("accepts a fully valid payload", () => {
    const result = validateCreatePatient(valid);
    expect(result.valid).toBe(true);
  });

  it("rejects a missing first_name", () => {
    const result = validateCreatePatient({ ...valid, first_name: "" });
    expect(result).toEqual({ valid: false, error: "FIRST_NAME_REQUIRED" });
  });

  it("rejects a missing last_name", () => {
    const result = validateCreatePatient({ ...valid, last_name: "" });
    expect(result).toEqual({ valid: false, error: "LAST_NAME_REQUIRED" });
  });

  it("rejects a missing dob", () => {
    const result = validateCreatePatient({ ...valid, dob: "" });
    expect(result).toEqual({ valid: false, error: "DOB_REQUIRED" });
  });

  it("rejects a malformed dob", () => {
    const result = validateCreatePatient({ ...valid, dob: "12/03/1958" });
    expect(result).toEqual({ valid: false, error: "DOB_INVALID" });
  });

  it("rejects an impossible calendar date", () => {
    const result = validateCreatePatient({ ...valid, dob: "1958-02-30" });
    expect(result).toEqual({ valid: false, error: "DOB_INVALID" });
  });

  it("rejects a dob in the future", () => {
    const result = validateCreatePatient({ ...valid, dob: "2999-01-01" });
    expect(result).toEqual({ valid: false, error: "DOB_IN_FUTURE" });
  });

  it("rejects a missing sex", () => {
    const result = validateCreatePatient({ ...valid, sex: "" });
    expect(result).toEqual({ valid: false, error: "SEX_REQUIRED" });
  });

  it("rejects an invalid sex", () => {
    const result = validateCreatePatient({ ...valid, sex: "X" });
    expect(result).toEqual({ valid: false, error: "SEX_INVALID" });
  });
});

describe("validateUpdatePatient", () => {
  it("accepts an empty payload as a no-op update", () => {
    expect(validateUpdatePatient({})).toEqual({ valid: true, data: {} });
  });

  it("accepts a single valid field", () => {
    expect(validateUpdatePatient({ first_name: "Jeanne" })).toEqual({
      valid: true,
      data: { first_name: "Jeanne" },
    });
  });

  it("rejects an empty string for a provided field", () => {
    const result = validateUpdatePatient({ first_name: "" });
    expect(result).toEqual({ valid: false, error: "FIRST_NAME_REQUIRED" });
  });

  it("rejects an invalid sex", () => {
    const result = validateUpdatePatient({ sex: "X" });
    expect(result).toEqual({ valid: false, error: "SEX_INVALID" });
  });

  it("rejects a malformed dob", () => {
    const result = validateUpdatePatient({ dob: "not-a-date" });
    expect(result).toEqual({ valid: false, error: "DOB_INVALID" });
  });
});

describe("validateRiskFactorsEntry", () => {
  it("accepts an empty payload", () => {
    expect(validateRiskFactorsEntry({})).toEqual({ valid: true, data: {} });
  });

  it("accepts a subset of boolean fields", () => {
    expect(validateRiskFactorsEntry({ diabetes: true, avc: false })).toEqual({
      valid: true,
      data: { diabetes: true, avc: false },
    });
  });

  it("rejects a non-boolean field value", () => {
    const result = validateRiskFactorsEntry({ diabetes: "yes" });
    expect(result).toEqual({
      valid: false,
      error: "RISK_FACTOR_VALUE_INVALID",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api-gateway && pnpm test -- validation/patients.test.ts`
Expected: FAIL — `./patients.js` cannot be found under `src/validation/`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/api-gateway/src/validation/patients.ts`:

```ts
import { RISK_FACTOR_FIELDS, type RiskFactorField } from "../db/patients.js";

export type ValidationErrorCode =
  | "FIRST_NAME_REQUIRED"
  | "LAST_NAME_REQUIRED"
  | "DOB_REQUIRED"
  | "DOB_INVALID"
  | "DOB_IN_FUTURE"
  | "SEX_REQUIRED"
  | "SEX_INVALID"
  | "RISK_FACTOR_VALUE_INVALID";

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: ValidationErrorCode };

export interface CreatePatientInput {
  first_name: string;
  last_name: string;
  dob: string;
  sex: "M" | "F";
}

export type UpdatePatientInput = Partial<CreatePatientInput>;

export type RiskFactorsInput = Partial<Record<RiskFactorField, boolean>>;

const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDob(dob: string): boolean {
  if (!DOB_PATTERN.test(dob)) return false;
  const [year, month, day] = dob.split("-").map(Number);
  const date = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function isDobInFuture(dob: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dob > today;
}

export function validateCreatePatient(
  body: unknown,
): ValidationResult<CreatePatientInput> {
  const b = (body ?? {}) as Record<string, unknown>;

  if (typeof b.first_name !== "string" || b.first_name.trim().length === 0) {
    return { valid: false, error: "FIRST_NAME_REQUIRED" };
  }
  if (typeof b.last_name !== "string" || b.last_name.trim().length === 0) {
    return { valid: false, error: "LAST_NAME_REQUIRED" };
  }
  if (typeof b.dob !== "string" || b.dob.trim().length === 0) {
    return { valid: false, error: "DOB_REQUIRED" };
  }
  if (!isValidDob(b.dob)) {
    return { valid: false, error: "DOB_INVALID" };
  }
  if (isDobInFuture(b.dob)) {
    return { valid: false, error: "DOB_IN_FUTURE" };
  }
  if (typeof b.sex !== "string" || b.sex.trim().length === 0) {
    return { valid: false, error: "SEX_REQUIRED" };
  }
  if (b.sex !== "M" && b.sex !== "F") {
    return { valid: false, error: "SEX_INVALID" };
  }

  return {
    valid: true,
    data: {
      first_name: b.first_name.trim(),
      last_name: b.last_name.trim(),
      dob: b.dob,
      sex: b.sex,
    },
  };
}

export function validateUpdatePatient(
  body: unknown,
): ValidationResult<UpdatePatientInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: UpdatePatientInput = {};

  if (b.first_name !== undefined) {
    if (
      typeof b.first_name !== "string" ||
      b.first_name.trim().length === 0
    ) {
      return { valid: false, error: "FIRST_NAME_REQUIRED" };
    }
    data.first_name = b.first_name.trim();
  }
  if (b.last_name !== undefined) {
    if (typeof b.last_name !== "string" || b.last_name.trim().length === 0) {
      return { valid: false, error: "LAST_NAME_REQUIRED" };
    }
    data.last_name = b.last_name.trim();
  }
  if (b.dob !== undefined) {
    if (typeof b.dob !== "string" || !isValidDob(b.dob)) {
      return { valid: false, error: "DOB_INVALID" };
    }
    if (isDobInFuture(b.dob)) {
      return { valid: false, error: "DOB_IN_FUTURE" };
    }
    data.dob = b.dob;
  }
  if (b.sex !== undefined) {
    if (b.sex !== "M" && b.sex !== "F") {
      return { valid: false, error: "SEX_INVALID" };
    }
    data.sex = b.sex;
  }

  return { valid: true, data };
}

export function validateRiskFactorsEntry(
  body: unknown,
): ValidationResult<RiskFactorsInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: RiskFactorsInput = {};

  for (const field of RISK_FACTOR_FIELDS) {
    if (b[field] !== undefined) {
      if (typeof b[field] !== "boolean") {
        return { valid: false, error: "RISK_FACTOR_VALUE_INVALID" };
      }
      data[field] = b[field] as boolean;
    }
  }

  return { valid: true, data };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/api-gateway && pnpm test -- validation/patients.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/api-gateway/src/validation/patients.ts packages/api-gateway/src/validation/patients.test.ts
git commit -m "Add patients/risk-factors validation module"
```

---

### Task 3: Testable App Factory

**Problem this fixes:** `app.ts` currently calls `app.listen(3000)` at module load time, so importing it (e.g. from a test) opens a real port and a real DB file — it can't be exercised with `supertest`. This task turns it into a `createApp(db)` factory and moves the boot-time side effect into a new `server.ts`.

**Files:**
- Modify: `packages/api-gateway/src/app.ts`
- Create: `packages/api-gateway/src/server.ts`
- Modify: `packages/api-gateway/package.json` (`dev` script, add `supertest`/`@types/supertest` devDependencies)
- Test: `packages/api-gateway/src/app.test.ts`

**Interfaces:**
- Consumes: `createConnection` from `packages/api-gateway/src/db/index.ts` (existing, test only); `getDb` from the same module (used by the new `server.ts`).
- Produces (for later tasks): `createApp(db: Database.Database): Express` — later tasks mount routers inside this function.

- [ ] **Step 1: Add supertest devDependency**

Run: `cd packages/api-gateway && pnpm add -D supertest @types/supertest`

- [ ] **Step 2: Write the failing test**

Create `packages/api-gateway/src/app.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { createConnection } from "./db/index.js";
import { createApp } from "./app.js";

describe("createApp", () => {
  it("serves the hello world root route", async () => {
    const db = createConnection(":memory:");
    const app = createApp(db);
    const response = await supertest(app).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toBe("Hello World!");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/api-gateway && pnpm test -- app.test.ts`
Expected: FAIL — `app.ts` has no exported `createApp` (current `app.ts` only builds and starts an app at module scope).

- [ ] **Step 4: Refactor app.ts and add server.ts**

Replace the contents of `packages/api-gateway/src/app.ts` with:

```ts
import express, { type Express, type Request, type Response } from "express";
import type Database from "better-sqlite3";

export function createApp(db: Database.Database): Express {
  const app: Express = express();
  app.use(express.json());

  app.get("/", (req: Request, res: Response) => {
    res.send("Hello World!");
  });

  return app;
}
```

Create `packages/api-gateway/src/server.ts`:

```ts
import { getDb } from "./db/index.js";
import { createApp } from "./app.js";

createApp(getDb()).listen(3000);
```

In `packages/api-gateway/package.json`, change the `dev` script from `"tsx watch src/app.ts"` to `"tsx watch src/server.ts"`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/api-gateway && pnpm test -- app.test.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add packages/api-gateway/src/app.ts packages/api-gateway/src/server.ts packages/api-gateway/src/app.test.ts packages/api-gateway/package.json packages/api-gateway/pnpm-lock.yaml
git commit -m "Split app.ts into a testable createApp factory and a server entry point"
```

---

### Task 4: Patients CRUD Routes

**Files:**
- Create: `packages/api-gateway/src/routes/patients.ts`
- Test: `packages/api-gateway/src/routes/patients.test.ts`
- Modify: `packages/api-gateway/src/app.ts` (mount the router)

**Interfaces:**
- Consumes:
  - From Task 1 (`db/patients.ts`): `createPatient`, `getPatient`, `listPatients`, `updatePatient`.
  - From Task 2 (`validation/patients.ts`): `validateCreatePatient`, `validateUpdatePatient`.
  - From Task 3 (`app.ts`): `createApp(db)`.
- Produces (for Task 5): `createPatientsRouter(db: Database.Database): Router`, mounted at `/patients` — Task 5 adds a route to this same router.

- [ ] **Step 1: Write the failing test**

Create `packages/api-gateway/src/routes/patients.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import supertest from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createConnection } from "../db/index.js";
import { createApp } from "../app.js";

describe("patients routes", () => {
  let db: Database.Database;
  let app: Express;

  beforeEach(() => {
    db = createConnection(":memory:");
    app = createApp(db);
  });

  describe("POST /patients", () => {
    it("creates a patient", async () => {
      const response = await supertest(app).post("/patients").send({
        first_name: "Jean",
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      expect(response.status).toBe(201);
      expect(response.body.first_name).toBe("Jean");
      expect(response.body.id).toBeTypeOf("number");
    });

    it("rejects a payload missing first_name", async () => {
      const response = await supertest(app).post("/patients").send({
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "FIRST_NAME_REQUIRED" });
    });
  });

  describe("GET /patients", () => {
    it("lists patients ordered by last name", async () => {
      await supertest(app).post("/patients").send({
        first_name: "Bernard",
        last_name: "Martin",
        dob: "1970-01-01",
        sex: "M",
      });
      await supertest(app).post("/patients").send({
        first_name: "Alice",
        last_name: "Durand",
        dob: "1980-01-01",
        sex: "F",
      });
      const response = await supertest(app).get("/patients");
      expect(response.status).toBe(200);
      expect(
        response.body.map((p: { last_name: string }) => p.last_name),
      ).toEqual(["Durand", "Martin"]);
    });
  });

  describe("GET /patients/:id", () => {
    it("returns the patient with riskFactors null when none exist", async () => {
      const created = await supertest(app).post("/patients").send({
        first_name: "Jean",
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      const response = await supertest(app).get(
        `/patients/${created.body.id}`,
      );
      expect(response.status).toBe(200);
      expect(response.body.riskFactors).toBeNull();
    });

    it("returns 404 for an unknown patient", async () => {
      const response = await supertest(app).get("/patients/999");
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "PATIENT_NOT_FOUND" });
    });

    it("returns 404 for a non-numeric id", async () => {
      const response = await supertest(app).get("/patients/not-a-number");
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "PATIENT_NOT_FOUND" });
    });
  });

  describe("PATCH /patients/:id", () => {
    it("updates only the provided fields", async () => {
      const created = await supertest(app).post("/patients").send({
        first_name: "Jean",
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      const response = await supertest(app)
        .patch(`/patients/${created.body.id}`)
        .send({ first_name: "Jeanne" });
      expect(response.status).toBe(200);
      expect(response.body.first_name).toBe("Jeanne");
      expect(response.body.last_name).toBe("Dupont");
    });

    it("returns 404 for an unknown patient", async () => {
      const response = await supertest(app)
        .patch("/patients/999")
        .send({ first_name: "Jeanne" });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "PATIENT_NOT_FOUND" });
    });

    it("returns 400 for an invalid field", async () => {
      const created = await supertest(app).post("/patients").send({
        first_name: "Jean",
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      const response = await supertest(app)
        .patch(`/patients/${created.body.id}`)
        .send({ sex: "X" });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "SEX_INVALID" });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api-gateway && pnpm test -- routes/patients.test.ts`
Expected: FAIL — `POST /patients` etc. return 404 (no router mounted yet).

- [ ] **Step 3: Write minimal implementation**

Create `packages/api-gateway/src/routes/patients.ts`:

```ts
import { Router, type Request, type Response } from "express";
import type Database from "better-sqlite3";
import {
  createPatient,
  getPatient,
  listPatients,
  updatePatient,
  getLatestRiskFactors,
} from "../db/patients.js";
import {
  validateCreatePatient,
  validateUpdatePatient,
} from "../validation/patients.js";

function parsePatientId(rawId: string): number | undefined {
  const id = Number(rawId);
  return Number.isInteger(id) ? id : undefined;
}

export function createPatientsRouter(db: Database.Database): Router {
  const router = Router();

  router.post("/", (req: Request, res: Response) => {
    const result = validateCreatePatient(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(createPatient(db, result.data));
  });

  router.get("/", (_req: Request, res: Response) => {
    res.status(200).json(listPatients(db));
  });

  router.get("/:id", (req: Request, res: Response) => {
    const id = parsePatientId(req.params.id);
    const patient = id === undefined ? undefined : getPatient(db, id);
    if (!patient) {
      res.status(404).json({ error: "PATIENT_NOT_FOUND" });
      return;
    }
    res
      .status(200)
      .json({ ...patient, riskFactors: getLatestRiskFactors(db, id as number) ?? null });
  });

  router.patch("/:id", (req: Request, res: Response) => {
    const id = parsePatientId(req.params.id);
    const result = validateUpdatePatient(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    const patient = id === undefined ? undefined : updatePatient(db, id, result.data);
    if (!patient) {
      res.status(404).json({ error: "PATIENT_NOT_FOUND" });
      return;
    }
    res.status(200).json(patient);
  });

  return router;
}
```

`getLatestRiskFactors` is imported now (even though only the `GET /:id` handler uses it in this task) because Task 5 adds `createRiskFactorsEntry` to the same import line — keeping both handlers' data-access needs visible together.

Modify `packages/api-gateway/src/app.ts` to mount it — add the import and the `app.use` line:

```ts
import express, { type Express, type Request, type Response } from "express";
import type Database from "better-sqlite3";
import { createPatientsRouter } from "./routes/patients.js";

export function createApp(db: Database.Database): Express {
  const app: Express = express();
  app.use(express.json());

  app.use("/patients", createPatientsRouter(db));

  app.get("/", (req: Request, res: Response) => {
    res.send("Hello World!");
  });

  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/api-gateway && pnpm test -- routes/patients.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/api-gateway/src/routes/patients.ts packages/api-gateway/src/routes/patients.test.ts packages/api-gateway/src/app.ts
git commit -m "Add patients CRUD routes"
```

---

### Task 5: Risk-Factors Route

**Files:**
- Modify: `packages/api-gateway/src/routes/patients.ts` (add the risk-factors route)
- Modify: `packages/api-gateway/src/routes/patients.test.ts` (add the risk-factors describe block)

**Interfaces:**
- Consumes:
  - From Task 1 (`db/patients.ts`): `createRiskFactorsEntry`, `getLatestRiskFactors` (already imported in Task 4), `getPatient`.
  - From Task 2 (`validation/patients.ts`): `validateRiskFactorsEntry`.
  - From Task 4: `createPatientsRouter`, `parsePatientId`.
- Produces: nothing consumed by later tasks — this closes out the slice.

- [ ] **Step 1: Write the failing test**

Add this `describe` block inside the existing `describe("patients routes", ...)` in `packages/api-gateway/src/routes/patients.test.ts`, alongside the `PATCH /patients/:id` block:

```ts
  describe("POST /patients/:id/risk-factors", () => {
    it("creates a dated risk-factors entry", async () => {
      const created = await supertest(app).post("/patients").send({
        first_name: "Jean",
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      const response = await supertest(app)
        .post(`/patients/${created.body.id}/risk-factors`)
        .send({ diabetes: true, hypertension: false });
      expect(response.status).toBe(201);
      expect(response.body.diabetes).toBe(1);
      expect(response.body.hypertension).toBe(0);
      expect(response.body.patient_id).toBe(created.body.id);
    });

    it("is reflected as the latest entry on GET /patients/:id", async () => {
      const created = await supertest(app).post("/patients").send({
        first_name: "Jean",
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      await supertest(app)
        .post(`/patients/${created.body.id}/risk-factors`)
        .send({ diabetes: true });
      const response = await supertest(app).get(
        `/patients/${created.body.id}`,
      );
      expect(response.body.riskFactors.diabetes).toBe(1);
    });

    it("returns 404 for an unknown patient", async () => {
      const response = await supertest(app)
        .post("/patients/999/risk-factors")
        .send({ diabetes: true });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "PATIENT_NOT_FOUND" });
    });

    it("returns 400 for a non-boolean field value", async () => {
      const created = await supertest(app).post("/patients").send({
        first_name: "Jean",
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      const response = await supertest(app)
        .post(`/patients/${created.body.id}/risk-factors`)
        .send({ diabetes: "yes" });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "RISK_FACTOR_VALUE_INVALID",
      });
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api-gateway && pnpm test -- routes/patients.test.ts`
Expected: FAIL — `POST /patients/:id/risk-factors` returns 404 (no such route).

- [ ] **Step 3: Write minimal implementation**

In `packages/api-gateway/src/routes/patients.ts`, add `createRiskFactorsEntry` to the import from `../db/patients.js` and `validateRiskFactorsEntry` to the import from `../validation/patients.js`, then add this route inside `createPatientsRouter`, after the `PATCH /:id` handler and before the `return router;` line:

```ts
  router.post("/:id/risk-factors", (req: Request, res: Response) => {
    const id = parsePatientId(req.params.id);
    if (id === undefined || !getPatient(db, id)) {
      res.status(404).json({ error: "PATIENT_NOT_FOUND" });
      return;
    }
    const result = validateRiskFactorsEntry(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(createRiskFactorsEntry(db, id, result.data));
  });
```

The full updated import block at the top of the file becomes:

```ts
import { Router, type Request, type Response } from "express";
import type Database from "better-sqlite3";
import {
  createPatient,
  getPatient,
  listPatients,
  updatePatient,
  getLatestRiskFactors,
  createRiskFactorsEntry,
} from "../db/patients.js";
import {
  validateCreatePatient,
  validateUpdatePatient,
  validateRiskFactorsEntry,
} from "../validation/patients.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/api-gateway && pnpm test -- routes/patients.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Run the full test suite**

Run: `cd packages/api-gateway && pnpm test`
Expected: PASS (all tests across `db/`, `validation/`, `app.test.ts`, `routes/`)

- [ ] **Step 6: Commit**

```bash
git add packages/api-gateway/src/routes/patients.ts packages/api-gateway/src/routes/patients.test.ts
git commit -m "Add risk-factors entry route"
```
