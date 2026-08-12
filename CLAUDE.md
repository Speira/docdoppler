# Clinic Vascular Echo-Doppler App

## Non-negotiable constraints

- Local-only. No cloud services, no external APIs, no internet dependency at runtime.
- No authentication for MVP — single secretary, single doctor, one clinic LAN.
- SQLite for storage. No Postgres/cloud DB.
- French UI labels throughout.
- Do not implement MSSanté, Doctolib, or patient-portal features — these are explicitly out of scope, handled manually by clinic staff outside this app.
- DICOM/Modality Worklist integration is a separate, gated module — do not wire it into the main app flow unless explicitly asked. See docs/architecture.md.
- Update the doc (related README.md) each time a big task is done.

## Stack

- Frontend: React + Vite, plain CSS or Tailwind, no component library assumptions unless specified
- Backend: Node/Express
- DB: SQLite, single file, no ORM required unless the schema grows complex
- DICOM bridge (`packages/dicom-bridge` only, see gate above): Python + pynetdicom, standalone process, not part of the Node stack

## Screens

1. Secretary intake: patient identity + medical history form
2. Doctor report builder: read patient + history, enter findings per vessel, generate PDF

## Data model

- patients: id, first_name, last_name, dob, sex, exam_date, accession_number
- risk_factors: patient_id, diabetes, hypertension, cholesterol, obesity, vertigo, carotid_bruit, avc, smoking (booleans)
- reports: patient_id, findings (per vessel type), created_at

## Additional specs

- Report module (doctor-facing findings + PDF): see docs/report-module.md
- DICOM Worklist bridge: see docs/dicom-worklist-bridge.md — the standalone SCP
  (`packages/dicom-bridge`) and its `GET /worklist` endpoint on `api-gateway` are
  implemented and tested, but DO NOT wire this into the main app (no "save
  patient" → push) until explicitly instructed; bridge is unvalidated against
  the real Mindray unit (see file for status)
