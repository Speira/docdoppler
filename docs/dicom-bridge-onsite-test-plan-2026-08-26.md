# DICOM Bridge — On-Site Test Plan (2026-08-26)

Real-world validation of `packages/dicom-bridge` against the clinic's actual
Mindray ME8. Nothing in this plan touches the main app's "save patient" flow
— it stays gated until every step below passes. See
`docs/dicom-worklist-bridge.md` and `packages/dicom-bridge/README.md` for
background; this doc is the step-by-step runbook to execute on-site, in
order. Do not skip ahead — each step assumes the previous one succeeded.

If any step fails: **stop, do not improvise a workaround, write down the
exact error/behavior, and move to the "If it fails" note under that step.**
Debug once you're back, with the real error in hand.

---

## 0. Before you leave — laptop pre-flight

Run these from the repo root, on the laptop you're bringing, *before* you
leave for the clinic. This confirms the bridge itself still works in
isolation, so if something breaks on-site you know it's Mindray-side, not a
regression you brought with you.

```bash
cd packages/dicom-bridge
.venv/bin/pytest -v
```

Expected: all tests pass. If not, fix it before leaving — don't debug the
bridge's own logic on-site, that wastes clinic time.

Also confirm the laptop has:
- [ ] Wi-Fi/Ethernet capable of joining the clinic LAN (check with clinic staff
      how you'll get an IP on their network — DHCP or static assignment)
- [ ] This repo checked out with the latest `main` (`git pull` before leaving)
- [ ] `packages/dicom-bridge/.venv` present and working (the pytest run above
      confirms this)

---

## 1. On-site: find your laptop's LAN IP

Once connected to the clinic LAN, find the IP address the clinic network
assigned your laptop. You'll need this for `BRIDGE_BIND_HOST` (step 3) and
for registering the laptop on the Mindray (step 4).

```bash
ip addr show | grep "inet "
```

Look for the interface connected to the clinic LAN (not `127.0.0.1`, not
`docker0`/`br-*` if any are present). Write this IP down — call it
`<LAPTOP_IP>` for the rest of this plan.

**If it fails:** no IP on the expected interface means the laptop didn't
successfully join the clinic network — sort that out with clinic staff
before continuing, nothing DICOM-related will work without it.

---

## 2. Start `api-gateway`

The bridge doesn't talk to SQLite directly — it calls `api-gateway` over
HTTP for patient data (`GET /worklist`). Start it first, in its own
terminal, and leave it running for the rest of the session.

```bash
cd packages/api-gateway
pnpm dev
```

Expected: it logs that it's listening on port 3000 (default). Leave this
terminal open — don't close it until you're done with every step below.

**If it fails:** don't proceed to the bridge — everything downstream depends
on this. Check `pnpm install` was run from repo root, and that nothing else
on the laptop is already using port 3000.

---

## 3. Start the DICOM bridge — with the allowlist ON

**Do not run this without `BRIDGE_ALLOWED_CALLING_AETS` set.** Without it,
the SCP accepts a C-ECHO/C-FIND association from *any* calling AE title —
fine for the loopback test we already did, not fine for a real network with
other devices potentially on it.

In a **second** terminal (keep `api-gateway`'s terminal running):

```bash
cd packages/dicom-bridge
BRIDGE_ALLOWED_CALLING_AETS=mindray BRIDGE_BIND_HOST=<LAPTOP_IP> \
  .venv/bin/python -m dicom_bridge.run
```

Replace `<LAPTOP_IP>` with the address from step 1 — do **not** leave this
at the default `0.0.0.0`, which would also listen on every other interface
the laptop has (e.g. a Wi-Fi hotspot).

Expected startup output:
- No "WARNING: BRIDGE_ALLOWED_CALLING_AETS is unset" line. If you see that
  warning, the env var didn't take — check for a typo, re-run.
- A line confirming it's listening (AE title `DOCDOPPLER`, port `11112` —
  both defaults, no need to override unless the Mindray requires otherwise,
  see step 4).

Leave this terminal open and watch it during steps 5–7 — every association
attempt from the Mindray will log here, which is your primary debugging
signal for the rest of this plan.

**If it fails to start:** check `api-gateway` (step 2) is actually reachable
at `http://localhost:3000` — the bridge doesn't hard-fail at startup if it
can't reach it, but C-FIND will fail later with a less obvious error. Verify
with `curl http://localhost:3000/worklist?date=20260826` in a third terminal.

---

## 4. Register the laptop on the Mindray

On the Mindray console (per `docs/dicom-worklist-bridge.md`, confirmed
2026-07-28):

1. Go to **Setup → DICOM/HL7 → Param. service DICOM**
2. Find the **"Paramètres du serveur"** section
3. Add a new device:
   - **Périph. (name):** something identifiable, e.g. `DOCDOPPLER` (matches
     `BRIDGE_AE_TITLE` default — keep them matching so it's obvious which
     entry is which if the list grows later)
   - **Adresse IP:** `<LAPTOP_IP>` from step 1
   - **Port:** `11112` (the bridge's default `BRIDGE_PORT` — only change this
     if you overrode it in step 3, which you shouldn't have)
4. Use the **"Ping"** button next to the entry to confirm the Mindray can
   reach the laptop over the network, *before* adding it permanently
5. Click **"Ajouter"**

While you're on this screen, note down (for the writeup in step 8):
- [ ] What the **"Param. service DICOM"** button does, if separate from this
- [ ] What the **"Déf stratégie DICOM"** button does
- [ ] Whether the Mindray asks you to assign a *service type* (Worklist vs
      Storage vs Print) to this new device entry, and if so, which one you
      picked

**If Ping fails:** don't add the device yet — this means the Mindray can't
reach `<LAPTOP_IP>:11112` over the network. Check the laptop's firewall
isn't blocking inbound connections on port 11112, and confirm the Mindray
and laptop are actually on the same subnet/VLAN (ask clinic IT/staff if
unsure — some clinic networks segment devices).

---

## 5. C-ECHO test from the Mindray

This is the first real signal from the actual unit — **stop and debug if
this fails**, don't move on to C-FIND.

On the Mindray console, use its DICOM verify/echo function against the
device entry you just added (exact menu path TBD — it may be on the same
DICOM/HL7 screen, or a "Verify"/"Test" button next to the device entry).

Watch the bridge's terminal (from step 3) while you do this.

Expected: Mindray reports success (something like "Vérification réussie" /
a green checkmark), and the bridge's terminal logs an incoming association
and a successful C-ECHO response.

**If it fails:**
- Note the *exact* error/message the Mindray shows.
- Check the bridge terminal — did an association attempt show up at all?
  - **No log line at all** → network/reachability problem (same class of
    issue as a failed Ping in step 4 — firewall, subnet, wrong IP/port).
  - **Association attempt logged but rejected** → likely an AE title
    mismatch. Note what calling AE title the bridge's log shows the Mindray
    used — compare it against `mindray` (what we set
    `BRIDGE_ALLOWED_CALLING_AETS` to). If it's different, that's the
    critical finding for this trip: write down the real calling AE title,
    stop testing, and fix `BRIDGE_ALLOWED_CALLING_AETS` to match before
    retrying C-ECHO.
- Do not proceed to step 6 until C-ECHO succeeds.

---

## 6. Create a test patient with today's exam date

The bridge's C-FIND filters `patients.exam_date` against exactly what the
Mindray requests (typically "today", no date-range support). The patient
must exist in the DB *before* you query, with `exam_date` set to **today,
2026-08-26**.

On the laptop, with `api-gateway` still running (step 2), start
`client-secretary` in a **third** terminal:

```bash
cd packages/client-secretary
pnpm dev
```

Open `http://localhost:3001/patients/add` in a browser, and create a real
test patient:
- First/last name: anything identifiable as a test record (e.g.
  `Test`/`Onsite20260826`) so it's obviously not a real patient later
- Date of birth: anything valid
- **Exam date: 2026-08-26** — this is the field that must match for C-FIND
  to return it
- Fill the rest of the required fields so the save succeeds

Save the patient. Confirm it appears in `/patients`.

**If it fails:** this is a normal app bug, not a DICOM issue — same
debugging as any other day (check `api-gateway` terminal for errors,
browser console, etc.). Don't let this block the rest of the DICOM testing
if you're short on clinic time — you can also insert a test row in a pinch
via `curl` against `api-gateway`'s patient endpoint if the UI is stuck, but
prefer fixing the UI path since that's what "real" patients will go through
later.

---

## 7. C-FIND test from the Mindray

On the Mindray console, go to **Patient → Worklist**, and query using
today's date (2026-08-26) — this should be the default date the Mindray
proposes.

Watch the bridge's terminal while you do this.

Expected: the test patient from step 6 (name, DOB, ID) appears in the
Mindray's worklist results. The bridge's terminal logs the incoming C-FIND
and a successful response.

**If it fails:**
- No results at all, but C-ECHO worked → check the bridge terminal for the
  actual date the Mindray queried with (log it — compare against
  `20260826`). If the Mindray sent a different date format or a date range,
  note the exact query — this confirms/refutes the "single exact-date only"
  assumption in `docs/dicom-worklist-bridge.md`.
- Association rejected → same AE-title debugging as step 5, but note that
  C-FIND could in principle use a different calling AE title than C-ECHO —
  don't assume they're the same without checking the log.
- Patient appears but with wrong/missing fields (e.g. name not shown, DOB
  garbled) → note exactly which field, and what it shows instead. This may
  point to the `SpecificCharacterSet`/accented-character handling
  (`docs/dicom-worklist-bridge.md`, "Worklist query behavior") if the test
  name has accents, or to `ScheduledStationAETitle` if the Mindray filters
  out results that don't match its expected station AE title.
- **Do not** wire this into the main app's save-patient flow regardless of
  outcome — that's a separate, later decision per
  `docs/dicom-worklist-bridge.md`, not something today's test unlocks by
  itself.

---

## 8. Export the Mindray's system log — regardless of outcome

Do this **even if everything above passed**, and especially if anything
failed — the log is the primary artifact for debugging back at your desk.

Exact export path is unconfirmed (log it for next time): check under
**Setup → System → Journal/Log** or similar, or ask clinic staff if they've
exported logs before for a service visit. Export covering the time window
of steps 4–7 today. Save it as a file you can bring back (USB, email to
yourself, whatever the Mindray supports) — do not just eyeball it on-screen
and move on.

---

## 9. Wrap-up (back at your desk, not on-site)

Bring back / write down:
- [ ] Result of each step above (pass/fail + exact error text where it failed)
- [ ] The exact calling AE title(s) the Mindray used for C-ECHO and C-FIND
      (from the bridge's terminal log — screenshot or copy the log lines)
- [ ] Purpose of "Param. service DICOM" vs "Déf stratégie DICOM" buttons
- [ ] Whatever the Mindray asked when registering the device (service type,
      if any)
- [ ] Exact date format/query the Mindray sent for C-FIND
- [ ] The exported system log file (step 8)

Once you're back, hand me the above (paste text, attach the log, whatever
you have) and I'll fold the results into
`packages/dicom-bridge/README.md`'s on-site checklist and
`docs/dicom-worklist-bridge.md`'s "Not yet confirmed" section — including
flipping `BRIDGE_ALLOWED_CALLING_AETS`/`BRIDGE_BIND_HOST` defaults or
`ScheduledStationAETitle` handling if today's results change what we know.
Whether "save patient" wiring becomes unblocked is a separate call to make
afterward, based on what actually passed.
