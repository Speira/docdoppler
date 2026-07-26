# Clinic Vascular Echo-Doppler App

## Non-negotiable constraints

- Local-only. No cloud services, no external APIs, no internet dependency at runtime.
- No authentication for MVP — single secretary, single doctor, one clinic LAN.
- SQLite for storage. No Postgres/cloud DB.
- French UI labels throughout.
- Do not implement MSSanté, Doctolib, or patient-portal features — these are explicitly out of scope, handled manually by clinic staff outside this app.
- DICOM/Modality Worklist integration is a separate, gated module — do not wire it into the main app flow unless explicitly asked. See docs/architecture.md.

## Stack

- Frontend: React + Vite, plain CSS or Tailwind, no component library assumptions unless specified
- Backend: Node/Express
- DB: SQLite, single file, no ORM required unless the schema grows complex

## Screens

1. Secretary intake: patient identity + medical history form
2. Doctor report builder: read patient + history, enter findings per vessel, generate PDF

## Data model

- patients: id, first_name, last_name, dob, sex
- risk_factors: patient_id, diabetes, hypertension, cholesterol, obesity, vertigo, carotid_bruit, avc (booleans)
- reports: patient_id, findings (per vessel type), created_at
