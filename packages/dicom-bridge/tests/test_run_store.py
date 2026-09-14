from unittest.mock import patch

from pynetdicom import AE, evt
from pynetdicom.sop_class import ComprehensiveSRStorage, Verification

from dicom_bridge.run_store import build_store_ae, security_warning
from dicom_bridge.scp import handle_echo


def _supported_uids(ae: AE) -> set[str]:
    return {str(context.abstract_syntax) for context in ae.supported_contexts}


def test_build_store_ae_uses_the_storage_ae_title():
    ae = build_store_ae()

    assert ae.ae_title == "DOCDOPPLER-STORE"


def test_build_store_ae_supports_comprehensive_sr_storage():
    ae = build_store_ae()

    assert str(ComprehensiveSRStorage) in _supported_uids(ae)


def test_build_store_ae_supports_verification_for_connectivity_checks():
    ae = build_store_ae()

    assert str(Verification) in _supported_uids(ae)


def test_build_store_ae_reuses_the_shared_calling_aet_allowlist():
    with patch("dicom_bridge.run_store.config.ALLOWED_CALLING_AETS", ["mindray"]):
        ae = build_store_ae()

    assert ae.require_calling_aet == ["mindray"]


def test_build_store_ae_leaves_default_config_permissive():
    ae = build_store_ae()

    assert ae.require_called_aet is False
    assert ae.require_calling_aet == []


def test_security_warning_present_when_calling_aets_unrestricted():
    with patch("dicom_bridge.run_store.config.ALLOWED_CALLING_AETS", []):
        assert security_warning() is not None


def test_security_warning_absent_when_calling_aets_allowlisted():
    with patch("dicom_bridge.run_store.config.ALLOWED_CALLING_AETS", ["mindray"]):
        assert security_warning() is None


def test_storage_association_rejected_when_calling_aet_not_allowlisted():
    with patch("dicom_bridge.run_store.config.ALLOWED_CALLING_AETS", ["mindray"]):
        server_ae = build_store_ae()
    server = server_ae.start_server(
        ("127.0.0.1", 0),
        evt_handlers=[(evt.EVT_C_ECHO, handle_echo)],
        block=False,
    )
    port = server.server_address[1]
    try:
        client_ae = AE(ae_title="UNKNOWN")
        client_ae.add_requested_context(Verification)
        assoc = client_ae.associate(
            "127.0.0.1", port, ae_title="DOCDOPPLER-STORE"
        )
        assert not assoc.is_established
    finally:
        server.shutdown()


def test_store_handlers_cover_transfer_and_diagnostics():
    from pynetdicom import evt as events

    from dicom_bridge.logging_setup import (
        log_association_accepted,
        log_association_rejected,
        log_connection_open,
    )
    from dicom_bridge.run_store import store_handlers
    from dicom_bridge.store_scp import handle_store

    registered = dict(store_handlers())

    assert registered[events.EVT_C_STORE] is handle_store
    # Without these three, a Mindray that never connects, one that is
    # rejected, and one offering an unsupported SOP class are all silent.
    assert registered[events.EVT_CONN_OPEN] is log_connection_open
    assert registered[events.EVT_ACCEPTED] is log_association_accepted
    assert registered[events.EVT_REJECTED] is log_association_rejected
