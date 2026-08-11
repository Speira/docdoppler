# Report Module — Specification

## Data inputs (already in DB)

- Patient identity: prénom, nom, date de naissance, sexe
- Risk factors (antécédents médicaux), grouped:
  - Facteurs de risque cardiovasculaire: diabète, hypertension, hypercholestérolémie,
    obésité, tabagisme (added per doctor's request, 2026-07-XX)
  - Signes et antécédents neurovasculaires: vertiges, souffle carotidien, AVC

## New screen: Report builder (doctor-facing)

- Patient selector: reuse existing PatientList search/filter UI, add a per-row
  action (e.g. "Nouveau rapport" or "Voir rapport") instead of/alongside "Modifier"
- On selection: display patient identity + risk factors read-only (same data,
  not re-entered)
- Findings form, one section per vessel/zone, matching exam menu on the Mindray:
  - Carotide
  - Artère membre supérieur (ext. sup.)
  - Veine membre supérieur (ext. sup.)
  - Artère membre inférieur (ext. inf.)
  - Veine membre inférieur (ext. inf.)
  - Each section: free-text findings field + normal/abnormal toggle
- "Générer le rapport" button: renders PDF with clinic header + patient identity
  - risk factors + findings, ready to print/hand to secretary
- MVP: doctor types findings manually — no auto-populate from Mindray measurements
  (explicitly out of scope for now, see "Explicitly out of scope" below)

## PDF requirements

- Library: puppeteer or pdf-lib (dev's choice, no strong constraint)
- Must include: clinic name/header, patient identity, DOB, risk factors, findings
  per vessel, date of exam, doctor's name
- Output: downloadable/printable, secretary retrieves and sends manually
  (no automated email/MSSanté/patient portal — explicitly out of scope)

## Explicitly out of scope for this module

- No MSSanté/Doctolib/patient portal integration — secretary handles distribution
  manually outside this app
- No auto-import of Mindray measurement data into the report
- No authentication/role separation for MVP

## exam_date field

- Type: DATE
- Default: today (auto-filled on form load)
- Required: yes (always has a value — either the default or a manually picked date)
- Editable: secretary can change it via date picker for advance bookings
- Purpose: drives DICOM worklist filtering (see dicom-worklist-bridge.md) and,
  later, patient list sorting/filtering by appointment date
