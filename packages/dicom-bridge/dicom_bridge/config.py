import os

AE_TITLE = os.environ.get("BRIDGE_AE_TITLE", "DOCDOPPLER")
PORT = int(os.environ.get("BRIDGE_PORT", "11112"))
WORKLIST_ENDPOINT_URL = os.environ.get(
    "BRIDGE_WORKLIST_URL", "http://localhost:3000/worklist"
)
