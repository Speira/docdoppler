# Report Module — Specification

## Data inputs (already in DB)

- Patient identity: prénom, nom, date de naissance, sexe
- Risk factors (antécédents médicaux), grouped:
  - Facteurs de risque cardiovasculaire: diabète, hypertension, hypercholestérolémie,
    obésité, tabagisme (added per doctor's request, 2026-07-XX)
  - Signes et antécédents neurovasculaires: vertiges, souffle carotidien, AVC

## REVISION 2026-08-17 — scope correction from real doctor documents

The original vessel list below (Carotide / Artère+Veine membre sup. / Artère+Veine
membre inf.) was an assumption based on "the Mindray exam menu" and does NOT match
the doctor's actual practice. Three source documents supersede it:

- Two real (blank-template) compte-rendu PDFs the doctor sent, covering
  "TSA – aorte abdominale – artères des membres inférieurs"
- The doctor's own "début d'activité" letter to referring physicians, explicitly
  scoping his echo-Doppler activity to exactly three exam types: TSA, aorte
  abdominale, artères des membres inférieurs — arterial only, no veins mentioned
  anywhere, no upper limb

**Decision: drop `veine_membre_sup`/`veine_membre_inf` and upper-limb arterial
fields entirely.** This is arterial-only, three-region scope. Source PDFs kept
at `../example-reports/` (outside this package, not committed — contains the
doctor's letterhead/identity, treat as reference only).

**Status: IMPLEMENTED 2026-08-21.** `reports` table, validation, PDF, and the
`client-secretary` form all match the structure below. `Indication` shipped as
free text, not the checklist floated below — simpler for MVP, revisit only if
the doctor asks for it. The clinic identity settings screen (letterhead,
Technique boilerplate) was a deliberate follow-up at the time — see the
REVISION note below, it's now implemented.

## REVISION 2026-08-24 — clinic identity settings implemented, from a real layout sketch

A hand-sketched layout (`example-reports/Echodoppler_plan.pdf`, not committed —
same treat-as-reference-only rule as the other sample PDFs) confirmed the exact
letterhead shape: doctor name + title, **"Membre de la société française de
radiologie"** (a professional-membership line not previously scoped), RPPS,
N° Adeli, and the clinic address, in a two-column header (identity block left,
address right) — plus "Date de mise en service de l'appareil Mindray et
caractéristique" driving the TECHNIQUE paragraph.

**Status: IMPLEMENTED 2026-08-24.**

- New screen: `/parametres` (`client-secretary`), feature-sliced under
  `features/settingsFeatures/` — a single form, no list/detail split, matching
  the "single-row settings" scope.
- New singleton table `clinic_settings` (`api-gateway`, `id` pinned to 1 via a
  `CHECK` constraint, row pre-seeded by `schema.sql`): `doctor_name`,
  `professional_membership`, `rpps_number`, `adeli_number`, `address`,
  `mindray_service_date`, `mindray_characteristics`, `updated_at`.
  `GET /settings` / `PUT /settings` (upsert-only — no create/delete, it's a
  singleton). See `packages/api-gateway/README.md`.
- All six settings fields are optional free text (no required-field
  validation) — the doctor may not have all of them on hand immediately, and
  an incomplete PDF letterhead is better than a blocked settings save.
- `report-pdf.ts` renders these directly into the letterhead (two-column,
  matching the sketch) and builds the TECHNIQUE paragraph from
  `mindray_characteristics` + `mindray_service_date`, falling back to the old
  generic sentence when both are empty. None of the five settings-only fields
  are duplicated onto the `reports` table — for a single-doctor/single-clinic
  MVP they don't vary per report, so the PDF always reads them live from
  `clinic_settings` at render time.
- **Doctor-name resolution, explicitly decided:** `reports.doctor_name` (the
  existing per-report "Médecin" field, labelled thus in the report builder)
  is **not** replaced by `clinic_settings.doctor_name`. Opening the report
  builder for a new report pre-fills "Médecin" from
  `clinic_settings.doctor_name`, but from that point the two are fully
  independent — editing settings later never changes an in-progress or past
  report. This was a deliberate choice (confirmed with the user) over either
  "always the same field" or "fully unrelated, no pre-fill".

## New screen: Report builder (doctor-facing)

- Patient selector: reuse existing PatientList search/filter UI, add a per-row
  action (e.g. "Nouveau rapport" or "Voir rapport") instead of/alongside "Modifier"
- On selection: display patient identity + risk factors read-only (same data,
  not re-entered)
- Findings form, one section per exam region (see "New findings structure")
- "Générer le rapport" button: renders PDF with clinic header + patient identity
  - risk factors + findings, ready to print/hand to secretary
- MVP: doctor types findings manually — no auto-populate from Mindray measurements
  (explicitly out of scope for now, see "Explicitly out of scope" below)

## PDF section structure (confirmed 2026-08-21)

Four top-level bold headers, matching the real report sample and the doctor's
own standard compte-rendu outline:

**INDICATION** → **TECHNIQUE** → **RÉSULTATS** → **CONCLUSION**

RÉSULTATS is where the three-region breakdown below (TSA / Aorte abdominale /
Membres inférieurs) is nested — it's the body of the report, not a separate
top-level section. TECHNIQUE is the boilerplate machine paragraph (see "Clinic
identity settings"). CONCLUSION stays the separate free-text summary already
described below, not folded into RÉSULTATS.

## New findings structure (replaces the old 5-vessel-section list)

Three regions, nested under RÉSULTATS above, matching the doctor's actual practice scope (see revision note above):

- **Indication** — why the exam was ordered. Doctor's own referral letter lists a
  fixed set of indications per exam type (bilan vasculaire: HTA/diabète/tabac/
  dyslipidémie, bilan AIT/AVC, souffle cervical, vol sous-clavier, claudication,
  douleurs de repos ischémiques, troubles trophiques, suivi anévrisme). Proposed:
  checklist of these + free-text fallback for anything else — OPEN QUESTION:
  confirm with doctor whether a checklist actually speeds up his workflow vs.
  plain free text.
- **TSA (troncs supra-aortiques)** — per side (droit/gauche):
  - IMT (numeric, mm) — present as a clean number in the normal-exam sample;
    absent when significant plaque is described instead (the pathological sample
    replaces it with plaque narrative) — treat as optional, not required
  - Ratio ACI/ACC (numeric) — same caveat, optional per side (pathological sample
    only gave a ratio for one side, not both)
  - Plaque / findings (free text, textarea — pathological sample runs several
    sentences per side: location, composition, velocity, stenosis estimate)
  - Doctor types the stenosis grade himself alongside the ratio — do NOT
    auto-derive a % stenosis from the ACI/ACC ratio via a clinical correlation
    table, even though one exists (e.g. NASCET-style). That would be automated
    clinical interpretation, which this project explicitly excludes (see IPS
    section below and "Explicitly out of scope")
- **Aorte abdominale**:
  - Calibre/diamètre (text or numeric range, mm — normal sample gives a range
    "14 à 18 mm")
  - Anévrisme: boolean + measurement in mm if present (pathological sample: 34mm)
  - Plaque / findings (free text)
- **Artères des membres inférieurs** — see IPS section below for the pressure/IPS
  fields; also a free-text findings field per side (plaque, sténose, flux
  triphasique/biphasique description)
- **Conclusion** — free text, overall summary distinct from per-region findings
  (both real samples end with a bulleted conclusion separate from the body)

## PDF requirements

- Library: puppeteer or pdf-lib (dev's choice, no strong constraint)
- Must include: clinic/doctor letterhead (see "Clinic identity settings" below),
  patient identity, DOB, risk factors, Indication, findings per region, IPS,
  Conclusion, date of exam, referring doctor ("Correspondant du dossier")
- Output: downloadable/printable, secretary retrieves and sends manually
  (no automated email/MSSanté/patient portal — explicitly out of scope)

## Clinic identity settings (new — not previously scoped)

Real reports show a fixed letterhead (doctor name, specialty, RPPS/N° ADELI,
address, phone) and a near-boilerplate "Technique" paragraph naming the Mindray
machine + serial number + service date — none of this is per-report data.

- Store as an editable in-app setting (not hardcoded), per doctor's preference —
  a single-row settings table/screen, not a multi-user settings system
- Used to populate: PDF letterhead, the "Technique" paragraph, and (new) a
  "Correspondant du dossier" field on the report (referring physician, free text)
- This is a new small screen beyond CLAUDE.md's original two (secretary intake,
  doctor report builder) — update CLAUDE.md's "Screens" section when this is built

## Explicitly out of scope for this module

- No MSSanté/Doctolib/patient portal integration — secretary handles distribution
  manually outside this app
- No auto-import of Mindray measurement data into the report
- No authentication/role separation for MVP
- No automated clinical interpretation: doctor types stenosis grade, plaque
  characterization, and conclusions himself. The app only does deterministic
  arithmetic it's explicitly told to do (IPS from pressures) — never derives a
  diagnosis or grading from a measurement

## exam_date field

- Type: DATE
- Default: today (auto-filled on form load)
- Required: yes (always has a value — either the default or a manually picked date)
- Editable: secretary can change it via date picker for advance bookings
- Purpose: drives DICOM worklist filtering (see dicom-worklist-bridge.md) and,
  later, patient list sorting/filtering by appointment date

## IPS (Index de Pression Systolique / ABI) — formula confirmed 2026-08-21

Doctor confirmed directly: "les deux chevilles et deux bras, [s]ystolique (pas
besoin de diastolique)" — four raw inputs, systolic only, no diastolic fields.

- Raw inputs (numeric, mmHg): `pression_systolique_cheville_droite`,
  `pression_systolique_cheville_gauche`, `pression_systolique_bras_droit`,
  `pression_systolique_bras_gauche`
- Calculated outputs, auto-computed and shown live as the four fields are filled:
  - `ips_droit` = cheville droite ÷ max(bras droit, bras gauche)
  - `ips_gauche` = cheville gauche ÷ max(bras droit, bras gauche)
- Store the four raw pressures AND the two calculated ratios (not just the
  ratios) — lets a value be audited/recomputed later if the formula needs
  revisiting, and matches the doctor's actual workflow of reading pressures off
  the cuff one at a time
- Arm-pairing convention CONFIRMED 2026-08-21 via worked example: reference
  brachial pressure is the higher of the two arms, used as the denominator for
  BOTH sides (not same-side pairing). Example given: bras droit 130 / bras
  gauche 140 → référence 140 for both; cheville droite 120 → IPS droit 0,86;
  cheville gauche 130 → IPS gauche 0,93. Matches the standard AHA/ESC convention
  already assumed above — no longer an open question.
- Diagnostic thresholds exist (≤0,90 anormal/AOMI, 0,91–0,99 limite) but the app
  does NOT auto-label a computed IPS with "anormal"/"limite" — that applies a
  diagnostic cutoff, which is clinical interpretation, out of scope per below.
  Show the doctor the calculated number only; he writes the interpretation
  himself in the free-text findings/Conclusion. Revisit only if he explicitly
  asks for the threshold label.
- This is deterministic arithmetic the doctor explicitly asked for — NOT an
  AI/LLM interpretation feature, no clinical judgment automation (see
  "Explicitly out of scope")
