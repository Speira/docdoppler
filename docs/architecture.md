# DICOM Worklist Bridge — Confirmed Configuration

Last verified: 2026-07-28, on-site at clinic

## License status

- DICOM std.: Installé
- DICOM Liste de travail (Worklist/MWL): Installé
- No Mindray purchase/license needed — worklist is already active.

## Mindray ME8 DICOM identity (Setup → DICOM/HL7 → Param. service DICOM)

- AE Title: mindray
- Port: 2345
- TLS Port: 2346
- PDU: 32768

## Remote device registration

- Located under "Paramètres du serveur" on same screen
- Add remote DICOM nodes (e.g. worklist server) via: Périph. (name) + Adresse IP + "Ajouter"
- "Ping" button available to test reachability before adding
- "Param. service DICOM" and "Déf stratégie DICOM" buttons — purpose not yet confirmed,
  likely per-device service type config (Worklist vs Storage vs Print) — TO VERIFY NEXT VISIT

## Open questions / next steps

- Confirm how to designate a registered device specifically as the Worklist SCP
  (vs. just a generic DICOM peer)
- Test Verify/Echo (C-ECHO) once laptop is registered
- Test actual worklist query (Patient → Worklist) with hardcoded test patient
- Determine whether pynetdicom SCP needs to bind AE Title "mindray" as an accepted caller,
  or the Mindray needs a specific AE Title configured on its side for our SCP — TBD
