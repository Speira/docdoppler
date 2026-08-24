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

Environment variables (all optional, shown with their defaults):

- `BRIDGE_AE_TITLE` — AE title this SCP presents to callers (default `DOCDOPPLER`)
- `BRIDGE_PORT` — port to listen on (default `11112`)
- `BRIDGE_WORKLIST_URL` — the api-gateway worklist endpoint (default `http://localhost:3000/worklist`)
- `BRIDGE_BIND_HOST` — interface to listen on (default `0.0.0.0`, i.e. all interfaces). Set this to the clinic machine's specific LAN IP once known, so the SCP isn't also reachable over other interfaces (e.g. a laptop's Wi-Fi or VPN).
- `BRIDGE_REQUIRE_CALLED_AET` — set to `1` to reject associations that don't address this SCP by `BRIDGE_AE_TITLE`. Default off (any called AE title accepted).
- `BRIDGE_ALLOWED_CALLING_AETS` — comma-separated allowlist of AE titles permitted to associate (e.g. `mindray`). Default empty (any calling AE title accepted).
- `BRIDGE_STATION_AET` — value returned as `ScheduledStationAETitle` in worklist items, so the Mindray recognizes steps scheduled for it. Defaults to `mindray` (confirmed on-site AE title, see `docs/dicom-worklist-bridge.md`).

`BRIDGE_BIND_HOST` and `BRIDGE_ALLOWED_CALLING_AETS` default to permissive
because the correct values are unconfirmed against the real Mindray unit
(see the checklist below) — this SCP serves patient identity data (name,
DOB, sex) over C-FIND, so once the Mindray's actual calling AE title and
network position are confirmed on-site, set both to lock it down before any
real use. While `BRIDGE_ALLOWED_CALLING_AETS` is unset, `main()` prints a
startup warning to make this state visible rather than silently discoverable
only by reading code.

## On-site validation checklist (not yet done)

- [ ] C-ECHO from the Mindray console succeeds against this SCP
- [ ] C-FIND (Patient → Worklist) from the Mindray console returns a test patient
- [ ] Confirm whether Mindray requires a specific AE title from this SCP, or accepts any registered device
- [ ] Confirm purpose of "Param. service DICOM" / "Déf stratégie DICOM" buttons
- [ ] Confirm the Mindray's calling AE title for worklist queries (docs say `mindray` for its own DICOM identity — verify this is what it presents as calling AE title on a C-FIND), then set `BRIDGE_ALLOWED_CALLING_AETS`
- [ ] Set `BRIDGE_BIND_HOST` to the bridge machine's actual LAN IP
