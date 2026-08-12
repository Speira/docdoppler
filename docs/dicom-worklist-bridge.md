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
- Sort order: by created_at (entry order) if no time field exists
- Maps to DICOM tags:
  - PatientName, PatientID, PatientBirthDate, PatientSex — from identity fields
  - ScheduledProcedureStepStartDate — from exam_date
  - Modality — hardcoded "US" (ultrasound)
  - ScheduledProcedureStepDescription — hardcoded "Echo Doppler Vasculaire"
    (single exam type per clinic, per earlier scope)
