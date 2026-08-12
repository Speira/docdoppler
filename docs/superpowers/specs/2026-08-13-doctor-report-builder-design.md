# Doctor Report Builder — Design

Date: 2026-08-13

## Scope

Build the doctor-facing report builder screen described in
`docs/report-module.md`: patient selector → read-only identity/risk-factors
view → per-vessel findings form → PDF generation. Covers the `reports`
table and its API in `packages/api-gateway`, the new `/reports` slice in
`packages/client-secretary`, PDF generation, and — as a prerequisite —
turning the three `packages/*` into a real pnpm workspace so a shared
French-labels package can exist.

Does **not** cover: IPS/ABI (formula unconfirmed with the doctor — see
`docs/report-module.md`'s open question; deferred to a follow-up slice),
auto-import of Mindray measurements, MSSanté/Doctolib/patient-portal
distribution, or authentication.

## Constraints (from CLAUDE.md / docs/report-module.md)

- Local-only, no cloud services, SQLite only.
- No auth for MVP — single doctor.
- French UI labels throughout.
- Report findings are doctor-typed text; no clinical calculation beyond
  what's explicitly specced (IPS is explicitly excluded from this slice).
- Reuses patient identity + risk factors already in the DB — not
  re-entered on this screen.

## Decisions

1. **Reports are immutable and append-only**, same posture as
   `risk_factors`. `POST /patients/:id/reports` always inserts a new row;
   there is no edit/PATCH endpoint. A patient can accumulate multiple
   reports over time (re-exams); to "fix" a report the doctor generates a
   new one. No `updated_at`/trigger on `reports` — nothing ever updates it,
   so the column risk_factors has isn't worth carrying over here.
2. **`reports` snapshots its own `exam_date`, independent of
   `patients.exam_date`.** The patient's `exam_date` is a single mutable
   field the secretary can retarget for the next booking, so a past report
   must not silently point at a rescheduled date. The builder form
   pre-fills `exam_date` from the patient's current value but stores
   whatever was on the form at submit time, editable beforehand.
3. **Findings are explicit columns, one text+abnormal pair per vessel**,
   not a JSON blob — matches how `risk_factors` models its booleans, gets
   DB-level `CHECK` constraints on the abnormal flags, and the vessel list
   (5 sections) is fixed by the Mindray exam menu, not expected to grow.
4. **All 5 vessel sections are optional** (default `''` / not-abnormal);
   only `doctor_name` and `exam_date` are required. A given exam may only
   cover 1-2 vessels, not the full menu.
5. **`doctor_name` is a free-text field on the report row itself**, not a
   separate `doctors` table — CLAUDE.md specifies a single doctor and no
   auth, so there's no entity to normalize against yet.
6. **PDF is generated server-side in `api-gateway`** using `pdf-lib` (no
   headless-browser dependency, fits the local-only/offline posture) via
   `GET /reports/:id/pdf`. The frontend never builds the PDF itself.
7. **French labels shared via a new workspace package
   (`@speira-docdoppler/shared-labels`)**, not duplicated between the
   frontend form and the backend PDF. This requires turning the repo into
   a real pnpm workspace for the first time (see "Workspace migration"
   below) — accepted as worth the one-time cost over hand-syncing ~15
   strings in two places forever.
8. **The `/reports` patient-selector screen is its own component**, not a
   modification of `patientFeatures/PatientList.tsx` — it reuses
   `patientService.listPatients()` but renders its own rows/actions, so the
   `reportFeatures` slice doesn't reach into `patientFeatures` internals.
9. **No new frontend test infra.** `client-secretary` has no test files or
   test runner configured today; this slice follows that existing
   convention (manual QA via the dev server) rather than introducing one.

## Workspace migration (prerequisite)

Today `packages/api-gateway` and `packages/client-secretary` are **not**
linked by a real pnpm workspace — there's no root `pnpm-workspace.yaml`
with a `packages:` glob, and each package has its own independent
`pnpm-lock.yaml`, installed separately. The existing per-package
`pnpm-workspace.yaml` files only set `allowBuilds`.

Steps:
1. Add root `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - packages/*
   allowBuilds:
     better-sqlite3: true
     esbuild: true
     lightningcss: true
     unrs-resolver: true
   ```
   (consolidating the `allowBuilds` entries currently split across
   `api-gateway`'s and `client-secretary`'s own files).
2. Remove the now-redundant per-package `pnpm-workspace.yaml` files.
3. Add `packages/shared-labels` (new package, see below).
4. Add `"@speira-docdoppler/shared-labels": "workspace:*"` to
   `api-gateway`'s and `client-secretary`'s `dependencies`.
5. Delete the three separate `pnpm-lock.yaml` files, run `pnpm install`
   from the repo root to generate one consolidated lockfile.
6. Verify `cd packages/api-gateway && pnpm dev`/`pnpm test` and
   `cd packages/client-secretary && pnpm dev` all still work before
   touching any report code — this step has real breakage risk and is
   done and verified in isolation first.
7. `packages/dicom-bridge` is Python (its own `.venv`) and is unaffected —
   not part of the pnpm workspace.

`README.md` gets a short note that `pnpm install` now needs to run from
the repo root (today's per-package instructions still work, but root
install becomes the source of truth for JS deps).

## `packages/shared-labels`

New package `@speira-docdoppler/shared-labels`, plain TypeScript (no build
step — consumed directly via each package's existing TS-aware tooling,
`tsx` for `api-gateway`, Vite for `client-secretary`).

```
packages/shared-labels/
  package.json          -- name, type: module, no deps
  src/
    vessels.ts           -- VESSEL_KEYS, VESSEL_LABELS (FR)
    riskFactors.ts        -- RISK_FACTOR_LABELS (FR) — for the PDF; the
                             frontend form already has its own FR JSX copy,
                             this is specifically for report-pdf.ts to stay
                             in sync with the vessel labels it sits next to
  index.ts               -- re-exports
```

```ts
// vessels.ts
export const VESSEL_KEYS = [
  'carotide',
  'artere_membre_sup',
  'veine_membre_sup',
  'artere_membre_inf',
  'veine_membre_inf',
] as const
export type VesselKey = typeof VESSEL_KEYS[number]
export const VESSEL_LABELS: Record<VesselKey, string> = {
  carotide: 'Carotide',
  artere_membre_sup: 'Artère membre supérieur',
  veine_membre_sup: 'Veine membre supérieur',
  artere_membre_inf: 'Artère membre inférieur',
  veine_membre_inf: 'Veine membre inférieur',
}
```

Both `report-pdf.ts` (section headers) and `reportFeatures` (form section
labels) import `VESSEL_KEYS`/`VESSEL_LABELS` from here, so the two can
never drift.

## Data model

```sql
CREATE TABLE IF NOT EXISTS reports (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                  INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_name                 TEXT NOT NULL,
  exam_date                   TEXT NOT NULL,
  carotide_text               TEXT NOT NULL DEFAULT '',
  carotide_abnormal           INTEGER NOT NULL DEFAULT 0 CHECK (carotide_abnormal IN (0, 1)),
  artere_membre_sup_text      TEXT NOT NULL DEFAULT '',
  artere_membre_sup_abnormal  INTEGER NOT NULL DEFAULT 0 CHECK (artere_membre_sup_abnormal IN (0, 1)),
  veine_membre_sup_text       TEXT NOT NULL DEFAULT '',
  veine_membre_sup_abnormal   INTEGER NOT NULL DEFAULT 0 CHECK (veine_membre_sup_abnormal IN (0, 1)),
  artere_membre_inf_text      TEXT NOT NULL DEFAULT '',
  artere_membre_inf_abnormal  INTEGER NOT NULL DEFAULT 0 CHECK (artere_membre_inf_abnormal IN (0, 1)),
  veine_membre_inf_text       TEXT NOT NULL DEFAULT '',
  veine_membre_inf_abnormal   INTEGER NOT NULL DEFAULT 0 CHECK (veine_membre_inf_abnormal IN (0, 1)),
  created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_patient_id ON reports(patient_id);
```

## Module layout

```
packages/shared-labels/            -- NEW (see above)

packages/api-gateway/src/
  db/
    reports.ts                      -- NEW: data-access functions
    reports.test.ts                 -- NEW
  validation/
    reports.ts                      -- NEW
    reports.test.ts                 -- NEW
  routes/
    reports.ts                      -- NEW: Express Router
    reports.test.ts                 -- NEW
  pdf/
    report-pdf.ts                   -- NEW: buildReportPdf(patient, riskFactors, report)
    report-pdf.test.ts               -- NEW
  app.ts                           -- MODIFIED: mount reports router
  db/schema.sql                     -- MODIFIED: add reports table

packages/client-secretary/src/
  routes/
    reports.tsx                     -- NEW: patient selector
    reports.$patientId.tsx           -- NEW: findings form / builder
  features/reportFeatures/
    ReportList.tsx                   -- NEW
    ReportBuilder.tsx                -- NEW
    ReportBuilderHelper.ts            -- NEW: loader
    report-service.ts                 -- NEW: mirrors patient-service.ts
    types.ts                          -- NEW
```

## API

### `POST /patients/:id/reports`

- Body: `{ doctor_name, exam_date, carotide?: {text?, abnormal?}, artere_membre_sup?: {...}, veine_membre_sup?: {...}, artere_membre_inf?: {...}, veine_membre_inf?: {...} }`.
  Omitted vessel keys/fields default to `''`/`false`.
- 201 → the created report row.
- 404 → `PATIENT_NOT_FOUND`.
- 400 → `DOCTOR_NAME_REQUIRED` | `EXAM_DATE_REQUIRED` | `EXAM_DATE_INVALID` | `FINDING_ABNORMAL_VALUE_INVALID`.

### `GET /patients/:id/reports`

- 200 → the patient's reports, newest first: `[{ id, patient_id, doctor_name, exam_date, ...findings, created_at }, ...]` (empty array if none). Drives "Nouveau rapport" vs "Voir rapport" on the selector screen.
- 404 → `PATIENT_NOT_FOUND`.

### `GET /reports/:id/pdf`

- 200 → `Content-Type: application/pdf`, streamed body.
- 404 → `REPORT_NOT_FOUND`.

### Error codes (closed set for this slice)

| Code | When |
|---|---|
| `DOCTOR_NAME_REQUIRED` | `doctor_name` missing/empty |
| `EXAM_DATE_REQUIRED` | `exam_date` missing on create |
| `EXAM_DATE_INVALID` | `exam_date` not a valid `YYYY-MM-DD` date |
| `FINDING_ABNORMAL_VALUE_INVALID` | a vessel's `abnormal` field provided but not boolean |
| `PATIENT_NOT_FOUND` | `:id` doesn't match an existing patient |
| `REPORT_NOT_FOUND` | `:id` doesn't match an existing report |

## PDF content

Per `docs/report-module.md`: clinic header, patient identity + DOB + sex,
risk factors (French labels via `shared-labels`), findings per vessel
(French labels via `shared-labels`, abnormal ones visually flagged),
`exam_date`, `doctor_name`. Layout details (fonts, exact spacing) are an
implementation detail, not specced further here.

## Frontend routes

- `/reports` — patient selector (`ReportList`): lists patients, and per row
  either "Nouveau rapport" (no reports yet) or "Voir rapport" (opens the
  most recent report's PDF via `GET /reports/:id/pdf`) alongside "Nouveau
  rapport" to start another.
- `/reports/$patientId` — `ReportBuilder`: loads patient + risk factors
  read-only (`patientService.getPatient`), form with `doctor_name`,
  `exam_date` (pre-filled from patient's current `exam_date`), and the 5
  vessel sections (Textarea + Switch, reusing existing UI primitives).
  "Générer le rapport" → `POST`, then links to the new report's PDF.

## Testing

- `db/reports.test.ts`, `validation/reports.test.ts`,
  `routes/reports.test.ts` — same three-layer vitest pattern as
  `patients`/`risk_factors`: in-memory DB for data-access, pure functions
  for validation, `supertest` for routes.
- `pdf/report-pdf.test.ts` — asserts a valid PDF is produced (parses back
  the buffer, checks page count and that expected label/value strings are
  present) — not pixel-level rendering checks.
- Frontend: manual QA via `pnpm dev`, consistent with `client-secretary`
  having no test infra today.

## Out of scope (deferred)

- IPS/ABI calculation — formula unconfirmed with the doctor.
- Auto-import of Mindray measurements.
- MSSanté/Doctolib/patient-portal distribution.
- Authentication/role separation.
- Editing or deleting a past report.
