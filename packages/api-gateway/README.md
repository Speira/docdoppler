# api-gateway

Local HTTP API for the clinic app. Runs on `http://localhost:3000` (`pnpm dev`).

All bodies are JSON. All errors are `{ "error": "CODE_NAME" }` — no message text, no French; the frontend maps codes to French labels.

## Patients

### `POST /patients`

Create a patient.

Body (`exam_date` optional, everything else required):

```json
{
  "first_name": "Jean",
  "last_name": "Dupont",
  "dob": "1958-03-12",
  "sex": "M",
  "exam_date": "2026-09-01"
}
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
{
  "diabetes": true,
  "hypertension": false,
  "cholesterol": false,
  "obesity": false,
  "vertigo": false,
  "carotid_bruit": false,
  "avc": false,
  "smoking": false
}
```

- `201` → the created entry: `{ id, patient_id, diabetes, hypertension, cholesterol, obesity, vertigo, carotid_bruit, avc, smoking, created_at, updated_at }` (booleans come back as `0`/`1`, matching SQLite storage)
- `404` → `PATIENT_NOT_FOUND`
- `400` → `RISK_FACTOR_VALUE_INVALID` (a field was sent with a non-boolean value)

## Reports

Reports are **append-only** — each call creates a new report; there is no
update/delete endpoint, and a patient can accumulate multiple reports over
time (re-exams). `exam_date` here is independent of the patient's
`exam_date` — it's snapshotted at report creation, not looked up live.

### `POST /patients/:id/reports`

Arterial-only scope (TSA / aorte abdominale / membres inférieurs) — see
`docs/report-module.md`'s 2026-08-17 revision note for why this replaced the
original carotide/artère+veine membre sup/inf shape.

Body (`doctor_name` and `exam_date` required, everything else optional):

```json
{
  "doctor_name": "Dr. Martin",
  "exam_date": "2026-08-13",
  "correspondant_dossier": "Dr. Petit",
  "indication": "Bilan vasculaire (tabagisme, hypertension)",
  "tsa": {
    "imt_droit": 0.62,
    "imt_gauche": 0.64,
    "aci_acc_ratio_droit": 0.81,
    "aci_acc_ratio_gauche": 0.81,
    "findings_text": "Plaques athéromateuses bilatérales…"
  },
  "aorte_abdominale": {
    "diametre": "14 à 18 mm",
    "anevrisme": true,
    "anevrisme_diametre_mm": 34,
    "findings_text": "Anévrisme fusiforme sous-rénal…"
  },
  "membres_inferieurs": {
    "pression_cheville_droite": 120,
    "pression_cheville_gauche": 130,
    "pression_bras_droit": 130,
    "pression_bras_gauche": 140,
    "findings_text": "Athéromatose diffuse…"
  },
  "conclusion": "Athéromatose polyvasculaire."
}
```

Omitted top-level or nested fields default to `""` (text), `null` (numbers),
or `false` (`aorte_abdominale.anevrisme`).

IPS (`mi_ips_droit`/`mi_ips_gauche`) is **not** an input — the server computes
it from the four `membres_inferieurs` pressures (ankle ÷ higher of the two
brachial pressures, confirmed formula, see `docs/report-module.md`) and
returns it in the response. It's `null` unless all four pressures are given.

- `201` → the created report row: `{ id, patient_id, doctor_name, exam_date, correspondant_dossier, indication, tsa_imt_droit, tsa_imt_gauche, tsa_aci_acc_ratio_droit, tsa_aci_acc_ratio_gauche, tsa_findings_text, aorte_diametre, aorte_anevrisme, aorte_anevrisme_diametre_mm, aorte_findings_text, mi_pression_cheville_droite, mi_pression_cheville_gauche, mi_pression_bras_droit, mi_pression_bras_gauche, mi_ips_droit, mi_ips_gauche, mi_findings_text, conclusion, created_at }` (`aorte_anevrisme` comes back as `0`/`1`, matching SQLite storage)
- `404` → `PATIENT_NOT_FOUND`
- `400` → `DOCTOR_NAME_REQUIRED` | `EXAM_DATE_REQUIRED` | `EXAM_DATE_INVALID` | `REPORT_FIELD_INVALID`

### `GET /patients/:id/reports`

- `200` → the patient's reports, newest first (empty array if none): same shape as the `POST` response, as an array.
- `404` → `PATIENT_NOT_FOUND`

### `GET /reports/:id/pdf`

- `200` → `Content-Type: application/pdf`, the rendered report: a letterhead
  (doctor identity left, clinic address right — sourced from `clinic_settings`,
  see the Settings section below) → INDICATION → TECHNIQUE → RÉSULTATS (TSA /
  Aorte abdominale / Membres inférieurs) → CONCLUSION, plus patient identity
  and risk factors. TECHNIQUE is built from `mindray_characteristics` +
  `mindray_service_date`; if both are unset it falls back to a generic
  sentence.
- `404` → `REPORT_NOT_FOUND`

## Settings

Clinic identity settings are a **singleton** — always exactly one row
(`id` pinned to 1), pre-seeded by `schema.sql`. No create/delete endpoint;
`PUT` always updates the same row. Used to populate the report PDF's
letterhead and TECHNIQUE paragraph (see `docs/report-module.md`'s
2026-08-24 revision).

### `GET /settings`

- `200` → `{ id: 1, doctor_name, professional_membership, rpps_number, adeli_number, address, mindray_service_date, mindray_characteristics, updated_at }` — all string fields default to `""` and `mindray_service_date` defaults to `null` until first saved.

### `PUT /settings`

Body: any subset omitted defaults to `""` (or `null` for `mindray_service_date`) — this is a full replace, not a partial patch.

```json
{
  "doctor_name": "Dr Pembele",
  "professional_membership": "Membre de la société française de radiologie",
  "rpps_number": "12345678901",
  "adeli_number": "939912345",
  "address": "6 avenue Yuri Gagarine 93270 Sevran",
  "mindray_service_date": "2020-03-01",
  "mindray_characteristics": "Mindray Resona 7, sonde linéaire L14-5"
}
```

- `200` → the updated settings row (same shape as `GET`)
- `400` → `SETTINGS_FIELD_INVALID` (a text field wasn't a string) | `MINDRAY_SERVICE_DATE_INVALID` (malformed or not a real calendar date; omit or send `""`/`null` to clear it)

## Worklist

### `GET /worklist?date=YYYY-MM-DD`

Read-only, used by the standalone `packages/dicom-bridge` DICOM SCP (see its
README) — nothing in this app calls it. `date` must be a real calendar date.

- `200` → patients whose `exam_date` matches, ordered by `created_at`: `[{ id, first_name, last_name, dob, sex, exam_date, accession_number, created_at, updated_at }, ...]` (empty array if none match)
- `400` → `DATE_INVALID` (missing, malformed, or calendar-invalid date)

## Out of scope (do not assume these exist)

Deleting a patient, editing/deleting a past risk-factors entry, listing full risk-factors history, editing/deleting a past report, search/filter on the patient list. Wiring patient creation into the DICOM worklist bridge is also out of scope here — see `docs/dicom-worklist-bridge.md`.

IPS/ABI calculation is implemented (see the Reports section above) — the formula was confirmed with the doctor, this is not out of scope.
