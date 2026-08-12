# api-gateway

Local HTTP API for the clinic app. Runs on `http://localhost:3000` (`pnpm dev`).

All bodies are JSON. All errors are `{ "error": "CODE_NAME" }` — no message text, no French; the frontend maps codes to French labels.

## Patients

### `POST /patients`

Create a patient.

Body (`exam_date` optional, everything else required):
```json
{ "first_name": "Jean", "last_name": "Dupont", "dob": "1958-03-12", "sex": "M", "exam_date": "2026-09-01" }
```
`sex` is `"M"` or `"F"`. `dob` is `YYYY-MM-DD`, must be a real calendar date, not in the future. `exam_date` is `YYYY-MM-DD`, must be a real calendar date; if omitted, defaults server-side to today's date. Unlike `dob`, it may be in the future (advance bookings). `accession_number` is generated server-side (`YYYYMMDD-NNN`, sequenced per `exam_date`) and cannot be set by the caller.

- `201` → the created patient row: `{ id, first_name, last_name, dob, sex, exam_date, accession_number, created_at, updated_at }`
- `400` → `FIRST_NAME_REQUIRED` | `LAST_NAME_REQUIRED` | `DOB_REQUIRED` | `DOB_INVALID` | `DOB_IN_FUTURE` | `SEX_REQUIRED` | `SEX_INVALID` | `EXAM_DATE_INVALID`

### `GET /patients`

List all patients, ordered by `last_name` then `first_name`.

- `200` → `[{ id, first_name, last_name, dob, sex, exam_date, accession_number, created_at, updated_at }, ...]`

### `GET /patients/:id`

- `200` → the patient row plus `riskFactors`: the most recent risk-factors entry (see below), or `null` if the patient has none yet.
- `404` → `PATIENT_NOT_FOUND`

### `PATCH /patients/:id`

Partial update — send only the fields that changed. Same field rules as create, except `exam_date` is never defaulted here — omit it to leave it unchanged.

Body: any subset of `{ first_name, last_name, dob, sex, exam_date }`.

- `200` → the updated patient row
- `404` → `PATIENT_NOT_FOUND`
- `400` → same codes as create, for whichever field was sent and is invalid

There is no delete endpoint.

## Risk factors

Risk-factors entries are **append-only** — each call creates a new dated entry; there is no update/delete for a past entry, and no endpoint to list the full history (only the latest, via `GET /patients/:id`).

### `POST /patients/:id/risk-factors`

Body: any subset of the boolean fields below. Omitted fields default to `false`.

```json
{ "diabetes": true, "hypertension": false, "cholesterol": false, "obesity": false, "vertigo": false, "carotid_bruit": false, "avc": false, "smoking": false }
```

- `201` → the created entry: `{ id, patient_id, diabetes, hypertension, cholesterol, obesity, vertigo, carotid_bruit, avc, smoking, created_at, updated_at }` (booleans come back as `0`/`1`, matching SQLite storage)
- `404` → `PATIENT_NOT_FOUND`
- `400` → `RISK_FACTOR_VALUE_INVALID` (a field was sent with a non-boolean value)

## Worklist

### `GET /worklist?date=YYYY-MM-DD`

Read-only, used by the standalone `packages/dicom-bridge` DICOM SCP (see its
README) — nothing in this app calls it. `date` must be a real calendar date.

- `200` → patients whose `exam_date` matches, ordered by `created_at`: `[{ id, first_name, last_name, dob, sex, exam_date, accession_number, created_at, updated_at }, ...]` (empty array if none match)
- `400` → `DATE_INVALID` (missing, malformed, or calendar-invalid date)

## Out of scope (do not assume these exist)

Deleting a patient, editing/deleting a past risk-factors entry, listing full risk-factors history, `reports` endpoints (doctor report builder), search/filter on the patient list. Wiring patient creation into the DICOM worklist bridge is also out of scope here — see `docs/dicom-worklist-bridge.md`.
