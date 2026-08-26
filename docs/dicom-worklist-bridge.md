# DICOM Worklist Bridge — Specification

## Implementation status (2026-08-12)

Code exists: `packages/dicom-bridge` (Python, pynetdicom) implements C-ECHO
and C-FIND, and `packages/api-gateway` exposes `GET /worklist?date=` for it
to call. See `packages/dicom-bridge/README.md` for setup, the security
config (bind host / AE-title allowlisting — off by default, see below), and
the on-site validation checklist. Design rationale:
`docs/superpowers/specs/2026-08-12-dicom-worklist-bridge-design.md`.

The actual implementation is **pull-based**, not push-based: rather than
"on patient save, push into the SCP's dataset" (as described under "Bridge
architecture" below), the SCP calls `GET /worklist` on demand when it
receives a C-FIND, reading current data each time. No push path exists or
is planned — this is simpler and means there's nothing to keep in sync.

Still true regardless of this implementation: C-ECHO and C-FIND have **not**
been tested against the real Mindray unit, and "save patient" is **not**
wired to this module. Everything under "Not yet confirmed" and "Explicitly
out of scope" below still applies.

**Hardening pass (2026-08-24):** at the time, dcmtk/findscu wasn't available
in the dev sandbox, so this pass focused on protocol-level correctness
reachable without the real unit: French-accent character encoding
(`SpecificCharacterSet`), previously-missing MWL tags
(`ScheduledStationAETitle`, `ScheduledProcedureStepID`,
`RequestedProcedureID`), a defensive fallback for malformed date queries,
and a startup warning when the calling-AE allowlist is unset. No behavior
change to the pull-based query flow or the save-patient gate. See
"Worklist query behavior" below for the updated tag list.

**Local loopback smoke test (2026-08-26):** `packages/dicom-bridge/.venv`
now has `pynetdicom`/`pydicom` installed, which bundle their own
`echoscu`/`findscu` CLI tools — dcmtk itself still isn't installed, but
these serve the same purpose for testing without the real Mindray. Ran the
SCP locally (`BRIDGE_ALLOWED_CALLING_AETS=mindray`) against the real,
running `api-gateway` and its 2-row `patients` table: C-ECHO returned
0x0000, and a Modality Worklist C-FIND for each patient's `exam_date`
correctly returned that patient's real name/ID/DOB pulled live from
SQLite. Also confirmed `BRIDGE_ALLOWED_CALLING_AETS` actually rejects an
unrecognized calling AE title. Full transcript in
`packages/dicom-bridge/README.md` ("Local loopback smoke test"). This
validates the bridge's own logic end-to-end but is not a substitute for
the on-site Mindray test below — nothing here confirms Mindray-side
behavior (its actual calling AE title, whether it honors
`ScheduledStationAETitle`, etc.).

## Confirmed Mindray configuration (verified on-site 2026-07-28)

- DICOM Liste de travail (MWL): Installé — no license purchase needed
- Mindray AE Title: mindray
- Mindray DICOM port: 2345
- Mindray TLS port: 2346
- PDU: 32768
- Config location on device: Setup → DICOM/HL7 → Param. service DICOM
- Remote device registration: same screen, "Paramètres du serveur" section —
  add via Périph. (name) + Adresse IP + "Ajouter" button; "Ping" available to
  test reachability before adding

## Not yet confirmed / next on-site test

- Purpose of "Param. service DICOM" and "Déf stratégie DICOM" buttons — likely
  per-device service type assignment (Worklist vs Storage vs Print), unverified
- Whether Mindray requires a specific AE Title configured for our SCP, or accepts
  any registered device — unverified
- C-ECHO (Verify) test — not yet run
- Full C-FIND (worklist query) test — not yet run
- Whether Mindray actually requires/checks `ScheduledStationAETitle` on
  returned worklist items — unverified, currently defaulted to `mindray`

## Bridge architecture (target)

- pynetdicom-based Modality Worklist SCP, running on a local machine on the
  clinic LAN (likely the same laptop/PC as the secretary app, or a dedicated
  small server — TBD)
- On patient save (from secretary app), push patient identity fields
  (nom, prénom, date de naissance, sexe, ID, accession number) into the
  worklist SCP's dataset
- Mindray queries this SCP via Patient → Worklist on the console

## Explicitly out of scope for this module until validated

- Do not wire "save patient" to push to the worklist SCP until Echo + C-FIND
  have both succeeded against the real Mindray unit
- Do not assume DICOM tag requirements beyond the standard set until a real
  query has been tested — Mindray may reject incomplete datasets silently

## Worklist query behavior

- SCP queries `patients` table filtered by `exam_date = <date requested by SCU>`
  (Mindray will typically request "today" by default in its C-FIND query)
- A malformed or unparseable `ScheduledProcedureStepStartDate` in the query
  falls back to today's date rather than propagating a garbage value.
  DICOM date-*range* queries (`YYYYMMDD-YYYYMMDD`) are not implemented —
  out of scope until on-site testing shows Mindray actually sends one; single
  exact-date requests are the only confirmed pattern.
- Sort order: by created_at (entry order) if no time field exists
- Maps to DICOM tags:
  - SpecificCharacterSet — hardcoded `ISO_IR 100` (Latin-1), needed so
    accented French names (e.g. "François", "Bénédicte") round-trip
    correctly
  - PatientName, PatientID, PatientBirthDate, PatientSex — from identity fields
  - AccessionNumber, RequestedProcedureID — from `accession_number`
  - ScheduledStationAETitle — from `BRIDGE_STATION_AET`, defaults to the
    confirmed Mindray AE title `mindray`; **unverified** whether the Mindray
    actually requires this tag or checks its value — on-site test needed
  - ScheduledProcedureStepStartDate — from exam_date
  - ScheduledProcedureStepID — from `accession_number`
  - Modality — hardcoded "US" (ultrasound)
  - ScheduledProcedureStepDescription — hardcoded "Echo Doppler Vasculaire"
    (single exam type per clinic, per earlier scope)
- SCP prints a startup warning when `BRIDGE_ALLOWED_CALLING_AETS` is unset
  (any caller accepted) — see `packages/dicom-bridge/README.md`
