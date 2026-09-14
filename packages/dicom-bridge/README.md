# DICOM Bridge

Two standalone SCPs for the clinic's Mindray ME8: a Modality Worklist SCP
(C-ECHO + C-FIND, `dicom_bridge.run`) and a Storage SCP (C-ECHO + C-STORE,
`dicom_bridge.run_store`) that receives exported Structured Reports.
The worklist SCP reads patient data from the `packages/api-gateway` Express API over
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

## Running the worklist SCP manually

Requires `packages/api-gateway` running (`pnpm dev`, default `http://localhost:3000`).

```bash
BRIDGE_AE_TITLE=DOCDOPPLER BRIDGE_PORT=11112 .venv/bin/python -m dicom_bridge.run
```

## Running the storage SCP manually

Separate process, separate AE title and port — the ME8 conformance statement
(Table 5, Modality AE SOP Classes) lists Storage and Worklist as distinct SOP
classes, configured as separate DICOM services on the Mindray side. No
`api-gateway` needed: this one only writes files.

```bash
BRIDGE_ALLOWED_CALLING_AETS=mindray .venv/bin/python -m dicom_bridge.run_store
```

It accepts **Comprehensive SR Storage** (`1.2.840.10008.5.1.4.1.1.88.33`) plus
Verification, and writes each received instance to
`data/received_sr/<StudyInstanceUID>/<SOPInstanceUID>.dcm` — grouped by exam,
so a study with several SRs keeps all of them while a re-sent instance
overwrites itself. `data/` is gitignored: received SRs contain patient data.

**It does not parse the SR.** Reading measurement values out of a received
report is a separate, later task, gated on having a real ME8 export to
validate against — this service accepts and persists the raw file, nothing
more.

Statuses returned to the modality: `0x0000` on success, `0xC000` ("cannot
understand") if the dataset has no well-formed `StudyInstanceUID` /
`SOPInstanceUID` to file it under, `0xA700` ("out of resources") if the write
itself fails. The UIDs are validated as digits-and-dots before being used as
path components, so a malformed one can't escape `BRIDGE_STORE_DIR`.

Environment variables (all optional, shown with their defaults set in ./dicom_bridge/config.py):

- `BRIDGE_AE_TITLE` — AE title this SCP presents to callers (default `DOCDOPPLER`)
- `BRIDGE_PORT` — port to listen on (default `11112`)
- `BRIDGE_WORKLIST_URL` — the api-gateway worklist endpoint (default `http://localhost:3000/worklist`)
- `BRIDGE_BIND_HOST` — interface to listen on (default `0.0.0.0`, i.e. all interfaces). Set this to the clinic machine's specific LAN IP once known, so the SCP isn't also reachable over other interfaces (e.g. a laptop's Wi-Fi or VPN).
- `BRIDGE_REQUIRE_CALLED_AET` — set to `1` to reject associations that don't address this SCP by `BRIDGE_AE_TITLE`. Default off (any called AE title accepted).
- `BRIDGE_ALLOWED_CALLING_AETS` — comma-separated allowlist of AE titles permitted to associate (e.g. `mindray`). Default empty (any calling AE title accepted).
- `BRIDGE_STATION_AET` — value returned as `ScheduledStationAETitle` in worklist items, so the Mindray recognizes steps scheduled for it. Defaults to `mindray` (confirmed on-site AE title, see `docs/dicom-worklist-bridge.md`).
- `BRIDGE_STORE_AE_TITLE` — AE title of the **storage** SCP (default `DOCDOPPLER-STORE`)
- `BRIDGE_STORE_PORT` — port the storage SCP listens on (default `11113`)
- `BRIDGE_STORE_DIR` — where received SRs are written (default `packages/dicom-bridge/data/received_sr`, resolved from the package directory rather than the process's cwd)
- `BRIDGE_LOG_LEVEL` — log verbosity for both SCPs (default `INFO`). Set `DEBUG` to get pynetdicom's full association negotiation — every presentation context the modality offered and whether it was accepted. That is the setting to use on-site when a transfer appears to do nothing.

`BRIDGE_BIND_HOST`, `BRIDGE_REQUIRE_CALLED_AET` and
`BRIDGE_ALLOWED_CALLING_AETS` are shared by both SCPs — same peer, same
policy — and both SCPs print the same startup warning while the allowlist is
unset.

`BRIDGE_BIND_HOST` and `BRIDGE_ALLOWED_CALLING_AETS` default to permissive,
which matters for both services: the worklist SCP hands out patient identity
data (name, DOB, sex) over C-FIND, and the storage SCP writes whatever it is
sent to disk. Set both explicitly before any real use (`BRIDGE_ALLOWED_CALLING_AETS=mindray`,
`BRIDGE_BIND_HOST=<bridge machine's LAN IP>`, both confirmed on-site, see
below). While `BRIDGE_ALLOWED_CALLING_AETS` is unset, `main()` prints a
startup warning to make this state visible rather than silently discoverable
only by reading code.

**Local firewall:** if the bridge machine runs `firewalld` (or another
default-deny firewall), inbound TCP on `BRIDGE_PORT` (default `11112`) and
`BRIDGE_STORE_PORT` (default `11113`) must be explicitly allowed or the Mindray's association attempts get silently
rejected (`ICMP ... admin-prohibited`) even though the bridge itself is
listening and reachable via ping. Confirmed on-site 2026-09-01: `firewalld`
was active with `wlan0` in the `public` zone, which only allowed `tcp/22` by
default. Fix (runtime-only, re-apply after reboot or make `--permanent` once
this is a settled deployment):
```bash
sudo firewall-cmd --zone=public --add-port=11112/tcp
sudo firewall-cmd --zone=public --add-port=11113/tcp   # storage SCP
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

## Troubleshooting: "I sent an exam and nothing happened"

Both SCPs log to the terminal (added 2026-09-11 — before that they were
silent, which made every failure look identical). Restart the SCP and read
what it prints; the four cases are distinguishable:

| What you see | What it means |
|---|---|
| *Nothing at all after the `listening on …` line* | The modality never reached this machine. Check the IP/port registered on the Mindray, that `BRIDGE_BIND_HOST` is the LAN IP (not `127.0.0.1`), and the firewall (`firewall-cmd --zone=public --list-ports` must include `11113/tcp`). |
| `TCP connection opened from …` then `Association REJECTED` | The peer's calling AE title isn't in `BRIDGE_ALLOWED_CALLING_AETS`. The log line names the AE title it presented — add it. |
| `… no presentation contexts accepted — it offered <uid>` | The association succeeded but the modality is sending a SOP class this SCP doesn't support. `1.2.840.10008.5.1.4.1.1.6.1` is Ultrasound Image Storage, i.e. it is pushing **images, not a Structured Report** — either export the SR specifically on the console, or widen the supported contexts in `run_store.py`. |
| `Stored SOP instance … to …` | It worked; the path in the line is the file. |

Restarting matters: a bridge process started before a code or config change
keeps running the old code, including the old AE title.

## Storage SCP on-site validation (in progress 2026-09-11)

- [x] Register `DOCDOPPLER-STORE` as a Storage service on the Mindray (Setup → DICOM/HL7 → Param. service DICOM), port `11113`
- [x] C-ECHO from the Mindray to the storage SCP succeeds — confirmed 2026-09-11: association from `192.168.1.196` as AE `mindray`, three Verification contexts accepted, released cleanly
- [x] Confirm the Mindray's calling AE title for **storage** is also `mindray` — yes, same as worklist, `BRIDGE_ALLOWED_CALLING_AETS=mindray` works
- [x] Diagnosed why "send exam" produced *no TCP connection at all*: the Stockage entry's **"Option stockage SR"** was set to `Pas stocker SR`, so no storage job was ever created. Set it to `Enr. seulement rapport structuré`. See below.
- [x] Confirm an SR actually arrives once that setting is changed and an exam is ended — **first real SR received 2026-09-11 22:34**, see below
- [x] Confirm the ME8 actually sends Comprehensive SR (`…88.33`) — yes, exactly that SOP class, negotiated on three presentation contexts
- [x] Keep the first real export: it is the fixture the (separate) parsing task needs — kept under `data/received_sr/` (gitignored, real patient data: do not commit it)

### What the ME8 actually sends (first real SR, 2026-09-11)

Comprehensive SR Storage, Implicit VR Little Endian, `Manufacturer MINDRAY /
ME8`, `ContentTemplateSequence` = **DCMR TID 5100**, root concept *Vascular
Ultrasound Procedure Report*. 45 content items: 3 CONTAINER, 16 NUM, 24 CODE,
1 PNAME, 1 DATE.

**It links back to our worklist entry.** The `StudyInstanceUID` carries
pydicom's UID root (`1.2.826.0.1.3680043.8.498.…`) — i.e. it is the UID
`mapping.py` generated and handed to the Mindray in the worklist response,
which the ME8 carried through into the SR. `PatientID` (`5`) and
`AccessionNumber` (`20260911-001`) likewise come straight back from the
worklist. So an incoming SR can be matched to its `patients` row by any of
those three, with no fuzzy name matching.

Shape of the content tree:

```
Subject Age
[Patient Characteristics] → Subject Age
[Findings]
  [Carotid Stenosis 1]
    Vessel lumen diameter, Residual Diameter,
    Vessel lumen cross-sectional area, Residual Area,
    Lumen Diameter Stenosis (%), Lumen Area Stenosis (%),
    Anterior-Posterior diameter, Trans diameter
```

Two things a parser will have to handle:

1. **Measurements appear twice** — once bare, once repeated with
   `Derivation = Mean` / `Selection Status = Mean value chosen` (or
   `Derivation = Calculated` / `User chosen value` for the % stenosis
   values). De-duplicate by concept, preferring the item that carries a
   Selection Status, or you will double-count every measurement.
2. **These are not the fields our report module uses.** The ME8 exports
   stenosis geometry (lumen/residual diameter and area, % stenosis, AP/trans
   diameter); `reports` stores IMT, ACI/ACC ratio, systolic pressures + IPS,
   and per-artery Spectre/VSM. Almost nothing lines up directly. Before
   building a parser, capture a **complete** real exam and check what it
   contains — this first sample was `CompletionFlag PARTIAL` from a test
   exam, so it is not proof of what a finished vascular study exports.

### Root cause found (2026-09-11): "Option stockage SR" was "Pas stocker SR"

The Mindray's **Stockage** service entry has an **"Option stockage SR"**
setting with three values:

- `Pas stocker SR` — never send the SR. **This was the configured value**, and
  it is why triggering a send produced no TCP connection at all: no storage
  job was ever created, so nothing reached the network. C-ECHO kept working
  throughout because it is unaffected by this setting.
- `Joindre SR lors de l'enr. images` — send the SR *alongside* ultrasound
  images. Avoid: `run_store.py` accepts only Comprehensive SR Storage
  (`…88.33`), so the image transfers (`…1.1.6.1`) would be refused for want
  of a presentation context, and the console would likely mark the job
  failed. There is no PACS here, so nothing needs the images.
- `Enr. seulement rapport structuré` — send only the SR. **Use this one.**

Other settings on that entry, confirmed fine as-is: `Encapsulé PDF` and `KOS`
unchecked (we want the real SR, not a PDF wrapper or key-object selection),
`Nom stratégie` empty, `Autoriser clips` checked, TLS unchecked.

The exam must be **ended** before a send fires; an in-progress exam exports
nothing.

### Symptom history: sending an exam did nothing (resolved by the above)

C-ECHO from the Mindray reaches the storage SCP, but triggering a send on a
finished exam produces no connection attempt whatsoever — nothing in the SCP
log, nothing in `tcpdump`. Since C-ECHO from the same service entry arrives,
the destination itself is configured correctly; the ME8 simply isn't
dispatching the job. Candidates to check on the console, none yet confirmed:

- The DICOM task/queue manager ("gestion des tâches") — does the send even
  get queued, does it show as pending/failed, and what destination does it
  name? A job failing in the queue never touches the network.
- The service entry's **"Défaut"** flag — long-standing unknown (it could not
  be toggled during the 2026-09-01 visit). A send may only use the
  default-flagged storage destination, regardless of which entry was
  echo-tested.
- Whether the exam must be formally *ended* before it can be sent, and
  whether an SR export exists as a distinct action from sending images.
- Whether the send targets a different port/host entirely: capture with
  `sudo tcpdump -n -i wlan0 host <mindray IP> and tcp` (no port filter) to
  catch an attempt on e.g. the DICOM default port 104.

## Worklist SCP on-site validation (done 2026-09-01)

- [x] C-ECHO from the Mindray console succeeds against this SCP
- [x] C-FIND (Patient → Worklist) from the Mindray console returns a test patient
- [x] "Démarrer exam" (start exam) succeeds on a worklist item pulled from this SCP — required adding `StudyInstanceUID` to the returned dataset (see "Worklist query behavior" in `docs/dicom-worklist-bridge.md`); Mindray rejected the exam start with "IDU d'instance d'étude incorrecte" until this was added
- [x] Confirm whether Mindray requires a specific AE title from this SCP: yes — the Worklist service entry has its own "Titre AE" field (set to `DOCDOPPLER`, matching `BRIDGE_AE_TITLE`); `BRIDGE_REQUIRE_CALLED_AET` was left off (default) and this still worked, so it's unconfirmed whether the Mindray actually enforces this or just presents it
- [x] Confirm the Mindray's calling AE title for worklist queries: `mindray`, matches the assumption — `BRIDGE_ALLOWED_CALLING_AETS=mindray` works as configured
- [x] Set `BRIDGE_BIND_HOST` to the bridge machine's actual LAN IP — confirmed working with a real (DHCP-assigned) address, not just loopback
- [ ] Purpose of "Param. service DICOM" / "Déf stratégie DICOM" buttons — still unconfirmed, not blocking
- [ ] The Worklist entry's "Défaut" (default) flag could not be toggled during this session (grayed out/unclear why) — turned out to be irrelevant to the actual failures (both were the firewall, then the missing StudyInstanceUID), but the flag's real purpose is still unknown
- [ ] Mindray system log export — attempted 2026-09-01, not found under Setup → DICOM/HL7 or the obvious System menus during this visit; may require a service/engineer-level login rather than the standard clinical user account. Not captured this session, not a blocker.
