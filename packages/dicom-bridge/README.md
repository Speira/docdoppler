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

## On-site validation checklist (not yet done)

- [ ] C-ECHO from the Mindray console succeeds against this SCP
- [ ] C-FIND (Patient → Worklist) from the Mindray console returns a test patient
- [ ] Confirm whether Mindray requires a specific AE title from this SCP, or accepts any registered device
- [ ] Confirm purpose of "Param. service DICOM" / "Déf stratégie DICOM" buttons
