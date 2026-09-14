from pynetdicom import AE, evt
from pynetdicom.sop_class import ComprehensiveSRStorage, Verification

from . import config
from .logging_setup import (
    configure_logging,
    log_association_accepted,
    log_association_rejected,
    log_connection_open,
    logger,
)
from .scp import handle_echo
from .store_scp import handle_store


def store_handlers() -> list[tuple]:
    return [
        (evt.EVT_CONN_OPEN, log_connection_open),
        (evt.EVT_ACCEPTED, log_association_accepted),
        (evt.EVT_REJECTED, log_association_rejected),
        (evt.EVT_C_ECHO, handle_echo),
        (evt.EVT_C_STORE, handle_store),
    ]


def build_store_ae() -> AE:
    ae = AE(ae_title=config.STORE_AE_TITLE)
    ae.add_supported_context(Verification)
    ae.add_supported_context(ComprehensiveSRStorage)
    ae.require_called_aet = config.REQUIRE_CALLED_AET
    ae.require_calling_aet = config.ALLOWED_CALLING_AETS
    return ae


def security_warning() -> str | None:
    if not config.ALLOWED_CALLING_AETS:
        return (
            "WARNING: BRIDGE_ALLOWED_CALLING_AETS is unset — this SCP accepts "
            "associations from any calling AE title and will write whatever "
            "it is sent to disk. Set BRIDGE_ALLOWED_CALLING_AETS to the "
            "Mindray's calling AE title (see docs/dicom-worklist-bridge.md)."
        )
    return None


def main() -> None:
    configure_logging()
    ae = build_store_ae()

    logger.info(
        "DICOM Storage Bridge listening on %s:%s, AE title %s, "
        "storing to %s, accepting %s, "
        "require_called_aet=%s, allowed_calling_aets=%s",
        config.BIND_HOST,
        config.STORE_PORT,
        config.STORE_AE_TITLE,
        config.STORE_DIR,
        ", ".join(
            str(cx.abstract_syntax) for cx in ae.supported_contexts
        ),
        config.REQUIRE_CALLED_AET,
        config.ALLOWED_CALLING_AETS or "any",
    )
    warning = security_warning()
    if warning:
        logger.warning(warning)
    ae.start_server(
        (config.BIND_HOST, config.STORE_PORT),
        evt_handlers=store_handlers(),
        block=True,
    )


if __name__ == "__main__":
    main()
