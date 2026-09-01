# Membres inférieurs Per-Artery Structured Entry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the doctor record a Spectre (and a VSM on the AFC) for six named arteries per leg, and print them as a nested list under each side in the report PDF.

**Architecture:** A new `report_arteries` child table keyed `(report_id, side, artery)` holds sparse rows — only examined arteries get a row. The Flux clause is never stored; it is derived from Spectre by one shared function. The report-builder form keeps flat field keys generated from the artery list, and maps them to a nested `arteres` payload.

**Tech Stack:** TypeScript (ESM), better-sqlite3, Express 5, pdf-lib + @pdf-lib/fontkit, React 19 + TanStack Form + zod, shadcn/Radix UI, vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-mi-per-artery-structured-entry-design.md`

## Global Constraints

- Local-only. No cloud services, no external APIs, no internet at runtime.
- French UI labels throughout. French typography: a space before `:` (`Spectre : triphasique`).
- SQLite only. Schema lives in `packages/api-gateway/src/db/schema.sql`, which is re-executed on every connection — a new table needs no `ALTER TABLE` migration code.
- Reports are append-only: no update or delete endpoints, for reports or arteries.
- Artery print order is exactly: `afc`, `afs`, `poplitee`, `tibiale_anterieure`, `tibiale_posterieure`, `fibulaire`.
- Side print order is exactly: `droite`, then `gauche`.
- Spectre values: `monophasique`, `diphasique`, `triphasique`. Empty string means not examined.
- Flux derivation, the only allowed inference: `triphasique → "laminaire"`, `monophasique → "amortie"`, `diphasique → none`.
- VSM applies to `afc` only, prints in `cm/s`.
- Do not start dev servers. Verify with `pnpm exec vitest run`, `pnpm exec tsc --noEmit`, and (client only) `pnpm exec eslint src --max-warnings=0`.
- Commands run from the relevant package directory, e.g. `packages/api-gateway`.

---

### Task 1: Shared artery constants and the Flux rule

**Files:**
- Create: `packages/shared-labels/src/arteries.ts`
- Modify: `packages/shared-labels/src/index.ts`
- Test: `packages/shared-labels/src/arteries.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MI_ARTERY_KEYS`, `MiArteryKey`, `MI_ARTERY_LABELS`, `MI_SIDES`, `MiSide`, `MI_SIDE_LABELS`, `SPECTRE_OPTIONS`, `Spectre`, `fluxForSpectre(spectre: string): string | null`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared-labels/src/arteries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MI_ARTERY_KEYS,
  MI_ARTERY_LABELS,
  MI_SIDES,
  SPECTRE_OPTIONS,
  fluxForSpectre,
} from "./arteries.js";

describe("fluxForSpectre", () => {
  it("derives laminaire from triphasique", () => {
    expect(fluxForSpectre("triphasique")).toBe("laminaire");
  });

  it("derives amortie from monophasique", () => {
    expect(fluxForSpectre("monophasique")).toBe("amortie");
  });

  it("derives nothing from diphasique", () => {
    expect(fluxForSpectre("diphasique")).toBeNull();
  });

  it("derives nothing from an unexamined or unknown spectre", () => {
    expect(fluxForSpectre("")).toBeNull();
    expect(fluxForSpectre("bruit")).toBeNull();
  });
});

describe("artery constants", () => {
  it("lists the six arteries in print order", () => {
    expect(MI_ARTERY_KEYS).toEqual([
      "afc",
      "afs",
      "poplitee",
      "tibiale_anterieure",
      "tibiale_posterieure",
      "fibulaire",
    ]);
  });

  it("labels every artery in French", () => {
    for (const key of MI_ARTERY_KEYS) {
      expect(MI_ARTERY_LABELS[key].length).toBeGreaterThan(0);
    }
    expect(MI_ARTERY_LABELS.afc).toBe("Artère fémorale commune (AFC)");
  });

  it("lists droite before gauche", () => {
    expect(MI_SIDES).toEqual(["droite", "gauche"]);
  });

  it("offers the three spectre values", () => {
    expect(SPECTRE_OPTIONS).toEqual([
      "monophasique",
      "diphasique",
      "triphasique",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared-labels && pnpm exec vitest run src/arteries.test.ts`
Expected: FAIL — `Failed to resolve import "./arteries.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared-labels/src/arteries.ts`:

```ts
export const MI_ARTERY_KEYS = [
  "afc",
  "afs",
  "poplitee",
  "tibiale_anterieure",
  "tibiale_posterieure",
  "fibulaire",
] as const;

export type MiArteryKey = (typeof MI_ARTERY_KEYS)[number];

export const MI_ARTERY_LABELS: Record<MiArteryKey, string> = {
  afc: "Artère fémorale commune (AFC)",
  afs: "Artère fémorale superficielle (AFS)",
  poplitee: "Artère poplitée",
  tibiale_anterieure: "Artère tibiale antérieure",
  tibiale_posterieure: "Artère tibiale postérieure",
  fibulaire: "Artère fibulaire",
};

export const MI_SIDES = ["droite", "gauche"] as const;

export type MiSide = (typeof MI_SIDES)[number];

export const MI_SIDE_LABELS: Record<MiSide, string> = {
  droite: "Droite",
  gauche: "Gauche",
};

export const SPECTRE_OPTIONS = [
  "monophasique",
  "diphasique",
  "triphasique",
] as const;

export type Spectre = (typeof SPECTRE_OPTIONS)[number];

// The single source of truth for the Flux clause. Flux is never entered or
// stored — it follows from the spectre. Confirmed with the doctor 2026-09-01:
// triphasique = laminaire, monophasique = amortie, diphasique = say nothing.
export function fluxForSpectre(spectre: string): string | null {
  if (spectre === "triphasique") return "laminaire";
  if (spectre === "monophasique") return "amortie";
  return null;
}
```

- [ ] **Step 4: Export from the package index**

Modify `packages/shared-labels/src/index.ts` — add as the first line:

```ts
export * from "./arteries.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/shared-labels && pnpm exec vitest run`
Expected: PASS, including the pre-existing `index.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-labels/src/arteries.ts packages/shared-labels/src/arteries.test.ts packages/shared-labels/src/index.ts
git commit -m "feat(shared-labels): add MI artery constants and the flux derivation rule"
```

---

### Task 2: `report_arteries` table and its DB module

**Files:**
- Modify: `packages/api-gateway/src/db/schema.sql`
- Create: `packages/api-gateway/src/db/arteries.ts`
- Test: `packages/api-gateway/src/db/arteries.test.ts`

**Interfaces:**
- Consumes: `MiSide`, `MiArteryKey` from `@speira-docdoppler/shared-labels`.
- Produces: `ArteryEntry`, `ArteriesBySide`, `insertArteries(db, reportId, arteres): void`, `getArteriesForReport(db, reportId): ArteriesBySide`, `getArteriesForReports(db, reportIds): Map<number, ArteriesBySide>`.

- [ ] **Step 1: Write the failing test**

Create `packages/api-gateway/src/db/arteries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { insertArteries, getArteriesForReport, getArteriesForReports } from "./arteries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  db.prepare(
    "INSERT INTO patients (id, first_name, last_name, dob, sex) VALUES (1, 'Jean', 'Dupont', '1958-03-12', 'M')",
  ).run();
  db.prepare(
    "INSERT INTO reports (id, patient_id, doctor_name, exam_date) VALUES (1, 1, 'Dr Martin', '2026-08-13')",
  ).run();
  return db;
}

describe("report arteries", () => {
  it("round-trips what was entered, keyed by side and artery", () => {
    const db = makeDb();
    insertArteries(db, 1, {
      droite: {
        afc: { vsm: 90, spectre: "triphasique" },
        afs: { vsm: null, spectre: "monophasique" },
      },
    });
    expect(getArteriesForReport(db, 1)).toEqual({
      droite: {
        afc: { vsm: 90, spectre: "triphasique" },
        afs: { vsm: null, spectre: "monophasique" },
      },
    });
  });

  it("writes no row for an artery with neither spectre nor vsm", () => {
    const db = makeDb();
    insertArteries(db, 1, {
      droite: {
        afc: { vsm: null, spectre: "triphasique" },
        poplitee: { vsm: null, spectre: "" },
      },
    });
    const count = db
      .prepare("SELECT COUNT(*) AS n FROM report_arteries WHERE report_id = 1")
      .get() as { n: number };
    expect(count.n).toBe(1);
    expect(getArteriesForReport(db, 1).droite?.poplitee).toBeUndefined();
  });

  it("returns an empty object for a report with no arteries", () => {
    const db = makeDb();
    expect(getArteriesForReport(db, 1)).toEqual({});
  });

  it("deletes its rows when the report's patient is deleted", () => {
    const db = makeDb();
    insertArteries(db, 1, { droite: { afc: { vsm: null, spectre: "triphasique" } } });
    db.prepare("DELETE FROM patients WHERE id = 1").run();
    const count = db
      .prepare("SELECT COUNT(*) AS n FROM report_arteries")
      .get() as { n: number };
    expect(count.n).toBe(0);
  });

  it("rejects a spectre outside the allowed set", () => {
    const db = makeDb();
    expect(() =>
      insertArteries(db, 1, { droite: { afc: { vsm: null, spectre: "bruit" } } }),
    ).toThrow();
  });

  it("groups arteries for several reports in one read", () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO reports (id, patient_id, doctor_name, exam_date) VALUES (2, 1, 'Dr Martin', '2026-08-14')",
    ).run();
    insertArteries(db, 1, { droite: { afc: { vsm: null, spectre: "triphasique" } } });
    insertArteries(db, 2, { gauche: { afs: { vsm: null, spectre: "diphasique" } } });
    const grouped = getArteriesForReports(db, [1, 2]);
    expect(grouped.get(1)?.droite?.afc?.spectre).toBe("triphasique");
    expect(grouped.get(2)?.gauche?.afs?.spectre).toBe("diphasique");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api-gateway && pnpm exec vitest run src/db/arteries.test.ts`
Expected: FAIL — `Failed to resolve import "./arteries.js"`.

- [ ] **Step 3: Add the table to the schema**

Modify `packages/api-gateway/src/db/schema.sql` — append after the `reports` table:

```sql
CREATE TABLE IF NOT EXISTS report_arteries (
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  side      TEXT NOT NULL CHECK (side IN ('droite','gauche')),
  artery    TEXT NOT NULL CHECK (artery IN ('afc','afs','poplitee',
                                 'tibiale_anterieure','tibiale_posterieure','fibulaire')),
  vsm       REAL,
  spectre   TEXT NOT NULL DEFAULT ''
            CHECK (spectre IN ('','monophasique','diphasique','triphasique')),
  PRIMARY KEY (report_id, side, artery)
);
```

- [ ] **Step 4: Write minimal implementation**

Create `packages/api-gateway/src/db/arteries.ts`:

```ts
import type Database from "better-sqlite3";
import {
  MI_ARTERY_KEYS,
  MI_SIDES,
  type MiArteryKey,
  type MiSide,
} from "@speira-docdoppler/shared-labels";

export interface ArteryEntry {
  vsm: number | null;
  spectre: string;
}

export type ArteriesBySide = Partial<
  Record<MiSide, Partial<Record<MiArteryKey, ArteryEntry>>>
>;

interface ReportArteryRow {
  report_id: number;
  side: MiSide;
  artery: MiArteryKey;
  vsm: number | null;
  spectre: string;
}

// Sparse by design: an artery the doctor did not examine gets no row, so a
// report with no MI arterial exam writes nothing at all.
function hasData(entry: ArteryEntry): boolean {
  return entry.spectre !== "" || entry.vsm !== null;
}

export function insertArteries(
  db: Database.Database,
  reportId: number,
  arteres: ArteriesBySide,
): void {
  const statement = db.prepare(
    "INSERT INTO report_arteries (report_id, side, artery, vsm, spectre) VALUES (?, ?, ?, ?, ?)",
  );
  for (const side of MI_SIDES) {
    const bySide = arteres[side];
    if (!bySide) continue;
    for (const artery of MI_ARTERY_KEYS) {
      const entry = bySide[artery];
      if (!entry || !hasData(entry)) continue;
      statement.run(reportId, side, artery, entry.vsm, entry.spectre);
    }
  }
}

function group(rows: ReportArteryRow[]): ArteriesBySide {
  const arteres: ArteriesBySide = {};
  for (const row of rows) {
    const bySide = (arteres[row.side] ??= {});
    bySide[row.artery] = { vsm: row.vsm, spectre: row.spectre };
  }
  return arteres;
}

export function getArteriesForReport(
  db: Database.Database,
  reportId: number,
): ArteriesBySide {
  const rows = db
    .prepare("SELECT * FROM report_arteries WHERE report_id = ?")
    .all(reportId) as ReportArteryRow[];
  return group(rows);
}

export function getArteriesForReports(
  db: Database.Database,
  reportIds: number[],
): Map<number, ArteriesBySide> {
  const grouped = new Map<number, ArteriesBySide>();
  if (reportIds.length === 0) return grouped;
  const placeholders = reportIds.map(() => "?").join(", ");
  const rows = db
    .prepare(`SELECT * FROM report_arteries WHERE report_id IN (${placeholders})`)
    .all(...reportIds) as ReportArteryRow[];
  for (const id of reportIds) {
    grouped.set(
      id,
      group(rows.filter((row) => row.report_id === id)),
    );
  }
  return grouped;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/api-gateway && pnpm exec vitest run src/db/arteries.test.ts && pnpm exec tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add packages/api-gateway/src/db/schema.sql packages/api-gateway/src/db/arteries.ts packages/api-gateway/src/db/arteries.test.ts
git commit -m "feat(api): add report_arteries table and its read/write module"
```

---

### Task 3: Write arteries inside the report-creation transaction

**Files:**
- Modify: `packages/api-gateway/src/db/reports.ts`
- Test: `packages/api-gateway/src/db/reports.test.ts`

**Interfaces:**
- Consumes: `insertArteries`, `getArteriesForReport`, `getArteriesForReports`, `ArteriesBySide` from Task 2.
- Produces: `CreateReportInput.mi_arteres: ArteriesBySide`; `ReportWithArteries = ReportRow & { arteres: ArteriesBySide }`; `getReport` and `listReportsByPatient` now return `ReportWithArteries`.

- [ ] **Step 1: Write the failing test**

Append to the existing `describe("reports data access", ...)` in `packages/api-gateway/src/db/reports.test.ts`. It already provides `MINIMAL_INPUT`, `FULL_INPUT`, `makePatient(db)` and creates a DB per test with `createConnection(":memory:")`:

```ts
it("stores arteries with the report and returns them on read", () => {
  const db = createConnection(":memory:");
  const patient = makePatient(db);
  const report = createReport(db, patient.id, {
    ...MINIMAL_INPUT,
    mi_arteres: {
      droite: { afc: { vsm: 90, spectre: "triphasique" } },
      gauche: { afs: { vsm: null, spectre: "monophasique" } },
    },
  });
  expect(report.arteres.droite?.afc).toEqual({ vsm: 90, spectre: "triphasique" });
  expect(getReport(db, report.id)?.arteres.gauche?.afs?.spectre).toBe("monophasique");
  expect(listReportsByPatient(db, patient.id)[0].arteres.droite?.afc?.vsm).toBe(90);
});

it("writes no report at all when an artery is invalid", () => {
  const db = createConnection(":memory:");
  const patient = makePatient(db);
  expect(() =>
    createReport(db, patient.id, {
      ...MINIMAL_INPUT,
      mi_arteres: { droite: { afc: { vsm: null, spectre: "bruit" } } },
    }),
  ).toThrow();
  expect(listReportsByPatient(db, patient.id)).toHaveLength(0);
});
```

`MINIMAL_INPUT` and `FULL_INPUT` are typed `CreateReportInput`, so both must gain `mi_arteres: {}` in Step 4 or this file will not compile.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api-gateway && pnpm exec vitest run src/db/reports.test.ts`
Expected: FAIL — `mi_arteres` is not a known property, and `report.arteres` is undefined.

- [ ] **Step 3: Write minimal implementation**

Modify `packages/api-gateway/src/db/reports.ts`:

Add imports at the top:

```ts
import {
  insertArteries,
  getArteriesForReport,
  getArteriesForReports,
  type ArteriesBySide,
} from "./arteries.js";
```

Add to `CreateReportInput`, after `mi_findings_text`:

```ts
  mi_arteres: ArteriesBySide;
```

Add after the `ReportRow` interface:

```ts
export interface ReportWithArteries extends ReportRow {
  arteres: ArteriesBySide;
}
```

Replace the body of `createReport` from `const { lastInsertRowid } = db` through `return getReport(...)` with a transaction, so a rejected artery rolls the report back too:

```ts
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
```

Replace `getReport` and `listReportsByPatient`:

```ts
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
```

- [ ] **Step 4: Fix the other callers the compiler flags**

Run: `cd packages/api-gateway && pnpm exec tsc --noEmit`
Every existing `createReport(...)` call site (tests, route tests) now misses `mi_arteres`. Add `mi_arteres: {}` to each input object the compiler names. Do not change any other field.

- [ ] **Step 5: Run the suite to verify it passes**

Run: `cd packages/api-gateway && pnpm exec vitest run && pnpm exec tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add packages/api-gateway/src/db/reports.ts packages/api-gateway/src/db/reports.test.ts
git commit -m "feat(api): write report arteries in the creation transaction"
```

---

### Task 4: Accept and validate `arteres` on the API

**Files:**
- Modify: `packages/api-gateway/src/validation/reports.ts`
- Test: `packages/api-gateway/src/validation/reports.test.ts`
- Test: `packages/api-gateway/src/routes/reports.test.ts`

**Interfaces:**
- Consumes: `ArteriesBySide` (Task 2), `MI_ARTERY_KEYS`, `MI_SIDES`, `SPECTRE_OPTIONS` (Task 1).
- Produces: `validateCreateReport` now populates `data.mi_arteres`.

- [ ] **Step 1: Write the failing test**

**First** — the file's existing "accepts the minimal valid payload" test asserts the whole `data` object with `toEqual`. Add `mi_arteres: {},` to that expected object, or it will fail once the field exists.

Then append inside the existing `describe("validateCreateReport", ...)`, which provides `const valid = { doctor_name: "Dr. Martin", exam_date: "2026-08-13" }`:

```ts
describe("membres_inferieurs.arteres", () => {
  it("accepts a body with no arteres at all", () => {
    const result = validateCreateReport(valid);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.mi_arteres).toEqual({});
  });

  it("keeps the entered spectre and vsm", () => {
    const result = validateCreateReport({
      ...valid,
      membres_inferieurs: {
        arteres: { droite: { afc: { vsm: 90, spectre: "triphasique" } } },
      },
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.mi_arteres.droite?.afc).toEqual({
        vsm: 90,
        spectre: "triphasique",
      });
    }
  });

  it("rejects a spectre outside the allowed set", () => {
    const result = validateCreateReport({
      ...valid,
      membres_inferieurs: {
        arteres: { droite: { afc: { spectre: "bruit" } } },
      },
    });
    expect(result).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
  });

  it("rejects an unknown artery or side key", () => {
    expect(
      validateCreateReport({
        ...valid,
        membres_inferieurs: { arteres: { droite: { carotide: { spectre: "" } } } },
      }),
    ).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
    expect(
      validateCreateReport({
        ...valid,
        membres_inferieurs: { arteres: { milieu: { afc: { spectre: "" } } } },
      }),
    ).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
  });

  it("rejects a non-numeric vsm", () => {
    expect(
      validateCreateReport({
        ...valid,
        membres_inferieurs: { arteres: { droite: { afc: { vsm: "90" } } } },
      }),
    ).toEqual({ valid: false, error: "REPORT_FIELD_INVALID" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api-gateway && pnpm exec vitest run src/validation/reports.test.ts`
Expected: FAIL — `mi_arteres` is undefined and bad input is accepted.

- [ ] **Step 3: Write minimal implementation**

Modify `packages/api-gateway/src/validation/reports.ts`:

Add imports:

```ts
import {
  MI_ARTERY_KEYS,
  MI_SIDES,
  SPECTRE_OPTIONS,
  type MiArteryKey,
  type MiSide,
} from "@speira-docdoppler/shared-labels";
import type { ArteriesBySide } from "../db/arteries.js";
```

Add above `validateCreateReport`:

```ts
function optionalSpectre(value: unknown): string | typeof INVALID {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return INVALID;
  return (SPECTRE_OPTIONS as readonly string[]).includes(value) ? value : INVALID;
}

function validateArteries(value: unknown): ArteriesBySide | typeof INVALID {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object") return INVALID;
  const bySideInput = value as Record<string, unknown>;
  const arteres: ArteriesBySide = {};

  for (const sideKey of Object.keys(bySideInput)) {
    if (!(MI_SIDES as readonly string[]).includes(sideKey)) return INVALID;
    const side = sideKey as MiSide;
    const arteriesInput = (bySideInput[sideKey] ?? {}) as Record<string, unknown>;
    if (typeof arteriesInput !== "object") return INVALID;

    for (const arteryKey of Object.keys(arteriesInput)) {
      if (!(MI_ARTERY_KEYS as readonly string[]).includes(arteryKey)) return INVALID;
      const artery = arteryKey as MiArteryKey;
      const entry = (arteriesInput[arteryKey] ?? {}) as Record<string, unknown>;
      if (typeof entry !== "object") return INVALID;

      const vsm = optionalNumber(entry.vsm);
      const spectre = optionalSpectre(entry.spectre);
      if (vsm === INVALID || spectre === INVALID) return INVALID;

      (arteres[side] ??= {})[artery] = { vsm, spectre };
    }
  }
  return arteres;
}
```

Add to the `fields` object, after `mi_findings_text`:

```ts
    mi_arteres: validateArteries(mi.arteres),
```

The existing `for (const value of Object.values(fields))` loop already turns an `INVALID` here into `REPORT_FIELD_INVALID`; no change needed there.

- [ ] **Step 4: Add the route-level test**

Append inside the existing `describe("POST /patients/:id/reports", ...)` in `packages/api-gateway/src/routes/reports.test.ts`, which provides `createTestPatient()` and an `app` from the enclosing `beforeEach`:

```ts
it("round-trips arteres through the endpoint", async () => {
  const patient = await createTestPatient();
  const response = await supertest(app)
    .post(`/patients/${patient.id}/reports`)
    .send({
      doctor_name: "Dr Martin",
      exam_date: "2026-08-13",
      membres_inferieurs: {
        arteres: { droite: { afc: { vsm: 90, spectre: "triphasique" } } },
      },
    });
  expect(response.status).toBe(201);
  expect(response.body.arteres.droite.afc).toEqual({
    vsm: 90,
    spectre: "triphasique",
  });
});

it("rejects an invalid spectre with REPORT_FIELD_INVALID", async () => {
  const patient = await createTestPatient();
  const response = await supertest(app)
    .post(`/patients/${patient.id}/reports`)
    .send({
      doctor_name: "Dr Martin",
      exam_date: "2026-08-13",
      membres_inferieurs: { arteres: { droite: { afc: { spectre: "bruit" } } } },
    });
  expect(response.status).toBe(400);
  expect(response.body).toEqual({ error: "REPORT_FIELD_INVALID" });
});
```

- [ ] **Step 5: Run the suite to verify it passes**

Run: `cd packages/api-gateway && pnpm exec vitest run && pnpm exec tsc --noEmit`
Expected: PASS, tsc clean. The routes need no code change — `createReport` already returns `arteres`.

- [ ] **Step 6: Commit**

```bash
git add packages/api-gateway/src/validation/reports.ts packages/api-gateway/src/validation/reports.test.ts packages/api-gateway/src/routes/reports.test.ts
git commit -m "feat(api): validate and expose membres_inferieurs.arteres"
```

---

### Task 5: `drawInlineBold` — bold name, regular remainder, one line

**Files:**
- Modify: `packages/api-gateway/src/pdf/report-pdf.ts`
- Test: `packages/api-gateway/src/pdf/report-pdf.test.ts`

**Interfaces:**
- Consumes: the file's existing `draw`, `wrapText`, `ensureSpace`, `MARGIN`, `PAGE_WIDTH`, `LINE_HEIGHT`.
- Produces: an in-scope `drawInlineBold(prefix: string, rest: string, indent: number): void` inside `buildReportPdf`, and a module-level `INDENT_3`.

- [ ] **Step 1: Write the failing test**

Append to the `buildReportPdf` describe in `packages/api-gateway/src/pdf/report-pdf.test.ts`:

```ts
it("keeps a bold-prefixed line on one row and wraps its remainder", async () => {
  const bytes = await buildReportPdf(
    makePatient(),
    undefined,
    makeReport({
      mi_ips_droit: 0.86,
      arteres: {
        droite: { afc: { vsm: 90, spectre: "triphasique" } },
      },
    }),
    makeSettings(),
  );
  const parsed = await parsePdf(bytes);
  expect(parsed.text).toContain(
    "Artère fémorale commune (AFC) VSM : 90 cm/s. Spectre : triphasique. Flux : laminaire",
  );
});
```

Also update the `makeReport` fixture in this file to include `arteres: {}` by default, and change its return type to `ReportWithArteries` (import it from `../db/reports.js`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api-gateway && pnpm exec vitest run src/pdf/report-pdf.test.ts`
Expected: FAIL — the artery line is absent.

- [ ] **Step 3: Add the indent constant**

Modify `packages/api-gateway/src/pdf/report-pdf.ts` — after `const INDENT_2 = 28;`:

```ts
const INDENT_3 = 42;
```

- [ ] **Step 4: Add the helper**

Add inside `buildReportPdf`, immediately after the existing `drawSideRow` definition:

```ts
  // pdf-lib draws one font per drawText call, so a line that is part bold and
  // part regular has to be composed by hand: draw the bold prefix, measure it,
  // then continue in the regular font at that offset.
  const drawInlineBold = (prefix: string, rest: string, indent: number) => {
    const size = 10;
    const prefixWidth = boldFont.widthOfTextAtSize(`${prefix} `, size);
    const restX = MARGIN + indent + prefixWidth;
    const restWidth = PAGE_WIDTH - MARGIN - restX;
    const measure = (line: string) => font.widthOfTextAtSize(line, size);
    const [firstLine, ...moreLines] = wrapText(measure, restWidth, rest);

    ensureSpace();
    page.drawText(prefix, {
      x: MARGIN + indent,
      y: y - size,
      size,
      font: boldFont,
    });
    if (firstLine) {
      page.drawText(firstLine, { x: restX, y: y - size, size, font });
    }
    y -= LINE_HEIGHT;

    // Continuation lines align under the remainder, not under the bold name.
    for (const line of moreLines) {
      ensureSpace();
      page.drawText(line, { x: restX, y: y - size, size, font });
      y -= LINE_HEIGHT;
    }
  };
```

- [ ] **Step 5: Run the test to verify it still fails for the right reason**

Run: `cd packages/api-gateway && pnpm exec vitest run src/pdf/report-pdf.test.ts`
Expected: still FAIL — the helper exists but nothing calls it yet. Task 6 wires it in.

- [ ] **Step 6: Commit**

```bash
git add packages/api-gateway/src/pdf/report-pdf.ts
git commit -m "feat(pdf): add inline bold-prefix line rendering and a third indent level"
```

---

### Task 6: Render the MI section as per-side artery lists

**Files:**
- Modify: `packages/api-gateway/src/pdf/report-pdf.ts`
- Test: `packages/api-gateway/src/pdf/report-pdf.test.ts`

**Interfaces:**
- Consumes: `drawInlineBold`, `INDENT_3` (Task 5); `MI_ARTERY_KEYS`, `MI_ARTERY_LABELS`, `MI_SIDES`, `MI_SIDE_LABELS`, `fluxForSpectre` (Task 1); `ReportWithArteries` (Task 3).
- Produces: the final MI section layout.

- [ ] **Step 1: Write the failing tests**

Append to the `buildReportPdf` describe:

```ts
it("prints each side's IPS then its arteries, droite before gauche", async () => {
  const bytes = await buildReportPdf(
    makePatient(),
    undefined,
    makeReport({
      mi_ips_droit: 0.86,
      mi_ips_gauche: 0.93,
      arteres: {
        droite: { afs: { vsm: null, spectre: "monophasique" } },
        gauche: { poplitee: { vsm: null, spectre: "diphasique" } },
      },
    }),
    makeSettings(),
  );
  const parsed = await parsePdf(bytes);
  expect(parsed.text).toContain("- Droite : IPS : 0.86");
  expect(parsed.text).toContain(
    "Artère fémorale superficielle (AFS) Spectre : monophasique. Flux : amortie",
  );
  expect(parsed.text).toContain("- Gauche : IPS : 0.93");
  expect(parsed.text).toContain("Artère poplitée Spectre : diphasique");
  expect(parsed.text.indexOf("- Droite")).toBeLessThan(parsed.text.indexOf("- Gauche"));
});

it("no longer prints any systolic pressure line", async () => {
  const bytes = await buildReportPdf(
    makePatient(),
    undefined,
    makeReport({
      mi_pression_bras_droit: 140,
      mi_pression_bras_gauche: 135,
      mi_pression_cheville_droite: 120,
      mi_ips_droit: 0.86,
    }),
    makeSettings(),
  );
  const parsed = await parsePdf(bytes);
  expect(parsed.text).not.toContain("Pression systolique bras");
  expect(parsed.text).not.toContain("Pression cheville");
  expect(parsed.text).toContain("- Droite : IPS : 0.86");
});

it("omits an artery with no spectre and no vsm, and a side with nothing at all", async () => {
  const bytes = await buildReportPdf(
    makePatient(),
    undefined,
    makeReport({
      mi_ips_droit: 0.86,
      arteres: { droite: { afc: { vsm: null, spectre: "triphasique" } } },
    }),
    makeSettings(),
  );
  const parsed = await parsePdf(bytes);
  expect(parsed.text).toContain("Artère fémorale commune (AFC) Spectre : triphasique");
  expect(parsed.text).not.toContain("Artère fibulaire");
  expect(parsed.text).not.toContain("- Gauche");
});

it("still prints the constatations and the MI reference note", async () => {
  const bytes = await buildReportPdf(
    makePatient(),
    undefined,
    makeReport({
      mi_ips_droit: 0.86,
      mi_findings_text: "Axe droit calcifié.",
    }),
    makeSettings(),
  );
  const parsed = await parsePdf(bytes);
  expect(parsed.text).toContain("Axe droit calcifié.");
  expect(parsed.text).toContain("médiacalcose");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/api-gateway && pnpm exec vitest run src/pdf/report-pdf.test.ts`
Expected: FAIL — pressures still print, arteries do not.

- [ ] **Step 3: Write minimal implementation**

Modify `packages/api-gateway/src/pdf/report-pdf.ts`.

Extend the shared-labels import:

```ts
import {
  MI_ARTERY_KEYS,
  MI_ARTERY_LABELS,
  MI_SIDES,
  MI_SIDE_LABELS,
  REPORT_SECTION_LABELS,
  RISK_FACTOR_KEYS,
  RISK_FACTOR_LABELS,
  fluxForSpectre,
} from "@speira-docdoppler/shared-labels";
```

Change the `report` parameter type to `ReportWithArteries` (import it from `../db/reports.js`, replacing the `ReportRow` type import if `ReportRow` is otherwise unused).

Replace the whole `if (miHasContent) { ... }` block with:

```ts
  const ipsBySide = {
    droite: report.mi_ips_droit,
    gauche: report.mi_ips_gauche,
  } as const;

  const sideHasContent = (side: (typeof MI_SIDES)[number]) =>
    hasValue(ipsBySide[side]) ||
    MI_ARTERY_KEYS.some((artery) => report.arteres[side]?.[artery] !== undefined);

  const miHasContent =
    MI_SIDES.some(sideHasContent) || report.mi_findings_text.trim().length > 0;

  if (miHasContent) {
    draw(REPORT_SECTION_LABELS.membres_inferieurs, 11, true, INDENT_1);
    for (const side of MI_SIDES) {
      if (!sideHasContent(side)) continue;
      drawSideRow(MI_SIDE_LABELS[side], [sidePart("IPS", ipsBySide[side])]);
      for (const artery of MI_ARTERY_KEYS) {
        const entry = report.arteres[side]?.[artery];
        if (!entry) continue;
        const flux = fluxForSpectre(entry.spectre);
        const parts = [
          sidePart("VSM", entry.vsm, " cm/s"),
          sidePart("Spectre", entry.spectre),
          flux === null ? null : `Flux : ${flux}`,
        ].filter((part): part is string => part !== null);
        if (parts.length === 0) continue;
        drawInlineBold(MI_ARTERY_LABELS[artery], parts.join(". "), INDENT_3);
      }
    }
    if (report.mi_findings_text.trim().length > 0) {
      drawWrapped(report.mi_findings_text, 10, INDENT_1);
    }
    drawWrapped(MI_REFERENCE_NOTE, 8, INDENT_1);
    y -= LINE_HEIGHT / 2;
  }
```

Delete the now-unused `miHasSides` const and the two `drawField("Pression systolique bras …")` calls that preceded this block.

`drawSideRow` prints nothing when every part is null, so a side whose IPS is null but which has arteries still needs its arteries printed — that is why the artery loop sits outside the `drawSideRow` call rather than inside it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/api-gateway && pnpm exec vitest run && pnpm exec tsc --noEmit`
Expected: PASS, tsc clean. Fix any older MI assertions that expected the removed pressure lines.

- [ ] **Step 5: Verify the bold rendering visually**

Text extraction cannot prove boldness. Render a page and look at it:

```bash
cd packages/api-gateway
# write a throwaway test that calls buildReportPdf with two sides of arteries
# and writes the bytes to /tmp, then:
pdftoppm -png -r 110 -f 1 -l 1 /tmp/mi.pdf /tmp/mi
```
Confirm: artery names bold, remainder regular, arteries indented under their side row, no pressure lines. Delete the throwaway test.

- [ ] **Step 6: Commit**

```bash
git add packages/api-gateway/src/pdf/report-pdf.ts packages/api-gateway/src/pdf/report-pdf.test.ts
git commit -m "feat(pdf): render membres inférieurs as per-side artery lists"
```

---

### Task 7: Generate the form's artery fields

**Files:**
- Modify: `packages/client-secretary/src/features/reportFeatures/types.ts`
- Modify: `packages/client-secretary/src/features/reportFeatures/consts.ts`
- Test: `packages/client-secretary/src/features/reportFeatures/consts.test.ts` (create)

**Interfaces:**
- Consumes: `MI_ARTERY_KEYS`, `MI_SIDES`, `SPECTRE_OPTIONS` (Task 1).
- Produces: `MiArterySpectreKey`, `MiArteryVsmKey`, `arterySpectreKey(side, artery)`, `arteryVsmKey(side)`; `ReportBuilderFormValues` gains the 14 keys.

- [ ] **Step 1: Write the failing test**

Create `packages/client-secretary/src/features/reportFeatures/consts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getReportBuilderDefaultValues, reportBuilderFormSchema } from './consts'

describe('report builder artery fields', () => {
  it('defaults every artery field to an empty string', () => {
    const values = getReportBuilderDefaultValues('2026-08-13', 'Dr Martin')
    expect(values.mi_droite_afc_spectre).toBe('')
    expect(values.mi_droite_afc_vsm).toBe('')
    expect(values.mi_gauche_fibulaire_spectre).toBe('')
  })

  it('accepts a valid spectre and an empty one', () => {
    const base = getReportBuilderDefaultValues('2026-08-13', 'Dr Martin')
    expect(
      reportBuilderFormSchema.safeParse({
        ...base,
        mi_droite_afc_spectre: 'triphasique',
      }).success,
    ).toBe(true)
    expect(reportBuilderFormSchema.safeParse(base).success).toBe(true)
  })

  it('rejects a spectre outside the allowed set', () => {
    const base = getReportBuilderDefaultValues('2026-08-13', 'Dr Martin')
    expect(
      reportBuilderFormSchema.safeParse({
        ...base,
        mi_droite_afc_spectre: 'bruit',
      }).success,
    ).toBe(false)
  })

  it('rejects a non-numeric vsm', () => {
    const base = getReportBuilderDefaultValues('2026-08-13', 'Dr Martin')
    expect(
      reportBuilderFormSchema.safeParse({ ...base, mi_droite_afc_vsm: 'abc' }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/client-secretary && pnpm exec vitest run src/features/reportFeatures/consts.test.ts`
Expected: FAIL — `mi_droite_afc_spectre` is not a property of the defaults.

- [ ] **Step 3: Add the key types**

Modify `packages/client-secretary/src/features/reportFeatures/types.ts` — add at the top:

```ts
import type { MiArteryKey, MiSide } from '@speira-docdoppler/shared-labels'

export type MiArterySpectreKey = `mi_${MiSide}_${MiArteryKey}_spectre`
export type MiArteryVsmKey = `mi_${MiSide}_afc_vsm`

export function arterySpectreKey(
  side: MiSide,
  artery: MiArteryKey,
): MiArterySpectreKey {
  return `mi_${side}_${artery}_spectre`
}

export function arteryVsmKey(side: MiSide): MiArteryVsmKey {
  return `mi_${side}_afc_vsm`
}
```

Then change the `ReportBuilderFormValues` declaration from an `interface` to an intersection so the generated keys join it. Keep every existing field exactly as it is:

```ts
export type ReportBuilderFormValues = {
  doctor_name: string
  exam_date: string
  correspondant_dossier: string
  indication: string
  tsa_imt_droit: string
  tsa_imt_gauche: string
  tsa_aci_acc_ratio_droit: string
  tsa_aci_acc_ratio_gauche: string
  tsa_findings_text: string
  aorte_diametre: string
  aorte_findings_text: string
  mi_pression_cheville_droite: string
  mi_pression_cheville_gauche: string
  mi_pression_bras_droit: string
  mi_pression_bras_gauche: string
  mi_findings_text: string
  conclusion: string
} & Record<MiArterySpectreKey, string> &
  Record<MiArteryVsmKey, string>
```

- [ ] **Step 4: Generate the defaults and the schema**

Modify `packages/client-secretary/src/features/reportFeatures/consts.ts`.

Add imports:

```ts
import {
  MI_ARTERY_KEYS,
  MI_SIDES,
  SPECTRE_OPTIONS,
} from '@speira-docdoppler/shared-labels'
import { arterySpectreKey, arteryVsmKey } from './types'
import type { MiArterySpectreKey, MiArteryVsmKey } from './types'
```

Add above `getReportBuilderDefaultValues`:

```ts
type ArteryFieldValues = Record<MiArterySpectreKey, string> &
  Record<MiArteryVsmKey, string>

// 14 fields (6 spectres per side + a VSM on each AFC) — generated from the
// artery list so adding an artery never means editing three files.
function arteryDefaults(): ArteryFieldValues {
  const values = {} as ArteryFieldValues
  for (const side of MI_SIDES) {
    for (const artery of MI_ARTERY_KEYS) {
      values[arterySpectreKey(side, artery)] = ''
    }
    values[arteryVsmKey(side)] = ''
  }
  return values
}
```

Spread it into the returned defaults, after `mi_findings_text: '',`:

```ts
    ...arteryDefaults(),
```

Add above `reportBuilderFormSchema`:

```ts
const optionalSpectre = z
  .string()
  .refine(
    (value) => value === '' || (SPECTRE_OPTIONS as readonly string[]).includes(value),
    { message: 'Spectre invalide.' },
  )

function arterySchemaShape(): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const side of MI_SIDES) {
    for (const artery of MI_ARTERY_KEYS) {
      shape[arterySpectreKey(side, artery)] = optionalSpectre
    }
    shape[arteryVsmKey(side)] = optionalNumericString
  }
  return shape
}
```

Add to the `z.object({ ... })` literal, after `conclusion: z.string(),`:

```ts
  ...arterySchemaShape(),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/client-secretary && pnpm exec vitest run && pnpm exec tsc --noEmit && pnpm exec eslint src --max-warnings=0`
Expected: PASS, tsc and lint clean.

- [ ] **Step 6: Commit**

```bash
git add packages/client-secretary/src/features/reportFeatures/types.ts packages/client-secretary/src/features/reportFeatures/consts.ts packages/client-secretary/src/features/reportFeatures/consts.test.ts
git commit -m "feat(client): generate per-artery form fields, defaults and validation"
```

---

### Task 8: Artery inputs in the report builder, and the payload mapping

**Files:**
- Modify: `packages/client-secretary/src/features/reportFeatures/ReportBuilder.tsx`
- Modify: `packages/client-secretary/src/features/reportFeatures/ReportBuilderHelper.ts`
- Modify: `packages/client-secretary/src/services/report-service.ts`

**Interfaces:**
- Consumes: `arterySpectreKey`, `arteryVsmKey` (Task 7); artery constants (Task 1).
- Produces: `AorteAbdominaleInput`-style `MiArteresInput` on `MembresInferieursInput`; the rendered Droite/Gauche artery blocks.

- [ ] **Step 1: Extend the service payload types**

Modify `packages/client-secretary/src/services/report-service.ts`. Add to the `membres_inferieurs` input interface (the one carrying `pression_cheville_droite`):

```ts
  arteres?: Record<string, Record<string, { vsm?: number | null; spectre?: string }>>
```

And add to `ReportRecord`:

```ts
  arteres: Record<string, Record<string, { vsm: number | null; spectre: string }>>
```

- [ ] **Step 2: Map the flat form keys to the nested payload**

Modify `packages/client-secretary/src/features/reportFeatures/ReportBuilderHelper.ts`.

Add imports:

```ts
import { MI_ARTERY_KEYS, MI_SIDES } from '@speira-docdoppler/shared-labels'
import { arterySpectreKey, arteryVsmKey } from './types'
```

Add above the class:

```ts
// Flat form keys -> the nested `arteres` payload. Only arteries the doctor
// actually filled in are sent; the API treats an absent artery as unexamined.
function arteresPayload(values: ReportBuilderFormValues) {
  const arteres: Record<
    string,
    Record<string, { vsm: number | null; spectre: string }>
  > = {}
  for (const side of MI_SIDES) {
    for (const artery of MI_ARTERY_KEYS) {
      const spectre = values[arterySpectreKey(side, artery)]
      const vsm =
        artery === 'afc' ? parseOptionalNumber(values[arteryVsmKey(side)]) : null
      if (spectre === '' && vsm === null) continue
      ;(arteres[side] ??= {})[artery] = { vsm, spectre }
    }
  }
  return arteres
}
```

Add to the `membres_inferieurs` object in `createReport`, after `findings_text`:

```ts
        arteres: arteresPayload(values),
```

- [ ] **Step 3: Add a Spectre select to the form**

Modify `packages/client-secretary/src/features/reportFeatures/ReportBuilder.tsx`.

Add imports:

```ts
import {
  MI_ARTERY_KEYS,
  MI_ARTERY_LABELS,
  MI_SIDES,
  MI_SIDE_LABELS,
  SPECTRE_OPTIONS,
} from '@speira-docdoppler/shared-labels'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { arterySpectreKey, arteryVsmKey } from './types'
```

Add a field component beside the existing `NumberField`:

```tsx
// Radix Select throws on an empty SelectItem value, so "not examined" travels
// as a sentinel and is converted back to '' at the form-state boundary.
const SPECTRE_NONE = '__none__'

function SpectreField({
  form,
  name,
  label,
}: {
  form: ReportBuilderFormApi
  name: keyof ReportBuilderFormValues
  label: string
}) {
  const { t } = useTranslation()
  return (
    <form.Field name={name}>
      {(field) => (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>{t(label)}</Label>
          <Select
            value={field.state.value === '' ? SPECTRE_NONE : field.state.value}
            onValueChange={(value) =>
              field.handleChange(value === SPECTRE_NONE ? '' : value)
            }
          >
            <SelectTrigger id={field.name}>
              <SelectValue placeholder={t('Non examinée')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SPECTRE_NONE}>{t('Non examinée')}</SelectItem>
              {SPECTRE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </form.Field>
  )
}
```

- [ ] **Step 4: Render the two side blocks**

In the "Artères des membres inférieurs" `<Card>`, after the existing pressure fields and before the `mi_findings_text` `TextAreaField`, add:

```tsx
            {MI_SIDES.map((side) => (
              <div key={side} className="grid gap-3">
                <h3 className="text-sm font-semibold">{t(MI_SIDE_LABELS[side])}</h3>
                {MI_ARTERY_KEYS.map((artery) => (
                  <div key={artery} className="grid gap-4 sm:grid-cols-2">
                    <SpectreField
                      form={form}
                      name={arterySpectreKey(side, artery)}
                      label={MI_ARTERY_LABELS[artery]}
                    />
                    {artery === 'afc' && (
                      <NumberField
                        form={form}
                        name={arteryVsmKey(side)}
                        label="VSM (cm/s)"
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}
```

Leave the four pressure inputs in place — they feed the IPS calculation.

- [ ] **Step 5: Run checks to verify they pass**

Run: `cd packages/client-secretary && pnpm exec vitest run && pnpm exec tsc --noEmit && pnpm exec eslint src --max-warnings=0`
Expected: PASS, tsc and lint clean.

- [ ] **Step 6: Commit**

```bash
git add packages/client-secretary/src
git commit -m "feat(client): add per-artery spectre and VSM inputs to the report builder"
```

---

### Task 9: Update the documentation

**Files:**
- Modify: `docs/report-module.md`
- Modify: `packages/api-gateway/README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: no code.

- [ ] **Step 1: Record the revision in the report module doc**

Add a `## REVISION 2026-09-01 — structured per-artery entry (membres inférieurs)` section to `docs/report-module.md` covering: the six arteries and their order; Spectre values; the Flux derivation table; VSM on AFC only in cm/s; the `report_arteries` child table and why it needed no migration; sparse rows; that all four pressures became form-only inputs while IPS still prints; that Constatations and the Repères note are unchanged. State explicitly that this **supersedes** the 2026-08-31 "no new structured per-artery fields" deferral **for MI only**, and that TSA remains free-text.

- [ ] **Step 2: Document the API change**

In `packages/api-gateway/README.md`, add `arteres` to the `POST /patients/:id/reports` body example and to the documented `201` response shape, and note that an omitted side/artery means "not examined" and that a bad enum or unknown key returns `REPORT_FIELD_INVALID`.

- [ ] **Step 3: Update the project instructions**

In `CLAUDE.md`, extend the report-module bullet: MI now carries structured per-artery Spectre/VSM in a `report_arteries` child table, with Flux derived from Spectre via `fluxForSpectre` in `shared-labels`.

- [ ] **Step 4: Final full verification**

```bash
cd packages/shared-labels && pnpm exec vitest run
cd ../api-gateway && pnpm exec vitest run && pnpm exec tsc --noEmit
cd ../client-secretary && pnpm exec vitest run && pnpm exec tsc --noEmit && pnpm exec eslint src --max-warnings=0
```
Expected: all suites pass, tsc clean, lint clean.

- [ ] **Step 5: Commit**

```bash
git add docs/report-module.md packages/api-gateway/README.md CLAUDE.md
git commit -m "docs: record the MI per-artery structured entry revision"
```
