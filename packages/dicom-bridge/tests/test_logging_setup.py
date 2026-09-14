"""Both SCPs must say what they are doing.

Without this, a Mindray that never connects, one whose association is
rejected, and one whose SOP class we don't support all look identical from
the terminal: nothing at all. These tests pin the log lines that tell those
three cases apart.
"""

import logging
import time

from pynetdicom import AE, evt
from pynetdicom.sop_class import (
    ComprehensiveSRStorage,
    UltrasoundImageStorage,
    Verification,
)

from dicom_bridge.logging_setup import (
    configure_logging,
    log_association_accepted,
    log_connection_open,
)

HANDLERS = [
    (evt.EVT_CONN_OPEN, log_connection_open),
    (evt.EVT_ACCEPTED, log_association_accepted),
]


def _await_log(caplog, needle: str, timeout: float = 2.0) -> bool:
    """Handlers run on the server thread, so give them a moment to log."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if needle in caplog.text:
            return True
        time.sleep(0.01)
    return False


def _associate(requested_context, calling_aet="mindray"):
    server_ae = AE(ae_title="DOCDOPPLER-STORE")
    server_ae.add_supported_context(Verification)
    server_ae.add_supported_context(ComprehensiveSRStorage)
    server = server_ae.start_server(
        ("127.0.0.1", 0), evt_handlers=HANDLERS, block=False
    )
    port = server.server_address[1]
    try:
        client_ae = AE(ae_title=calling_aet)
        client_ae.add_requested_context(requested_context)
        assoc = client_ae.associate(
            "127.0.0.1", port, ae_title="DOCDOPPLER-STORE"
        )
        if assoc.is_established:
            assoc.release()
    finally:
        server.shutdown()


def test_connection_open_is_logged_with_the_peer_address(caplog):
    caplog.set_level(logging.INFO)

    _associate(ComprehensiveSRStorage)

    assert _await_log(caplog, "127.0.0.1")
    assert _await_log(caplog, "connection")


def test_accepted_association_logs_the_calling_ae_title(caplog):
    caplog.set_level(logging.INFO)

    _associate(ComprehensiveSRStorage, calling_aet="mindray")

    assert _await_log(caplog, "mindray")


def test_accepted_association_logs_the_negotiated_sop_class(caplog):
    caplog.set_level(logging.INFO)

    _associate(ComprehensiveSRStorage)

    assert _await_log(caplog, str(ComprehensiveSRStorage))


def test_association_with_no_usable_sop_class_says_so(caplog):
    """The suspected real-world failure: the ME8 offers a SOP class we
    don't support, the association still succeeds, and nothing is stored."""
    caplog.set_level(logging.INFO)

    _associate(UltrasoundImageStorage)

    assert _await_log(caplog, "no presentation contexts accepted")


def test_configure_logging_lets_pynetdicom_protocol_logs_through(caplog):
    pynetdicom_logger = logging.getLogger("pynetdicom")
    original_level = pynetdicom_logger.level
    try:
        configure_logging("DEBUG")

        assert pynetdicom_logger.getEffectiveLevel() == logging.DEBUG
    finally:
        pynetdicom_logger.setLevel(original_level)


def test_configure_logging_defaults_to_info(caplog):
    pynetdicom_logger = logging.getLogger("pynetdicom")
    original_level = pynetdicom_logger.level
    try:
        configure_logging()

        assert pynetdicom_logger.getEffectiveLevel() == logging.INFO
    finally:
        pynetdicom_logger.setLevel(original_level)
