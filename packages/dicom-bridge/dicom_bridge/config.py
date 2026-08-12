import os

AE_TITLE = os.environ.get("BRIDGE_AE_TITLE", "DOCDOPPLER")
PORT = int(os.environ.get("BRIDGE_PORT", "11112"))
WORKLIST_ENDPOINT_URL = os.environ.get(
    "BRIDGE_WORKLIST_URL", "http://localhost:3000/worklist"
)

# Defaults to the wildcard address so the SCP is reachable without knowing
# the clinic machine's LAN interface IP in advance. Set BRIDGE_BIND_HOST to
# that machine's specific LAN IP once it's known, to avoid also listening on
# other interfaces (e.g. a laptop's Wi-Fi/VPN).
BIND_HOST = os.environ.get("BRIDGE_BIND_HOST", "0.0.0.0")

# Off by default: the correct AE titles are unconfirmed against the real
# Mindray unit (see docs/dicom-worklist-bridge.md). Once confirmed on-site,
# set these to reject associations from unexpected peers.
REQUIRE_CALLED_AET = os.environ.get("BRIDGE_REQUIRE_CALLED_AET", "") == "1"
ALLOWED_CALLING_AETS = [
    aet.strip()
    for aet in os.environ.get("BRIDGE_ALLOWED_CALLING_AETS", "").split(",")
    if aet.strip()
]
