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

**Update (2026-09-01):** C-ECHO and C-FIND (and exam start) are now
confirmed working against the real Mindray unit — see "On-site validation"
below. "Save patient" is still **not** wired to this module; that remains a
separate, explicit decision per "Explicitly out of scope" below, unaffected
by this validation.

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

## Storage SCP added (2026-09-06)

`packages/dicom-bridge` now also implements a **Storage SCP** — a second,
separate service alongside the worklist one:

- `dicom_bridge.run_store`, AE title `DOCDOPPLER-STORE`, port `11113`
  (`BRIDGE_STORE_AE_TITLE` / `BRIDGE_STORE_PORT`). Separate from the
  worklist SCP's `DOCDOPPLER:11112` because the ME8 conformance statement
  (Table 5, Modality AE SOP Classes) lists Storage and Worklist as distinct
  SOP classes, which the Mindray configures as separate DICOM services.
- Accepts Comprehensive SR Storage (`1.2.840.10008.5.1.4.1.1.88.33`) and
  Verification. Reuses the existing `BRIDGE_ALLOWED_CALLING_AETS`,
  `BRIDGE_BIND_HOST` and `BRIDGE_REQUIRE_CALLED_AET` config — same peer,
  same policy — including the startup warning when the allowlist is unset.
- Writes each received instance verbatim to
  `data/received_sr/<StudyInstanceUID>/<SOPInstanceUID>.dcm` (`BRIDGE_STORE_DIR`,
  gitignored — received SRs contain patient data). Grouping by study keeps
  an exam's reports together; naming by SOP instance means a study with
  several SRs keeps all of them while a re-sent instance overwrites itself.
  UIDs are validated as digits-and-dots before being used as path components.

**It deliberately does not parse the SR.** Reading measurement values out of
a received report is a separate task, gated on having a real ME8 export to
validate against — until then there is nothing to check a parser's output
for. The first real export from the on-site test is that fixture.

**Logging (2026-09-11):** both SCPs were silent — no startup detail, no
association logging, nothing on receipt — so "the modality never connected",
"its association was rejected" and "it offered a SOP class we don't support"
all presented as an empty terminal. `dicom_bridge/logging_setup.py` now
configures logging for both and registers `EVT_CONN_OPEN` / `EVT_ACCEPTED` /
`EVT_REJECTED` handlers, and `handle_store` logs every stored instance and
every refusal. `BRIDGE_LOG_LEVEL=DEBUG` adds pynetdicom's full negotiation
trace. Troubleshooting table in `packages/dicom-bridge/README.md`.

**On-site 2026-09-11:** C-ECHO from the real ME8 to the storage SCP succeeds
(association from `192.168.1.196` as AE `mindray`). Triggering a send on an
exam initially produced no connection attempt at all. Root cause was
Mindray-side, not ours: the Stockage service entry's **"Option stockage SR"**
was set to `Pas stocker SR`, so no storage job was ever created. It must be
`Enr. seulement rapport structuré` — *not* `Joindre SR lors de l'enr. images`,
which would also push ultrasound images that `run_store.py` deliberately does
not accept. Details in `packages/dicom-bridge/README.md`.

Status: **validated against the real ME8 on 2026-09-11** — first real SR
received and stored (Comprehensive SR, DCMR TID 5100, *Vascular Ultrasound
Procedure Report*, 16 NUM measurements). The SR carries back the
`StudyInstanceUID` our own worklist response generated, plus `PatientID` and
`AccessionNumber`, so incoming SRs match a `patients` row exactly. What the
export actually contains — and why it does not map cleanly onto the `reports`
fields — is written up in `packages/dicom-bridge/README.md`; read it before
starting the parsing task.

Superseded status: loopback-tested only (`tests/test_store_scp.py` runs a real C-STORE
association over 127.0.0.1 with a synthetic TID 5100-shaped vascular
ultrasound SR). Nothing has been tried against the real ME8 — checklist in
`packages/dicom-bridge/README.md`. Like the worklist SCP, this is **not**
wired into the main app flow.

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

## Next on-site test

Step-by-step runbook (commands, order, what to configure on the Mindray):
`docs/dicom-bridge-onsite-test-plan-2026-08-26.md`.

## On-site validation (2026-09-01): C-ECHO, C-FIND, and exam start all confirmed

Full round trip succeeded against the real Mindray ME8: registered
`DOCDOPPLER` as a device (IP/port of the bridge machine), C-ECHO verified,
C-FIND (Patient → Worklist) returned a real test patient from SQLite, and
"Démarrer exam" (start exam) succeeded on that worklist item.

Two real issues were found and fixed this session:

1. **Local firewall silently rejected the Mindray's connection.** The bridge
   machine ran `firewalld` with `wlan0` in the `public` zone, which only
   allows `tcp/22` inbound by default. Symptom: Ping succeeded (ICMP), but
   both C-ECHO and a C-FIND attempt got `ICMP ... admin-prohibited` at the
   TCP layer — confirmed via `tcpdump`, not visible in `iptables -L INPUT`
   since `firewalld` manages its own `nftables` table. Not a bridge-code
   issue; see `packages/dicom-bridge/README.md` for the fix
   (`firewall-cmd --add-port`). This will need to be re-applied (or made
   `--permanent`) on whatever machine ends up hosting the bridge
   permanently.
2. **Mindray rejected "Démarrer exam" with "IDU d'instance d'étude
   incorrecte"** — it requires a `StudyInstanceUID` (0020,000D) in the
   worklist response, which `mapping.py` didn't generate. Fixed: see
   "Worklist query behavior" below.

Confirmed:
- Mindray's calling AE title for worklist queries is `mindray`, as assumed
- The Worklist service entry has its own "Titre AE" field expecting the
  bridge's AE title (`DOCDOPPLER`) — separate from the general device
  registration
- `BRIDGE_BIND_HOST` set to the bridge machine's real (DHCP) LAN IP works
  correctly

Still unconfirmed / open:
- Purpose of "Param. service DICOM" and "Déf stratégie DICOM" buttons
- The Worklist entry's "Défaut" (default) flag — could not be toggled
  on-site; turned out not to matter for either issue found, but its actual
  purpose is unknown
- Whether Mindray actually enforces the called AE title
  (`BRIDGE_REQUIRE_CALLED_AET` was left off/default and everything still
  worked) or just displays it
- Whether Mindray actually requires/checks `ScheduledStationAETitle` on
  returned worklist items — still unverified either way, though nothing in
  this session's testing contradicted the current default (`mindray`)

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
    (`patients.sex` is stored as `M`/`F`/`O`, already DICOM's own PatientSex codes,
    so it is forwarded verbatim)
  - AccessionNumber, RequestedProcedureID — from `accession_number`
  - StudyInstanceUID — generated via `pydicom.uid.generate_uid()`, keyed off
    `accession_number` as the entropy source so repeated C-FIND queries for
    the same exam return the same UID (this bridge is pull-based and caches
    nothing, so a purely random UID would differ on every query). Required
    by the Mindray to accept "Démarrer exam" — confirmed on-site 2026-09-01,
    it rejects exam start with "IDU d'instance d'étude incorrecte" without
    this tag.
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
