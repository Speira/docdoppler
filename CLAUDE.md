# Clinic Vascular Echo-Doppler App

## Non-negotiable constraints

- Local-only. No cloud services, no external APIs, no internet dependency at runtime.
- No authentication for MVP — single secretary, single doctor, one clinic LAN.
- SQLite for storage. No Postgres/cloud DB.
- French UI labels throughout.
- Do not implement MSSanté, Doctolib, or patient-portal features — these are explicitly out of scope, handled manually by clinic staff outside this app.
- DICOM/Modality Worklist integration is a separate, gated module — do not wire it into the main app flow unless explicitly asked. See docs/architecture.md.
- Update the doc (related README.md and CLAUDE.md) each time it is relevant (long sessions task, refactors, impactful additions).
- Use README.md files as source of truth before handling a new task, updates these files to help you saving tokens (pertinents informations, directories informations, specific commands, to do/remaining tasks, ...)

## Stack

- Frontend: React + Vite, plain CSS or Tailwind, no component library assumptions unless specified
- Backend: Node/Express
- DB: SQLite, single file, no ORM required unless the schema grows complex
- JS packages (`api-gateway`, `client-secretary`, `shared-labels`) form a real pnpm workspace (root `pnpm-workspace.yaml`) — `pnpm install` runs once from the repo root, not per-package
- `packages/shared-labels`: small non-DB workspace package holding French label constants (vessel sections, risk factors) shared between `api-gateway`'s PDF generation and `client-secretary`'s report builder form
- DICOM bridge (`packages/dicom-bridge` only, see gate above): Python + pynetdicom, standalone process, not part of the Node stack

## Screens

1. Secretary intake: patient identity + medical history form
2. Doctor report builder: read patient + history, enter findings per vessel, generate PDF

## Data model

- patients: id, first_name, last_name, dob, sex, exam_date, accession_number
- risk_factors: patient_id, diabetes, hypertension, cholesterol, obesity, vertigo, carotid_bruit, avc, smoking (booleans)
- reports: patient_id, findings (per vessel type), created_at

## Additional specs

- Report module (doctor-facing findings + PDF): see docs/report-module.md — implemented
  (packages/api-gateway `reports` table/endpoints, packages/client-secretary `/reports`
  screen, packages/shared-labels for shared FR labels). IPS/ABI is NOT implemented —
  formula unconfirmed with the doctor, see docs/report-module.md's open question.
- DICOM Worklist bridge: see docs/dicom-worklist-bridge.md — the standalone SCP
  (`packages/dicom-bridge`) and its `GET /worklist` endpoint on `api-gateway` are
  implemented and tested, but DO NOT wire this into the main app (no "save
  patient" → push) until explicitly instructed; bridge is unvalidated against
  the real Mindray unit (see file for status)
