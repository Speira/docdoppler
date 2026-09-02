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

- New screen: `/settings` (`client-secretary`), feature-sliced under
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

## Patients/Reports list consolidation (2026-09-01)

The standalone `/reports` patient list was merged into `/patients` — secretaries
were mixing up the two nearly-identical list pages. `/patients` now carries a
"Statut rapport" column, "Voir rapport"/"Nouveau rapport" row actions, and a
report-status filter; `/reports` redirects to `/patients`, `/reports/$patientId`
(the report builder) is unchanged. Only the latest report per patient is
surfaced in the list — browsing older reports for a patient with multiple
visits happens on the patient detail screen (`/patients/add?id=`), which now
shows a read-only "Historique des rapports" list of every report for that
patient, each linking to its PDF.

**Known follow-up:** the patients list decorates each patient with their
latest report via one request per patient
(`PatientListHelper.listPatientsWithReportStatus`, a 1+N fan-out over
`GET /patients/:id/reports`) — fine at clinic scale, but it will not hold at
a few thousand patients now that `/patients` is the app's primary landing
page. The fix when it's needed is to return a `latest_report_id` directly
from `api-gateway`'s patient list query (a `LEFT JOIN` on the latest report
per patient) and drop the fan-out.

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

## REVISION 2026-08-31 — doctor feedback on PDF/form after real use

- **Risk factor labels renamed**: `hypertension` now labels as **"HTA"**, `cholesterol`
  now labels as **"Dyslipidémie"** (was "Hypercholestérolémie"). Changed in
  `packages/shared-labels/src/riskFactors.ts` (drives report builder + PDF) and
  duplicated in `packages/client-secretary/src/features/patientFeatures/consts.ts`
  (drives the intake form checkboxes) — these two lists are not shared, both must
  be edited together for any future label change.
- **Indication is no longer manually typed.** The free-text "Indication" card was
  removed from the report builder form (`ReportBuilder.tsx`). The PDF's INDICATION
  section now always nests a **"Bilan vasculaire"** subsection listing the
  patient's active risk factors (this replaces the old standalone "Antécédents
  médicaux" top-level section — it's the same list, just moved/relabeled).
  `reports.indication` and `Correspondant du dossier` are unchanged in the schema;
  `report-pdf.ts` still prints `report.indication` if a report happens to have
  legacy free text saved, but new reports will always submit it empty.
- **Droite/Gauche subsections in the PDF only** (report builder form layout is
  unchanged — fields stay grouped by type, not by side). RÉSULTATS now nests each
  side's numbers under a bold "Droite" / "Gauche" line within TSA and Membres
  inférieurs. The shared MI brachial pressures (droit/gauche bras — used as the
  reference denominator for both legs' IPS, see formula below) print above the
  Droite/Gauche split since they aren't per-leg data. The findings free-text
  field for TSA and MI stays a single field covering both sides, unchanged —
  only display grouping changed, not data entry.
- **Static reference-criteria notes added to the PDF**, one per RÉSULTATS
  subsection (`TSA_REFERENCE_NOTE`, `AORTE_REFERENCE_NOTE`, `MI_REFERENCE_NOTE`
  in `report-pdf.ts`), printed at 8pt below the findings text. These are
  hardcoded French threshold reference text from the doctor's own feedback
  (VSM stenosis bands for ACI, aorta diameter bands, MI spectre interpretation,
  IPS bands) — **not** computed from the entered data, no auto-labeling of a
  given measurement. This is deliberately just printed reference text, not
  automated clinical interpretation (see "Explicitly out of scope" below) — the
  doctor still writes his own findings/conclusion.
- Explicitly NOT done (deferred, doctor's feedback didn't ask for it): no new
  structured per-artery fields (BULBE plaque, ACI VSM value, artères
  vertébrales flux, fémorale commune/poplitée/tibiale/fibulaire spectre) — the
  doctor confirmed the existing free-text findings boxes are enough and just
  wanted the reference thresholds printed. Revisit only if he asks for
  structured entry per artery segment.

## REVISION 2026-09-01 — PDF layout pass + Unicode font

Layout changes (all in `packages/api-gateway/src/pdf/report-pdf.ts`):

- **Section order is now**: letterhead → **Identité du patient** → **Compte
  rendu** → INDICATION → TECHNIQUE → RÉSULTATS → CONCLUSION. The identity block
  leads the document; "Compte rendu" (its long descriptive title line, plus
  `Date de l'examen` and `Médecin`) follows it.
- **`Correspondant du dossier` moved and relabelled.** It left INDICATION and
  now renders as **`Médecin correspondant : …`**, the last line of the
  **Identité du patient** block — the referring physician reads as part of the
  patient's identity, not as exam metadata. Still backed by the existing
  `reports.correspondant_dossier` column: label and placement changed, schema
  and API did not.
- **Indentation now encodes nesting.** `INDENT_1` (14pt) for level-1 subsections
  (TSA, Aorte abdominale, Membres inférieurs) and their fields; `INDENT_2`
  (28pt) for the level-2 "Gauche"/"Droite" block. Top-level headers
  (INDICATION/TECHNIQUE/RÉSULTATS/CONCLUSION) stay at the margin.
- **Risk factors are inline, not a bulleted column.** "Bilan vasculaire" is no
  longer a bold subsection header followed by one bullet per factor; it is a
  single wrapped line at `INDENT_1` — `Bilan vasculaire : Diabète, HTA,
  Dyslipidémie, …` (or `: Aucun antécédent renseigné.`), matching the
  "label : value" style of the other fields. This supersedes the nested
  subsection described in the 2026-08-31 revision. Order comes from
  `RISK_FACTOR_KEYS`; all eight labels still fit on one line.
- **Droite/Gauche render as an inline list**, one row per side at `INDENT_2`,
  Droite first:
  `- Droite : IMT : 0.62 mm. Ratio ACI/ACC : 1.8`. Built by `drawSideRow` +
  `sidePart` — parts are joined with ". ", a part with no value is dropped, and
  a side with no measurement at all prints no row. This supersedes both the
  stacked bold "Droite"/"Gauche" sub-headers of the 2026-08-31 revision and the
  side-by-side two-column layout that briefly replaced them (`drawTwoColumn` /
  `COLUMN_WIDTH` are gone). Because the row states the side, the field labels
  carry no side suffix and the unit moves onto the value: "IMT droit (mm)" →
  `IMT : 0.62 mm`, "Pression systolique cheville (mmHg)" →
  `Pression cheville : 120 mmHg`.
- **Aorte diameter line relabelled and now self-classifying**:
  "Diamètre / calibre : 22 mm" → `Diamètre antéro-postérieur : 22 mm (Normal)`.
  `classifyAorteDiameter` (exported, unit-tested) resolves the band from the
  measurement using `AORTE_REFERENCE_NOTE`'s thresholds — `< 25 mm` Normal,
  `25–29` Ectasie, `>= 30` Anévrisme. The note leaves 29–30 open; the boundary
  is closed at the clinical convention (`>= 30`).
  **This is a deliberate narrow exception to the 2026-08-31 "no auto-labelling
  of a measurement" rule**, requested by the doctor 2026-09-01. It is scoped to
  this one threshold table and nothing else — TSA/MI reference notes stay
  purely printed text.
  Because `aorte_diametre` is free text, a value that isn't a single
  measurement — a range ("14 à 18 mm"), prose ("non visualisée"), empty —
  falls back to printing the unresolved options `(Normal/Ectasie/Anévrisme)`
  rather than guessing.
- **Both aneurysm fields are retired from the UI and the PDF.** The aorta now
  reads as a single line; there is no `Anévrisme : Oui/Non` tick and no
  separate `Diamètre de l'anévrisme (mm)` — when there is an aneurysm, the
  antéro-postérieur measurement *is* its diameter. Removed from:
  `shared-labels` (`REPORT_FIELD_LABELS.aorte_anevrisme` /
  `…_anevrisme_diametre_mm`, so `ReportFieldKey` narrowed), the report-builder
  form (`types.ts` form-state, `consts.ts` defaults + zod schema, the `Switch`
  and `NumberField` in `ReportBuilder.tsx`), and the request payload
  (`ReportBuilderHelper.createReport`, `AorteAbdominaleInput`).
  Knock-on: `aorte_anevrisme` was the form's only boolean, so with it gone
  every `ReportBuilderFormValues` value is a `string` and the four
  `field.state.value as string` casts in `ReportBuilder.tsx` became redundant
  (removed — lint flagged them).
  **The `aorte_anevrisme` / `aorte_anevrisme_diametre_mm` columns are NOT
  dropped**, and `POST /patients/:id/reports` still accepts both (optional,
  defaulting to `false`/`null`). Reports are append-only medical records — a
  migration would destroy what past exams recorded. They are simply no longer
  written by the app or read by the PDF.
  **Known consequence:** a legacy report that recorded *only* an aneurysm
  (tick and/or its diameter) with an empty `aorte_diametre` and no findings
  text now renders **no Aorte section at all** — `aorteHasContent` is
  `aorte_diametre || aorte_findings_text` only. If that turns out to matter,
  the fix is to fall back to `aorte_anevrisme_diametre_mm` as the displayed
  diameter rather than to re-add the line.
- **`REPORT_FIELD_LABELS.aorte_diametre` relabelled** "Diamètre / calibre" →
  "Diamètre antéro-postérieur (mm)", so the report-builder input matches what
  the PDF prints. Form label only — the PDF does not import
  `REPORT_FIELD_LABELS`.
- **The diameter input is now numeric.** `ReportBuilder.tsx` uses `NumberField`
  instead of `TextField` and the zod rule went `z.string()` →
  `optionalNumericString`, so the doctor types `22`, not `22 mm`.
  The **`aorte_diametre` column stays TEXT** and the API still takes a string —
  no migration, so legacy free-text values ("14 à 18 mm", "non visualisée")
  survive intact and still render. Only new entries are constrained to numbers.
  Because the form now sends a bare number, the PDF appends the unit via
  `formatAorteDiametre` (exported, unit-tested): a value that is only digits /
  separators gets " mm", anything already carrying a unit is left alone — which
  is what stops legacy "22 mm" printing as "22 mm mm".
- **Empty regions are omitted entirely** — header, fields and the "Repères"
  note. A TSA-only exam no longer prints Aorte/MI boilerplate. If all three
  regions are empty, RÉSULTATS prints "Aucun résultat renseigné.". The
  Gauche/Droite header row is likewise skipped when a region has narrative
  findings but no per-side numbers.
- **All dates render dd/mm/yyyy.** `report.exam_date` and
  `clinic_settings.mindray_service_date` were printing raw ISO next to a
  `formatDateFR`'d date of birth. `formatDateFR` now takes `string | null` and
  passes through anything that isn't a plain ISO date rather than rendering
  "Invalid Date".
- **Pagination**: continuation pages repeat `NOM Prénom — né(e) le … — examen
  du …` at the top, and every page gets a right-aligned `Page n/N` footer —
  suppressed on a single-page report so it never reads "Page 1/1". Page numbers
  are stamped in a second pass, since the total isn't known until the end.
- **PDF metadata** is set (Title = `Compte rendu Écho-Doppler — NOM Prénom —
  date`, Author = `report.doctor_name`, Subject, Creator/Producer
  "DocDoppler") so archived files are identifiable in a file manager.

**Font: Liberation Sans, bundled at `packages/api-gateway/assets/fonts/`**
(SIL OFL, `LICENSE.txt` alongside). This replaced pdf-lib's built-in
`StandardFonts.Helvetica`, which is WinAnsi/CP1252-only and **threw** on
characters a vascular report legitimately contains — verified:
`WinAnsi cannot encode "≥" (0x2265)`, same for `≤`, `→`, `≈`. A doctor typing
"sténose ≥ 70%" in any free-text field crashed PDF generation outright.
Liberation Sans is metrically compatible with Helvetica, so the column widths
above were unaffected. Embedded via `@pdf-lib/fontkit` with `subset: true`;
cost is ~3.5KB → ~27KB per PDF (unsubsetted would be ~800KB). The TTFs are
committed — no runtime download, consistent with the local-only constraint.

Also: `wrapText` is now exported and takes a `measure: (text) => number`
callback instead of `(font, size)`, which makes it unit-testable without a
PDF document, and it breaks tokens longer than the line instead of letting
them run off the page edge.

## REVISION 2026-09-01 — structured per-artery entry (membres inférieurs)

**This supersedes the 2026-08-31 "no new structured per-artery fields"
deferral, for membres inférieurs (MI) only.** The doctor asked for structured
per-artery entry for MI specifically; TSA (ACC/bulbe/ACI/vertébrales) is
unaffected — it stays free-text (`tsa_findings_text`) and is explicitly out of
scope here, per the 2026-08-31 note.

- **Six arteries per side, fixed print order**: `afc` (Artère fémorale
  commune), `afs` (Artère fémorale superficielle), `poplitee` (Artère
  poplitée), `tibiale_anterieure` (Artère tibiale antérieure),
  `tibiale_posterieure` (Artère tibiale postérieure), `fibulaire` (Artère
  fibulaire). Sides print Droite then Gauche. All six keys, labels, and the
  side list live in `packages/shared-labels/src/arteries.ts`
  (`MI_ARTERY_KEYS`, `MI_ARTERY_LABELS`, `MI_SIDES`, `MI_SIDE_LABELS`).
- **Each artery takes a Spectre** (`monophasique` | `diphasique` |
  `triphasique`, or empty = not examined — `SPECTRE_OPTIONS`). **VSM (cm/s)
  is entered on the AFC only** — the report builder form exposes a single VSM
  field per side, wired to the `afc` row; nothing else in the six-artery list
  has a VSM input.
- **Flux is derived, never entered or stored.** There is no Flux input and no
  Flux column. `fluxForSpectre(spectre)` in `shared-labels` is the single
  source of the rule, called by both the PDF and (indirectly, for validation
  parity) the form: `triphasique` → `laminaire`, `monophasique` → `amortie`,
  `diphasique` → nothing printed. Confirmed with the doctor 2026-09-01 that
  this applies uniformly to all six arteries, including the ones he writes as
  "Spectre : (idem)".
- **New child table `report_arteries`** (`report_id, side, artery, vsm,
  spectre`, composite primary key, CHECK constraints on `side`/`artery`/
  `spectre`, `ON DELETE CASCADE` on `report_id`), added directly in
  `schema.sql` — see `packages/api-gateway/src/db/schema.sql`. **A child table
  was chosen over 14 flat columns on `reports` specifically because it needed
  no migration**: `schema.sql` is re-executed on every connection
  (`CREATE TABLE IF NOT EXISTS`), so a brand-new table just appears, whereas
  a schema change to the existing `reports` table would need real `ALTER
  TABLE` migration code (none exists in this codebase yet).
- **Rows are sparse**: an artery with neither a spectre nor a VSM gets no row
  (`db/arteries.ts`'s `hasData`); a report with no MI arterial exam writes
  zero artery rows. This mirrors the rest of the report's "only what was
  entered gets stored/printed" convention.
- `db/reports.ts`'s `createReport` now wraps the `reports` insert and the
  artery inserts in one `better-sqlite3` `db.transaction` — all-or-nothing.
  `getReport` and `listReportsByPatient` now return `ReportWithArteries`
  (`ReportRow & { arteres: ArteriesBySide }`); `buildReportPdf` takes the same
  four parameters — the report parameter's type widened from `ReportRow` to
  `ReportWithArteries`.
- **API**: `POST /patients/:id/reports`'s `membres_inferieurs` gains an
  optional `arteres: { [side]: { [artery]: { vsm, spectre } } }`; the response
  returns the same shape under `arteres`. An omitted side, an omitted artery,
  or `spectre: ""` all mean "not examined". An unknown side key, an unknown
  artery key, an invalid spectre value, a non-numeric `vsm`, or an array
  anywhere in the shape all fail validation the same way as every other report
  field — the existing `REPORT_FIELD_INVALID` (no new error code). See
  `packages/api-gateway/src/validation/reports.ts`'s `validateArteries`.
- **Form**: the MI card gains a Droite sub-block and a Gauche sub-block, six
  artery rows each, in `ReportBuilder.tsx`. Form state stays **flat** (e.g.
  `mi_droite_afc_spectre`, `mi_droite_afc_vsm`) to match the existing
  `keyof`-based field helpers; the 14 keys (6 spectres per side + one VSM per
  side), their defaults, and their zod rules are generated from
  `MI_ARTERY_KEYS`/`MI_SIDES` rather than hand-written. A `SpectreField` Select
  carries a `SPECTRE_NONE` sentinel for "Non examinée", because Radix's
  `SelectItem` throws on an empty string value; the sentinel is converted back
  to `''` at the form-state boundary. `arteresPayload` in
  `ReportBuilderHelper.ts` maps the flat form keys to the nested API payload,
  dropping any artery with neither a spectre nor a VSM.
- **PDF, membres inférieurs section**: each side's row now leads with IPS
  alone — `- Droite : IPS : 0.86` — followed by one indented line per examined
  artery, at a new `INDENT_3`, artery name in **bold** with the rest of the
  line (VSM/Spectre/Flux) in the regular font on the same line. This needed a
  new primitive, `drawInlineBold(prefix, rest, indent)` in `report-pdf.ts`,
  because pdf-lib draws one font per `drawText` call — it draws the bold
  prefix, measures it with the bold font, then draws the remainder in the
  regular font at that offset (wrapping the remainder, not the prefix, at the
  right margin). VSM prints with its unit, `VSM : 90 cm/s`, and only appears
  on whichever artery actually has a value (in practice, the AFC).
- **All four systolic pressure lines stopped printing** — both brachial lines
  (`Pression bras droit/gauche`) and the ankle line (`Pression cheville`) that
  the 2026-09-01 layout-pass revision above still showed on each side row.
  They remain as form inputs and DB columns, unchanged, because IPS is
  computed from them (see the IPS section below); only the printed lines are
  gone. A side with no IPS and no examined artery still prints no row at all,
  and `miHasContent` (governing whether the whole MI section prints) now also
  counts artery rows, not just IPS.
- **`Constatations` (`mi_findings_text`) and the `Repères` note are
  unchanged** — still one shared free-text field per report and the same
  static `MI_REFERENCE_NOTE`, even though the note now partly restates the
  structured fields (confirmed acceptable with the doctor 2026-09-01).

## REVISION 2026-09-02 — membres inférieurs card relaid out as a Droite/Gauche matrix

Presentation only — no form-state key, zod rule, `arteresPayload`, API payload
or validation changed. Supersedes the "Droite sub-block / Gauche sub-block"
bullet in the revision above, and the 2026-08-31 note that the form groups
fields by type rather than by side.

- **One three-column grid for the whole card**: `mesure | Droite | Gauche`,
  shared by the systolic pressures, the calculated IPS row and the six artery
  spectre rows (`MI_MATRIX_GRID`/`MI_HEAD_CELL`/`MI_ROW_LABEL`/`MI_CELL` in
  `ReportBuilder.tsx`). The doctor reads limb arterial disease by comparing the
  same artery left vs right, so the two values he compares now sit on one line
  instead of two blocks a scroll apart. It also fills the width that the old
  `sm:grid-cols-2` artery rows wasted on five of six rows (only AFC has a VSM).
- **VSM stays AFC-only** and now hangs as an unruled sub-row directly under the
  AFC row, one input per side in the same columns (`mi_droite_afc_vsm` /
  `mi_gauche_afc_vsm`, unchanged keys).
- **Laterality cue**: the Gauche column carries a continuous `bg-muted/40` band
  from its header down through every row.
- **Accessible names**: the artery name and the side live in the row/column
  headers, so every control keeps a `<Label htmlFor>` that is `sm:sr-only` and
  spells the whole thing out — "Artère poplitée — Gauche — Spectre",
  "VSM à l’AFC (cm/s) — Droite", the full `REPORT_FIELD_LABELS` string for the
  pressures. The field components take `label: string | Array<string>`
  (`useFieldLabel` joins the parts with " — ", each part still passed through
  `t()`).
- **Below `sm` the grid collapses to one column**, the headers and row labels
  hide, and those same labels become visible above each control — so the narrow
  layout is a plain labelled stack, never a squeezed two-column table.

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
