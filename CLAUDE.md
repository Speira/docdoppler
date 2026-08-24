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

0. Homepage (`/`, implemented 2026-08-24): landing page with cards linking to Patients/Rapports/Paramètres + light stats (patient count, patients with a report, settings configured); global `SiteHeader`/`SiteFooter` (app name "Echo Link") wrap every route via `routes/__root.tsx`
1. Secretary intake: patient identity + medical history form (`/patients/add`, create or edit via `?id=`) — patient list is `/patients`
2. Doctor report builder: read patient + history, enter findings per exam region, generate PDF
3. Clinic identity settings (`/settings`, implemented 2026-08-24): doctor/clinic letterhead + Mindray machine info, used as defaults in the report PDF — see docs/report-module.md

## Data model

- patients: id, first_name, last_name, dob, sex, exam_date, accession_number
- risk_factors: patient_id, diabetes, hypertension, cholesterol, obesity, vertigo, carotid_bruit, avc, smoking (booleans)
- reports: patient_id, doctor_name, exam_date, correspondant_dossier, indication, TSA fields
  (imt/aci_acc_ratio per side + findings), aorte abdominale fields (diametre/anevrisme/findings),
  membres inférieurs fields (4 systolic pressures + calculated IPS per side + findings),
  conclusion, created_at — arterial-only scope (TSA/aorte/MI), see docs/report-module.md
- clinic_settings: single-row singleton (id pinned to 1) — doctor_name, professional_membership,
  rpps_number, adeli_number, address, mindray_service_date, mindray_characteristics, updated_at.
  Populates the report PDF's letterhead + TECHNIQUE paragraph as defaults; editable any time via
  `/settings`, independent of any already-generated report. See docs/report-module.md

## Additional specs

- Report module (doctor-facing findings + PDF): see docs/report-module.md — implemented
  2026-08-21 with the arterial-only scope (TSA/aorte abdominale/membres inférieurs) confirmed
  from real doctor documents (sample reports + his practice scope letter, kept at
  `../example-reports/`, not committed). IPS/ABI is implemented: 4 raw systolic pressures in,
  2 calculated ratios out (ankle ÷ higher of the two brachial pressures — confirmed formula).
  Clinic identity settings (letterhead, Technique boilerplate) is implemented 2026-08-24 as
  the `/settings` screen + `clinic_settings` singleton table — the report PDF's letterhead
  (doctor name, professional membership line, RPPS/Adeli, address) and TECHNIQUE paragraph
  (Mindray service date + characteristics) now render from these settings, replacing the
  earlier hardcoded placeholders. `reports.doctor_name` stays a separate, per-report field —
  it's pre-filled from `clinic_settings.doctor_name` when a new report is started, but stays
  independently editable and is never retroactively affected by later settings changes. See
  docs/report-module.md.
- DICOM Worklist bridge: see docs/dicom-worklist-bridge.md — the standalone SCP
  (`packages/dicom-bridge`) and its `GET /worklist` endpoint on `api-gateway` are
  implemented and tested, but DO NOT wire this into the main app (no "save
  patient" → push) until explicitly instructed; bridge is unvalidated against
  the real Mindray unit (see file for status)

## Working style

- Do not start either dev server (`api-gateway`'s `pnpm dev` / `tsx watch src/server.ts`, or `client-secretary`'s `pnpm dev` / vite dev) on your own initiative to verify a change — the user runs and tests the app themselves. Verify backend/logic changes via the test suites (`pnpm test` / vitest) and type-checking instead; for frontend changes, type-check + lint + tests, then tell the user the change is unverified in a running app rather than launching it yourself. Ask first if a live check genuinely seems necessary.
