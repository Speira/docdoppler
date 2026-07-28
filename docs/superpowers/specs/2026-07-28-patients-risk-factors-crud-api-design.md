# Patients + Risk Factors CRUD API — Design

Date: 2026-07-28

## Scope

Expose the existing `patients` / `risk_factors` schema (see
`2026-07-26-patients-risk-factors-schema-design.md`) over HTTP in
`packages/api-gateway`, so the secretary intake screen has something to
call. Covers: create/read/update patient, list patients, and appending a
dated risk-factors entry. Does **not** cover deleting patients, editing or
deleting past risk-factors entries, or the `reports` endpoints (doctor
report builder) — those are separate slices.

## Constraints (from CLAUDE.md)

- Local-only, no cloud services.
- No auth for MVP.
- French UI labels — but per this session's decision, the API itself
  returns machine-readable error **codes**, not French text; the frontend
  is responsible for translating codes to French labels.

## Decisions

1. **Risk factors are append-only.** `POST /patients/:id/risk-factors`
   creates a new dated row; there is no update/delete endpoint for a past
   entry, consistent with the schema design treating risk factors as
   history rather than a snapshot.
2. **Patient updates are partial (PATCH semantics).** Callers send only the
   fields that changed; omitted fields are left untouched. Uses the
   `PATCH` HTTP verb since that's the correct semantic (a `PUT` implies a
   full replace).
3. **`GET /patients/:id` inlines the latest risk-factors entry** as
   `riskFactors` (`null` if the patient has none yet), avoiding a second
   round trip for the common case of viewing one patient.
4. **Validation is hand-written, no schema-validation library.** The field
   set is small (4 patient fields, 7 risk-factor booleans) and unlikely to
   grow complex soon — consistent with CLAUDE.md's no-ORM-unless-needed
   stance.
5. **Errors are `{ "error": "CODE_NAME" }`, upper-snake-case, no message
   text.** The frontend owns the code → French label mapping. Codes are a
   closed set enumerated below, not freeform.
6. **Data access is a separate module from the Express routes**, mirroring
   the existing `db/index.ts` pattern — so patient/risk-factor DB
   operations are unit-testable against an in-memory SQLite DB without
   going through HTTP.
7. **`supertest` added as a devDependency** for route-level tests (HTTP
   request/response, status codes, JSON shape) — test-only, doesn't affect
   the local-only runtime.

## Module layout

```
packages/api-gateway/src/
  db/
    schema.sql            -- existing
    index.ts              -- existing
    patients.ts            -- NEW: data-access functions
    patients.test.ts        -- NEW: unit tests against :memory: db
  validation/
    patients.ts            -- NEW: field validators, return error codes
    patients.test.ts        -- NEW
  routes/
    patients.ts             -- NEW: Express Router
    patients.test.ts         -- NEW: supertest route tests
  app.ts                    -- MODIFIED: express.json() + mount router
```

## Routes

All request/response bodies are JSON. `sex` uses internal codes `M`/`F`
(matches the DB `CHECK` constraint); the frontend translates to
"Homme"/"Femme".

### `POST /patients`

Create a patient.

- Body: `{ first_name, last_name, dob, sex }` — all required.
- 201 → the created patient row (no `riskFactors` yet, since none exist).
- 400 → `{ "error": "<CODE>" }` on the first validation failure encountered.

### `GET /patients`

List patients, ordered by `last_name`, then `first_name`.

- 200 → array of `{ id, first_name, last_name, dob, sex }` (no risk
  factors — keeps the list payload light).

### `GET /patients/:id`

- 200 → `{ id, first_name, last_name, dob, sex, created_at, updated_at, riskFactors }`,
  where `riskFactors` is the most recent dated entry (by `created_at`) or
  `null`.
- 404 → `{ "error": "PATIENT_NOT_FOUND" }`.

### `PATCH /patients/:id`

Partial update.

- Body: any subset of `{ first_name, last_name, dob, sex }`.
- 200 → the updated patient row.
- 404 → `{ "error": "PATIENT_NOT_FOUND" }`.
- 400 → `{ "error": "<CODE>" }` if a provided field fails validation.

### `POST /patients/:id/risk-factors`

Append a new dated risk-factors entry.

- Body: any subset of `{ diabetes, hypertension, cholesterol, obesity,
  vertigo, carotid_bruit, avc }` (booleans); omitted fields default to
  `false`, matching the schema's `DEFAULT 0`.
- 201 → the created risk-factors row.
- 404 → `{ "error": "PATIENT_NOT_FOUND" }`.
- 400 → `{ "error": "RISK_FACTOR_VALUE_INVALID" }` if a provided field is
  not a boolean.

## Error codes (closed set for this slice)

| Code | When |
|---|---|
| `FIRST_NAME_REQUIRED` | `first_name` missing/empty (create), or provided empty (update) |
| `LAST_NAME_REQUIRED` | same, for `last_name` |
| `DOB_REQUIRED` | `dob` missing/empty on create |
| `DOB_INVALID` | `dob` not a valid `YYYY-MM-DD` date |
| `DOB_IN_FUTURE` | `dob` is a future date |
| `SEX_REQUIRED` | `sex` missing/empty on create |
| `SEX_INVALID` | `sex` not `M` or `F` |
| `PATIENT_NOT_FOUND` | `:id` doesn't match an existing patient |
| `RISK_FACTOR_VALUE_INVALID` | a risk-factor field provided but not boolean |

Validators return the **first** matching code rather than a list of all
failing fields — enough for this MVP's simple forms; revisit if the
frontend needs to highlight multiple invalid fields at once.

## Testing

- `db/patients.test.ts` — unit tests for each data-access function against
  an in-memory (`:memory:`) DB, same style as `db/index.test.ts`: create,
  get (with/without risk factors), list ordering, partial update, append
  risk-factors entry, not-found cases.
- `validation/patients.test.ts` — unit tests per validator/error code.
- `routes/patients.test.ts` — `supertest` against the Express app (with
  `DB_PATH=:memory:` injected) covering each route's success and error
  status codes/bodies.

## Out of scope (deferred)

- Deleting a patient.
- Editing/deleting a past risk-factors entry.
- Listing full risk-factors history (only the latest is exposed for now).
- `reports` endpoints (doctor report builder).
- Search/filter on `GET /patients` (currently returns the full list).
