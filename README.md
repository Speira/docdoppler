# DocDoppler

Clinic app for vascular echo-Doppler exams: secretary intake (patient
identity + medical history) and a doctor-facing report builder. Local-only,
single-clinic-LAN, no auth for MVP — see `CLAUDE.md` for the full set of
non-negotiable constraints before making changes.

## Packages

- **`packages/api-gateway`** — Node/Express + SQLite backend. `pnpm dev` runs it on `http://localhost:3000`. See its README for the HTTP API.
- **`packages/client-secretary`** — React/TanStack Start frontend: secretary intake screen and doctor report builder (`/reports`). Routes (`src/routes/`) are thin — logic lives in `src/features/<name>Features/`:
  - `/` → `homeFeatures/Home.tsx` — landing page (nav cards + stats)
  - `/patients` → `patientFeatures/PatientList.tsx` — patient list
  - `/patients/add` → `patientFeatures/PatientCreate.tsx` / `PatientEdit.tsx` — create (no `?id=`) or edit (`?id=`) a patient
  - `/reports` → `reportFeatures/ReportList.tsx` — patients + latest report
  - `/reports/$patientId` → `reportFeatures/ReportBuilder.tsx` — findings entry + PDF
  - `/settings` → `settingsFeatures/SettingsForm.tsx` — clinic identity settings
- **`packages/shared-labels`** — shared French label constants (vessel sections, risk factors) used by both `api-gateway`'s PDF generation and `client-secretary`'s report builder form.
- **`packages/dicom-bridge`** — standalone Python DICOM Modality Worklist SCP for the clinic's Mindray ME8. Not wired into the main app — see its README and `docs/dicom-worklist-bridge.md` for why and its current validation status.

## Setup

The JS packages (`api-gateway`, `client-secretary`, `shared-labels`) form a
real pnpm workspace — install once from the repo root, not per-package:

```bash
pnpm install
```

Run the backend and frontend (each `pnpm dev` in its own terminal):

```bash
cd packages/api-gateway && pnpm dev
cd packages/client-secretary && pnpm dev
```

`packages/dicom-bridge` has its own Python setup — see `packages/dicom-bridge/README.md`.

## Tests

```bash
cd packages/api-gateway && pnpm test
cd packages/dicom-bridge && .venv/bin/pytest
```

## Docs

- `CLAUDE.md` — project constraints and data model (read this first)
- `docs/report-module.md` — doctor report builder spec (implemented, including IPS/ABI — formula confirmed from real doctor documents)
- `docs/dicom-worklist-bridge.md` — Mindray-side DICOM configuration notes and open questions
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — design docs and implementation plans for past and in-progress feature work
