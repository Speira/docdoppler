import datetime
from unittest.mock import patch

from pydicom.dataset import Dataset
from pynetdicom import AE, evt
from pynetdicom.sop_class import ModalityWorklistInformationFind

from dicom_bridge.scp import _extract_requested_date, handle_find
from dicom_bridge.worklist_client import WorklistClientError


def test_extract_requested_date_from_identifier():
    identifier = Dataset()
    step = Dataset()
    step.ScheduledProcedureStepStartDate = "20260812"
    identifier.ScheduledProcedureStepSequence = [step]

    assert _extract_requested_date(identifier) == "2026-08-12"


def test_extract_requested_date_defaults_to_today_when_absent():
    identifier = Dataset()

    assert _extract_requested_date(identifier) == datetime.date.today().isoformat()


def test_extract_requested_date_defaults_to_today_when_malformed():
    identifier = Dataset()
    step = Dataset()
    step.ScheduledProcedureStepStartDate = "not-a-date"
    identifier.ScheduledProcedureStepSequence = [step]

    assert _extract_requested_date(identifier) == datetime.date.today().isoformat()


def test_find_returns_matching_patients():
    fixture_patients = [
        {
            "id": 1,
            "first_name": "Jean",
            "last_name": "Dupont",
            "dob": "1958-03-12",
            "sex": "M",
            "exam_date": "2026-08-12",
            "accession_number": "20260812-001",
        }
    ]

    server_ae = AE(ae_title="DOCDOPPLER")
    server_ae.add_supported_context(ModalityWorklistInformationFind)
    server = server_ae.start_server(
        ("127.0.0.1", 0),
        evt_handlers=[(evt.EVT_C_FIND, handle_find)],
        block=False,
    )
    port = server.server_address[1]
    try:
        with patch(
            "dicom_bridge.scp.fetch_worklist", return_value=fixture_patients
        ):
            client_ae = AE(ae_title="TESTCLIENT")
            client_ae.add_requested_context(ModalityWorklistInformationFind)
            assoc = client_ae.associate("127.0.0.1", port, ae_title="DOCDOPPLER")
            assert assoc.is_established

            identifier = Dataset()
            step = Dataset()
            step.ScheduledProcedureStepStartDate = "20260812"
            identifier.ScheduledProcedureStepSequence = [step]

            matches = []
            for status, dataset in assoc.send_c_find(
                identifier, ModalityWorklistInformationFind
            ):
                if status and status.Status == 0xFF00:
                    matches.append(dataset)
            assoc.release()
    finally:
        server.shutdown()

    assert len(matches) == 1
    assert matches[0].PatientID == "1"
    assert matches[0].PatientName == "Dupont^Jean"
    assert matches[0].AccessionNumber == "20260812-001"
    assert matches[0].ScheduledProcedureStepSequence[0].Modality == "US"


def test_find_succeeds_with_no_matches_when_worklist_empty():
    server_ae = AE(ae_title="DOCDOPPLER")
    server_ae.add_supported_context(ModalityWorklistInformationFind)
    server = server_ae.start_server(
        ("127.0.0.1", 0),
        evt_handlers=[(evt.EVT_C_FIND, handle_find)],
        block=False,
    )
    port = server.server_address[1]
    try:
        with patch("dicom_bridge.scp.fetch_worklist", return_value=[]):
            client_ae = AE(ae_title="TESTCLIENT")
            client_ae.add_requested_context(ModalityWorklistInformationFind)
            assoc = client_ae.associate("127.0.0.1", port, ae_title="DOCDOPPLER")
            assert assoc.is_established

            identifier = Dataset()
            step = Dataset()
            step.ScheduledProcedureStepStartDate = "20260812"
            identifier.ScheduledProcedureStepSequence = [step]

            statuses = [
                status.Status
                for status, _ in assoc.send_c_find(
                    identifier, ModalityWorklistInformationFind
                )
                if status
            ]
            assoc.release()
    finally:
        server.shutdown()

    assert statuses == [0x0000]


def test_find_returns_failure_status_when_worklist_client_errors():
    server_ae = AE(ae_title="DOCDOPPLER")
    server_ae.add_supported_context(ModalityWorklistInformationFind)
    server = server_ae.start_server(
        ("127.0.0.1", 0),
        evt_handlers=[(evt.EVT_C_FIND, handle_find)],
        block=False,
    )
    port = server.server_address[1]
    try:
        with patch(
            "dicom_bridge.scp.fetch_worklist",
            side_effect=WorklistClientError("api-gateway unreachable"),
        ):
            client_ae = AE(ae_title="TESTCLIENT")
            client_ae.add_requested_context(ModalityWorklistInformationFind)
            assoc = client_ae.associate("127.0.0.1", port, ae_title="DOCDOPPLER")
            assert assoc.is_established

            identifier = Dataset()
            step = Dataset()
            step.ScheduledProcedureStepStartDate = "20260812"
            identifier.ScheduledProcedureStepSequence = [step]

            statuses = [
                status.Status
                for status, _ in assoc.send_c_find(
                    identifier, ModalityWorklistInformationFind
                )
                if status
            ]
            assoc.release()
    finally:
        server.shutdown()

    assert 0xC000 in statuses
