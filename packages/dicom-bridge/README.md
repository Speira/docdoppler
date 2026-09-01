# DICOM Worklist Bridge

Standalone Modality Worklist SCP (C-ECHO + C-FIND) for the clinic's Mindray
ME8. Reads patient data from the `packages/api-gateway` Express API over
HTTP — it does not touch SQLite directly, and nothing in the main app calls
into this module. See
`docs/superpowers/specs/2026-08-12-dicom-worklist-bridge-design.md` for the
full design and `docs/dicom-worklist-bridge.md` for the Mindray-side
configuration notes.

**This module is not wired into the "save patient" flow.** That wiring is
explicitly deferred until an on-site C-ECHO and C-FIND test against the real
Mindray unit succeeds.

## Setup

```bash
cd packages/dicom-bridge
python3 -m venv .venv
.venv/bin/python -m ensurepip --upgrade
.venv/bin/pip install -e ".[dev]"
```

## Running tests

```bash
.venv/bin/pytest -v
```

## Running the bridge manually

Requires `packages/api-gateway` running (`pnpm dev`, default `http://localhost:3000`).

```bash
BRIDGE_AE_TITLE=DOCDOPPLER BRIDGE_PORT=11112 .venv/bin/python -m dicom_bridge.run
```

Environment variables (all optional, shown with their defaults set in ./dicom_bridge/config.py):

- `BRIDGE_AE_TITLE` — AE title this SCP presents to callers (default `DOCDOPPLER`)
- `BRIDGE_PORT` — port to listen on (default `11112`)
- `BRIDGE_WORKLIST_URL` — the api-gateway worklist endpoint (default `http://localhost:3000/worklist`)
- `BRIDGE_BIND_HOST` — interface to listen on (default `0.0.0.0`, i.e. all interfaces). Set this to the clinic machine's specific LAN IP once known, so the SCP isn't also reachable over other interfaces (e.g. a laptop's Wi-Fi or VPN).
- `BRIDGE_REQUIRE_CALLED_AET` — set to `1` to reject associations that don't address this SCP by `BRIDGE_AE_TITLE`. Default off (any called AE title accepted).
- `BRIDGE_ALLOWED_CALLING_AETS` — comma-separated allowlist of AE titles permitted to associate (e.g. `mindray`). Default empty (any calling AE title accepted).
- `BRIDGE_STATION_AET` — value returned as `ScheduledStationAETitle` in worklist items, so the Mindray recognizes steps scheduled for it. Defaults to `mindray` (confirmed on-site AE title, see `docs/dicom-worklist-bridge.md`).

`BRIDGE_BIND_HOST` and `BRIDGE_ALLOWED_CALLING_AETS` default to permissive
so this SCP serves patient identity data (name, DOB, sex) over C-FIND — set
both explicitly before any real use (`BRIDGE_ALLOWED_CALLING_AETS=mindray`,
`BRIDGE_BIND_HOST=<bridge machine's LAN IP>`, both confirmed on-site, see
below). While `BRIDGE_ALLOWED_CALLING_AETS` is unset, `main()` prints a
startup warning to make this state visible rather than silently discoverable
only by reading code.

**Local firewall:** if the bridge machine runs `firewalld` (or another
default-deny firewall), inbound TCP on `BRIDGE_PORT` (default `11112`) must
be explicitly allowed or the Mindray's association attempts get silently
rejected (`ICMP ... admin-prohibited`) even though the bridge itself is
listening and reachable via ping. Confirmed on-site 2026-09-01: `firewalld`
was active with `wlan0` in the `public` zone, which only allowed `tcp/22` by
default. Fix (runtime-only, re-apply after reboot or make `--permanent` once
this is a settled deployment):
```bash
sudo firewall-cmd --zone=public --add-port=11112/tcp
```

## Local loopback smoke test (done 2026-08-26)

Confirmed the SCP itself works end-to-end against the real `patients` table,
without the Mindray unit — using this project's own `.venv` (which has
`pynetdicom`/`pydicom` installed, including their bundled `echoscu`/`findscu`
CLI tools, so no dcmtk install is needed for this kind of test):

```bash
# with api-gateway running (pnpm dev, localhost:3000) and 2 real patients
# in the DB (exam_date 2026-08-21 and 2026-08-25)
BRIDGE_ALLOWED_CALLING_AETS=mindray BRIDGE_BIND_HOST=127.0.0.1 \
  .venv/bin/python -m dicom_bridge.run &

.venv/bin/echoscu -aet mindray -aec DOCDOPPLER -v 127.0.0.1 11112
# I: Received Echo Response (Status: 0x0000 - Success)

.venv/bin/findscu -W -aet mindray -aec DOCDOPPLER -v \
  -k "ScheduledProcedureStepSequence[0].ScheduledProcedureStepStartDate=20260821" \
  127.0.0.1 11112
# returns Dupont^Jean (PatientID 1, DOB 19580312) — real DB row, Find SCP Result 0x0000
```

Also confirmed `BRIDGE_ALLOWED_CALLING_AETS` actually enforces: a C-ECHO
with `-aet SOME_RANDOM_AE` was rejected ("Calling AE title not recognised").
This validates the SCP's own logic (C-ECHO handler, C-FIND → `GET /worklist`
→ real SQLite row → DICOM dataset mapping, and the AE-title allowlist) but
**not** anything Mindray-specific — the checklist below, which needs the
real console, is still open.

## On-site validation (done 2026-09-01)

- [x] C-ECHO from the Mindray console succeeds against this SCP
- [x] C-FIND (Patient → Worklist) from the Mindray console returns a test patient
- [x] "Démarrer exam" (start exam) succeeds on a worklist item pulled from this SCP — required adding `StudyInstanceUID` to the returned dataset (see "Worklist query behavior" in `docs/dicom-worklist-bridge.md`); Mindray rejected the exam start with "IDU d'instance d'étude incorrecte" until this was added
- [x] Confirm whether Mindray requires a specific AE title from this SCP: yes — the Worklist service entry has its own "Titre AE" field (set to `DOCDOPPLER`, matching `BRIDGE_AE_TITLE`); `BRIDGE_REQUIRE_CALLED_AET` was left off (default) and this still worked, so it's unconfirmed whether the Mindray actually enforces this or just presents it
- [x] Confirm the Mindray's calling AE title for worklist queries: `mindray`, matches the assumption — `BRIDGE_ALLOWED_CALLING_AETS=mindray` works as configured
- [x] Set `BRIDGE_BIND_HOST` to the bridge machine's actual LAN IP — confirmed working with a real (DHCP-assigned) address, not just loopback
- [ ] Purpose of "Param. service DICOM" / "Déf stratégie DICOM" buttons — still unconfirmed, not blocking
- [ ] The Worklist entry's "Défaut" (default) flag could not be toggled during this session (grayed out/unclear why) — turned out to be irrelevant to the actual failures (both were the firewall, then the missing StudyInstanceUID), but the flag's real purpose is still unknown
- [ ] Mindray system log export — attempted 2026-09-01, not found under Setup → DICOM/HL7 or the obvious System menus during this visit; may require a service/engineer-level login rather than the standard clinical user account. Not captured this session, not a blocker.
