from pynetdicom import AE, evt
from pynetdicom.sop_class import ModalityWorklistInformationFind, Verification

from . import config
from .logging_setup import (
    configure_logging,
    log_association_accepted,
    log_association_rejected,
    log_connection_open,
    logger,
)
from .scp import handle_echo, handle_find


def build_ae() -> AE:
    ae = AE(ae_title=config.AE_TITLE)
    ae.add_supported_context(Verification)
    ae.add_supported_context(ModalityWorklistInformationFind)
    ae.require_called_aet = config.REQUIRE_CALLED_AET
    ae.require_calling_aet = config.ALLOWED_CALLING_AETS
    return ae


def security_warning() -> str | None:
    if not config.ALLOWED_CALLING_AETS:
        return (
            "WARNING: BRIDGE_ALLOWED_CALLING_AETS is unset — this SCP accepts "
            "associations from any calling AE title and will hand out patient "
            "identity data to it. Set BRIDGE_ALLOWED_CALLING_AETS once the "
            "Mindray's calling AE title is confirmed on-site "
            "(see docs/dicom-worklist-bridge.md)."
        )
    return None


def main() -> None:
    configure_logging()
    ae = build_ae()

    handlers = [
        (evt.EVT_CONN_OPEN, log_connection_open),
        (evt.EVT_ACCEPTED, log_association_accepted),
        (evt.EVT_REJECTED, log_association_rejected),
        (evt.EVT_C_ECHO, handle_echo),
        (evt.EVT_C_FIND, handle_find),
    ]

    logger.info(
        "DICOM Worklist Bridge listening on %s:%s, AE title %s, "
        "require_called_aet=%s, allowed_calling_aets=%s",
        config.BIND_HOST,
        config.PORT,
        config.AE_TITLE,
        config.REQUIRE_CALLED_AET,
        config.ALLOWED_CALLING_AETS or "any",
    )
    warning = security_warning()
    if warning:
        logger.warning(warning)
    ae.start_server(
        (config.BIND_HOST, config.PORT), evt_handlers=handlers, block=True
    )


if __name__ == "__main__":
    main()
