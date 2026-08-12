from pynetdicom import AE, evt
from pynetdicom.sop_class import Verification

from dicom_bridge.scp import handle_echo


def test_echo_returns_success_status():
    server_ae = AE(ae_title="DOCDOPPLER")
    server_ae.add_supported_context(Verification)
    server = server_ae.start_server(
        ("127.0.0.1", 0),
        evt_handlers=[(evt.EVT_C_ECHO, handle_echo)],
        block=False,
    )
    port = server.server_address[1]
    try:
        client_ae = AE(ae_title="TESTCLIENT")
        client_ae.add_requested_context(Verification)
        assoc = client_ae.associate("127.0.0.1", port, ae_title="DOCDOPPLER")
        assert assoc.is_established

        status = assoc.send_c_echo()

        assert status.Status == 0x0000
        assoc.release()
    finally:
        server.shutdown()
