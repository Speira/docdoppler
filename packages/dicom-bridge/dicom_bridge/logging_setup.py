"""Shared logging for both SCPs.

Neither SCP used to emit anything, which made three very different
situations indistinguishable from the terminal: the modality never reached
us, its association was rejected, or it associated fine but offered a SOP
class we don't support. All three looked like silence. These handlers make
each one say so.
"""

import logging
import os

logger = logging.getLogger("dicom_bridge")

LOG_FORMAT = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"


def configure_logging(level: str | None = None) -> None:
    """Send our own logs and pynetdicom's protocol logs to the terminal.

    At DEBUG, pynetdicom prints the full association negotiation — every
    presentation context the modality offered and whether we accepted it,
    which is what you want on-site when a transfer silently does nothing.
    """
    resolved = (level or os.environ.get("BRIDGE_LOG_LEVEL") or "INFO").upper()
    logging.basicConfig(level=resolved, format=LOG_FORMAT, force=True)
    logger.setLevel(resolved)
    logging.getLogger("pynetdicom").setLevel(resolved)


def log_connection_open(event) -> None:
    address, port = event.address[0], event.address[1]
    logger.info("TCP connection opened from %s:%s", address, port)


def log_association_accepted(event) -> None:
    requestor = event.assoc.requestor
    accepted = [str(cx.abstract_syntax) for cx in event.assoc.accepted_contexts]
    if accepted:
        logger.info(
            "Association accepted from AE %r at %s — negotiated: %s",
            requestor.ae_title,
            requestor.address,
            ", ".join(accepted),
        )
        return
    logger.warning(
        "Association accepted from AE %r at %s but no presentation contexts "
        "accepted — it offered %s, none of which this SCP supports. Nothing "
        "can be transferred over this association.",
        requestor.ae_title,
        requestor.address,
        ", ".join(
            str(cx.abstract_syntax) for cx in requestor.requested_contexts
        )
        or "nothing",
    )


def log_association_rejected(event) -> None:
    requestor = event.assoc.requestor
    logger.warning(
        "Association REJECTED from AE %r at %s — check "
        "BRIDGE_ALLOWED_CALLING_AETS (currently allows %s)",
        requestor.ae_title,
        requestor.address,
        os.environ.get("BRIDGE_ALLOWED_CALLING_AETS") or "any",
    )
