# DICOM Worklist Bridge — Standalone SCP Module — Design

Date: 2026-08-12

## Scope

Build the Modality Worklist SCP described in `docs/dicom-worklist-bridge.md`
as a **standalone, gated module**: a Python process implementing DICOM
Verification (C-ECHO) and Modality Worklist FIND (C-FIND), backed by a new
read-only endpoint on the existing Express API. Covers: the SCP itself, the
worklist endpoint, patient→DICOM tag mapping, and automated protocol tests
against a local test client.

Does **not** cover: wiring "save patient" to push into the worklist (see
Constraints), resolving the unconfirmed Mindray-side questions (AE title
acceptance, "Param. service DICOM" / "Déf stratégie DICOM" button purpose),
or any real on-site test against the physical Mindray ME8 — those remain
open until the next clinic visit.

## Constraints (from CLAUDE.md and docs/dicom-worklist-bridge.md)

- Local-only, no cloud services, no internet dependency at runtime.
- No auth for MVP — the new worklist endpoint is unauthenticated, consistent
  with the rest of the API.
- DICOM/MWL is "a separate, gated module — do not wire it into the main app
  flow unless explicitly asked." This design deliberately stops short of
  that wiring.
- Per `docs/dicom-worklist-bridge.md`: "Do not wire 'save patient' to push
  to the worklist SCP until Echo + C-FIND have both succeeded against the
  real Mindray unit" — unconfirmed as of this design (last on-site visit
  2026-07-28).
- SQLite is the source of truth; the bridge does not open the `.sqlite` file
  itself, to avoid a second process contending for file locks (see
  Decisions).

## Decisions

1. **New package `packages/dicom-bridge/`, Python, matching the
   `pynetdicom`-based approach already specified.** It is not part of the
   Node workspace; it's a separate process with its own `requirements.txt`
   and its own test suite.
2. **The bridge reads patient data over HTTP, not by opening the SQLite file
   directly.** A new read-only endpoint on `packages/api-gateway`
   (`GET /worklist?date=YYYY-MM-DD`) is the only integration point between
   the two processes. This avoids SQLite locking concerns between a Node
   writer and a Python reader, and keeps the "gate" enforceable in one
   place: as long as nothing calls this endpoint's data into a save-patient
   trigger, the module stays inert.
3. **New `accession_number` column on `patients`**, populated on insert as
   `YYYYMMDD-NNN` — exam date + zero-padded daily sequence (e.g.
   `20260812-001`), computed server-side in the existing
   `db/patients.ts` insert path. Sequence resets per day, scoped by
   `exam_date`, not by wall-clock date, so backdated/future exam entries
   still get a sane per-day sequence. Added via a guarded `ALTER TABLE`
   (`ensureAccessionNumberColumn`, mirroring the existing
   `ensureExamDateColumn` pattern in `db/index.ts`), not a rewrite of
   `schema.sql`'s `CREATE TABLE IF NOT EXISTS` — existing DBs need the
   column added in place. Backfill for pre-existing rows (which have no
   `accession_number`): generate one from their existing `exam_date` and
   `created_at` order, same format, same per-day sequencing rule.
4. **AE title and port are configurable, not hardcoded**, because the spec
   explicitly flags both as unconfirmed against the real Mindray
   (`docs/dicom-worklist-bridge.md`: "Whether Mindray requires a specific AE
   Title configured for our SCP... unverified"). Defaults: AE title
   `DOCDOPPLER`, port `11112` (the DICOM-registered default, distinct from
   Mindray's own ports 2345/2346). Both overridable via environment
   variables so the next on-site visit can adjust without a code change.
5. **Only two SOP classes are implemented**: Verification and Modality
   Worklist FIND. No C-STORE, no Print, no Query/Retrieve — matches the
   spec's stated need (worklist only) and keeps the SCP's surface small.
6. **Hardcoded per the existing spec**: `Modality` = `"US"`,
   `ScheduledProcedureStepDescription` = `"Echo Doppler Vasculaire"` — single
   exam type per clinic, already decided in `docs/dicom-worklist-bridge.md`.
7. **The bridge process is started manually** (a `run.sh` / documented
   command), not auto-launched by the Node app or a process manager. This
   keeps it decoupled and optional, matching "gated module" — someone has
   to deliberately start it.
8. **Testing uses `dcmtk`'s `echoscu`/`findscu` CLI tools** (or pynetdicom's
   own SCU helpers if `dcmtk` isn't available in CI) driven from Python test
   scripts, run against the bridge bound to `localhost` on an ephemeral
   port — no real Mindray hardware needed for this round.

## Module layout

```
packages/dicom-bridge/
  requirements.txt
  config.py            -- AE title, port, worklist endpoint URL (env-overridable)
  worklist_client.py    -- HTTP client: GET {endpoint}?date=... -> list[dict]
  mapping.py            -- patient dict -> pydicom Dataset (tag mapping)
  scp.py                -- pynetdicom AE: handle_echo, handle_find
  run.py                -- entrypoint, starts the AE and blocks
  tests/
    test_mapping.py      -- unit: dict -> Dataset field-by-field
    test_scp_echo.py      -- integration: echoscu against local SCP
    test_scp_find.py      -- integration: findscu against local SCP with fixture data (via a stub worklist_client)

packages/api-gateway/src/
  routes/
    worklist.ts           -- NEW: GET /worklist
    worklist.test.ts        -- NEW
  db/
    patients.ts            -- MODIFIED: generate accession_number on insert
    index.ts                -- MODIFIED: ensureAccessionNumberColumn migration + backfill
    schema.sql               -- MODIFIED: add accession_number column (new DBs)
```

## `GET /worklist` endpoint

- Query param: `date` (required, `YYYY-MM-DD`).
- 200 → array of
  `{ id, first_name, last_name, dob, sex, exam_date, accession_number }`
  for patients where `exam_date = :date`, ordered by `created_at`.
- 400 → `{ "error": "DATE_INVALID" }` if `date` is missing or not a valid
  `YYYY-MM-DD` string.
- No auth, matching the rest of the API's MVP posture.

## Tag mapping (`mapping.py`)

Per `docs/dicom-worklist-bridge.md`, one worklist item per patient row:

| DICOM tag | Source |
|---|---|
| PatientName | `last_name^first_name` (DICOM `^`-separated format) |
| PatientID | `id` |
| PatientBirthDate | `dob`, reformatted `YYYY-MM-DD` → `YYYYMMDD` |
| PatientSex | `sex` (`M`/`F`, already matches DICOM's expected values) |
| AccessionNumber | `accession_number` |
| ScheduledProcedureStepStartDate | `exam_date`, reformatted → `YYYYMMDD` |
| Modality | `"US"` (hardcoded) |
| ScheduledProcedureStepDescription | `"Echo Doppler Vasculaire"` (hardcoded) |

No other tags are populated for now — per the spec, "Do not assume DICOM tag
requirements beyond the standard set until a real query has been tested."
If the real Mindray silently rejects incomplete datasets during the next
on-site test, this table is the place to extend.

## Testing

- `test_mapping.py` — pure unit tests: given a patient dict, assert each
  DICOM tag on the resulting `Dataset`.
- `test_scp_echo.py` — start the SCP against `localhost:<ephemeral>`, run
  `echoscu` against it, assert success status.
- `test_scp_find.py` — same setup, `worklist_client` stubbed to return fixed
  fixture rows (no real Express server needed), run `findscu` with a date
  matching key, assert the returned dataset(s) match the fixture via the
  tag mapping table above.
- `worklist.test.ts` (Node side) — `supertest` against the new route:
  correct filtering by `exam_date`, `DATE_INVALID` on bad/missing date,
  empty array when no patients match.
- Accession-number generation gets a unit test in `db/patients.test.ts`:
  sequence increments within the same `exam_date`, resets for a different
  `exam_date`.

None of this exercises the real Mindray unit — that remains manual,
on-site, next visit, per the existing gate.

## Out of scope (deferred)

- Wiring "save patient" → push to worklist SCP (blocked on real on-site
  Echo + C-FIND success, per existing gate in
  `docs/dicom-worklist-bridge.md`).
- Determining whether Mindray needs a specific AE title from our SCP, or
  what "Param. service DICOM" / "Déf stratégie DICOM" configure — open
  questions carried forward, to be resolved on-site.
- Any DICOM tags beyond the table above (e.g. institution, referring
  physician) — add only if a real query against the Mindray shows they're
  required.
- C-STORE, Query/Retrieve, Print SOP classes — not needed for worklist-only
  use.
- Process supervision (systemd unit, auto-restart) for the bridge — manual
  start is enough until the module is validated and actually adopted.
