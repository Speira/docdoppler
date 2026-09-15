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

0. Homepage (`/`, implemented 2026-08-24): landing page with cards linking to Patients/Rapports/Paramètres + light stats (patient count, patients with a report, settings configured); global `SiteHeader`/`SiteFooter` (app name "DocDoppler") wrap every route via `routes/__root.tsx`
1. Secretary intake: patient identity + medical history form — `/patients/add` creates (and returns to the `/patients` list after a successful save, since 2026-09-11), `/patients/$patientId` edits (split 2026-09-02; the old `/patients/add?id=N` still 301s to the new URL via `beforeLoad`, and `PatientEditHelper.parsePatientId` validates the path param — a non-numeric or unknown-shaped id renders `PatientNotFound`, an unknown-but-valid id surfaces the API's `PATIENT_NOT_FOUND` through `RouteError`). Patient list is `/patients`, merged 2026-09-01 with report status/actions (see below) and a `?reportFilter=all|with|without` filter; `/reports` redirects here. The edit screen also shows a paginated "Historique des rapports" list (first 3 — `patientReportHistoryPageSize` — with "Voir plus" paging in the rest; header count is the server-side total) — `GET /patients/:id/reports` is bounded and slim since 2026-09-02, see `packages/api-gateway/README.md`.
   Create and edit share `PatientEditorFrame` (header, form, sticky action bar, both confirmation dialogs) and `usePatientUnsavedGuard`; they differ only in copy, submit behaviour and the edit-only extras (report history, delete). Reworked 2026-09-02 alongside the list: island panels, two-column identity grid via container queries, risk factors as palm-tinted toggle cards in `<fieldset>`s, patient name as the `<h1>` (from the saved baseline, not the live field), and a sticky save bar so the primary action is never off-screen.
   Date fields (2026-09-11): the shared `Input` no longer calls `showPicker()` on click — the calendar popup grabbed the keyboard, so typing into any native date field was silently swallowed; the calendar now opens from the field's icon only. Date of birth stays a native date input like the exam date (a three-box Jour/Mois/Année variant was tried and rejected by the user); its schema adds "invalide" (`DateOfBirthHelper.isRealIsoDate`) and a year ≥ 1900 rule on top of "requise"/"pas dans le futur". Native date fields display in the browser's locale order, not necessarily jj/mm/aaaa.
   The list table was redesigned 2026-09-02: identity, date of birth, age, sex and file number collapse into one
   name-led column (the name is the link to the patient file — the per-row "Modifier" button is gone, and the row itself is
   no longer a click target, so no `stopPropagation` juggling); rows are grouped into exam-day sections (2026-09-11,
   replacing a three-state exam-date sort whose default "API order" was alphabetical and looked broken):
   Aujourd'hui → À venir (soonest first) → Précédents (most recent first), same-day patients alphabetical via an
   `Intl.Collator('fr')` (case/accent-insensitive, unlike SQLite's ORDER BY), empty sections hidden, one `<tbody>` +
   `<th scope="rowgroup">` per section — `PatientListHelper.groupByExamDay` / `todayIso` (local day, not UTC); report status is a chip plus a `--palm` rail in the row's left gutter
   (`.patient-row` in `styles.css`), and its column folds into the name cell below `lg`; action labels collapse to icons
   below `sm`, so the table fits a 390px viewport without horizontal scroll. Empty results distinguish "no patients yet"
   from "nothing matches the current search/filter" (`PatientListHelper.emptyState`). Note the global `a` rule in
   `styles.css` is scoped `a:not([data-slot='button'])` so `<Button asChild><Link/></Button>` keeps the button's colours.
2. Doctor report builder: read patient + history, enter findings per exam region, generate PDF — reached from `/patients` row actions at `/reports/$patientId`; the list surfaces only the latest report per patient, older reports are on the patient detail screen's history list
3. Clinic identity settings (`/settings`, implemented 2026-08-24): doctor/clinic letterhead + Mindray machine info, used as defaults in the report PDF — see docs/report-module.md

## Data model

- patients: id, first_name, last_name, dob, sex, exam_date, accession_number —
  `sex` is `'M'`, `'F'` or `'O'` ("Autre" in the UI; `'O'` is DICOM's own code for
  other, so the worklist bridge passes it through to PatientSex unchanged). Widening
  the column's CHECK constraint on an already-created database is handled by
  `ensureSexAllowsOther` in `db/index.ts`, which rebuilds the table — `CREATE TABLE
  IF NOT EXISTS` cannot alter a CHECK.
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
  docs/report-module.md. PDF layout reworked 2026-09-01 (indentation reflects nesting,
  Gauche/Droite as inline `- Droite : …` rows, risk factors inline as `Bilan vasculaire : HTA, …`,
  empty regions omitted, dd/mm/yyyy dates, `Page n/N` on multi-page reports, PDF metadata)
  — see that file's 2026-09-01 revision. The aorta's Normal/Ectasie/Anévrisme band is now
  **derived** from the diameter (`classifyAorteDiameter`) — a deliberate, narrowly-scoped
  exception to the "no auto-labelling of a measurement" rule; the `anevrisme` tick and
  `anevrisme_diametre_mm` field were removed from the form/PDF as a result. Their DB columns
  are kept (reports are append-only medical records) and the API still accepts them.
  **The PDF font is Liberation Sans, committed at `packages/api-gateway/assets/fonts/`** and
  embedded via `@pdf-lib/fontkit`; do not revert to pdf-lib's `StandardFonts`, which are
  CP1252-only and throw on `≥`/`≤`/`→` in the doctor's free text.
  Membres inférieurs now also carries structured per-artery Spectre/VSM (six arteries, VSM on
  AFC only) in a new `report_arteries` child table — no migration needed since `schema.sql`
  re-runs on every connection — with Flux derived from Spectre via `fluxForSpectre` in
  `shared-labels`. Supersedes the 2026-08-31 "no structured per-artery fields" deferral for MI
  only; TSA stays free-text. See docs/report-module.md's 2026-09-01 revision.
- DICOM bridge: see docs/dicom-worklist-bridge.md — two standalone SCPs in
  `packages/dicom-bridge`, both gated. (1) Modality Worklist SCP
  (`dicom_bridge.run`, `DOCDOPPLER:11112`) + its `GET /worklist` endpoint on
  `api-gateway` — implemented, and C-ECHO/C-FIND/exam-start confirmed on-site
  2026-09-01. Since 2026-09-11 worklist items also carry the risk factors as
  `AdditionalPatientHistory` (0010,21B0) — text built API-side by
  `formatRiskFactorList` in `shared-labels` (shared with the PDF), the bridge
  only copies it; ME8 display of that tag is unverified. (2) Storage SCP (`dicom_bridge.run_store`, `DOCDOPPLER-STORE:11113`,
  added 2026-09-06) — accepts Comprehensive SR Storage over C-STORE and saves the
  raw file to `data/received_sr/<StudyInstanceUID>/<SOPInstanceUID>.dcm`; it does
  **not** parse the SR, that is a separate task. Confirmed end-to-end against the
  real ME8 2026-09-11 (Comprehensive SR, TID 5100); the export's contents do not
  map cleanly onto `reports` fields — read the bridge README before parsing.
  DO NOT wire either into the main app
  (no "save patient" → push, no SR → report import) until explicitly instructed.

## Working style

- Do not start either dev server (`api-gateway`'s `pnpm dev` / `tsx watch src/server.ts`, or `client-secretary`'s `pnpm dev` / vite dev) on your own initiative to verify a change — the user runs and tests the app themselves. Verify backend/logic changes via the test suites (`pnpm test` / vitest) and type-checking instead; for frontend changes, type-check + lint + tests, then tell the user the change is unverified in a running app rather than launching it yourself. Ask first if a live check genuinely seems necessary.
