from unittest.mock import patch

from pynetdicom import AE, evt
from pynetdicom.sop_class import Verification

from dicom_bridge.run import build_ae, security_warning
from dicom_bridge.scp import handle_echo


def test_build_ae_uses_configured_ae_title():
    ae = build_ae()
    assert ae.ae_title == "DOCDOPPLER"


def test_build_ae_leaves_default_config_permissive():
    ae = build_ae()
    assert ae.require_called_aet is False
    assert ae.require_calling_aet == []


def test_security_warning_present_when_fully_permissive():
    with (
        patch("dicom_bridge.run.config.REQUIRE_CALLED_AET", False),
        patch("dicom_bridge.run.config.ALLOWED_CALLING_AETS", []),
    ):
        assert security_warning() is not None


def test_security_warning_absent_when_calling_aets_allowlisted():
    with (
        patch("dicom_bridge.run.config.REQUIRE_CALLED_AET", False),
        patch("dicom_bridge.run.config.ALLOWED_CALLING_AETS", ["mindray"]),
    ):
        assert security_warning() is None


def test_security_warning_present_when_calling_aets_unrestricted_even_if_called_aet_required():
    with (
        patch("dicom_bridge.run.config.REQUIRE_CALLED_AET", True),
        patch("dicom_bridge.run.config.ALLOWED_CALLING_AETS", []),
    ):
        assert security_warning() is not None


def test_association_rejected_when_calling_aet_not_allowlisted():
    with patch("dicom_bridge.run.config.ALLOWED_CALLING_AETS", ["mindray"]):
        server_ae = build_ae()
    server = server_ae.start_server(
        ("127.0.0.1", 0),
        evt_handlers=[(evt.EVT_C_ECHO, handle_echo)],
        block=False,
    )
    port = server.server_address[1]
    try:
        client_ae = AE(ae_title="UNKNOWN")
        client_ae.add_requested_context(Verification)
        assoc = client_ae.associate("127.0.0.1", port, ae_title="DOCDOPPLER")
        assert not assoc.is_established
    finally:
        server.shutdown()


def test_association_accepted_when_calling_aet_allowlisted():
    with patch("dicom_bridge.run.config.ALLOWED_CALLING_AETS", ["mindray"]):
        server_ae = build_ae()
    server = server_ae.start_server(
        ("127.0.0.1", 0),
        evt_handlers=[(evt.EVT_C_ECHO, handle_echo)],
        block=False,
    )
    port = server.server_address[1]
    try:
        client_ae = AE(ae_title="mindray")
        client_ae.add_requested_context(Verification)
        assoc = client_ae.associate("127.0.0.1", port, ae_title="DOCDOPPLER")
        assert assoc.is_established
        assoc.release()
    finally:
        server.shutdown()
