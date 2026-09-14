"""Storage SCP: accept a Comprehensive SR over C-STORE and persist it.

Scope is deliberately "accept and save the raw file" — nothing here reads
measurement values out of the SR (see docs/dicom-worklist-bridge.md).
"""

import logging
from pathlib import Path
from unittest.mock import patch

import pydicom
import pytest
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid
from pynetdicom import AE, evt
from pynetdicom.sop_class import ComprehensiveSRStorage

from dicom_bridge.store_scp import StoreTargetError, handle_store, target_path

STUDY_UID = "1.2.840.10008.1.2.3.4.5"
SOP_UID = "1.2.840.10008.1.2.3.4.5.1"


def _code(value: str, scheme: str, meaning: str) -> Dataset:
    code = Dataset()
    code.CodeValue = value
    code.CodingSchemeDesignator = scheme
    code.CodeMeaning = meaning
    return code


def build_vascular_sr(
    study_uid: str = STUDY_UID, sop_uid: str = SOP_UID
) -> Dataset:
    """A minimal TID 5100 (Vascular Ultrasound Report) shaped SR.

    Root CONTAINER "Vascular Ultrasound Procedure Report" holding a findings
    CONTAINER with one NUM measurement and its laterality — enough structure
    to stand in for a real ME8 export without claiming to be a full TID 5100
    instance.
    """
    ds = Dataset()
    ds.SOPClassUID = ComprehensiveSRStorage
    ds.SOPInstanceUID = sop_uid
    ds.StudyInstanceUID = study_uid
    ds.SeriesInstanceUID = generate_uid()
    ds.Modality = "SR"
    ds.PatientName = "Dupont^Jean"
    ds.PatientID = "1"
    ds.SeriesNumber = 1
    ds.InstanceNumber = 1
    ds.CompletionFlag = "COMPLETE"
    ds.VerificationFlag = "UNVERIFIED"
    ds.ContentDate = "20260906"
    ds.ContentTime = "101500"

    ds.ValueType = "CONTAINER"
    ds.ContinuityOfContent = "SEPARATE"
    ds.ConceptNameCodeSequence = [
        _code("125100", "DCM", "Vascular Ultrasound Procedure Report")
    ]

    measurement = Dataset()
    measurement.RelationshipType = "CONTAINS"
    measurement.ValueType = "NUM"
    measurement.ConceptNameCodeSequence = [
        _code("11726-7", "LN", "Peak systolic velocity")
    ]
    measured_value = Dataset()
    measured_value.NumericValue = "85.0"
    measured_value.MeasurementUnitsCodeSequence = [
        _code("cm/s", "UCUM", "cm/s")
    ]
    measurement.MeasuredValueSequence = [measured_value]

    laterality = Dataset()
    laterality.RelationshipType = "HAS CONCEPT MOD"
    laterality.ValueType = "CODE"
    laterality.ConceptNameCodeSequence = [_code("G-C171", "SRT", "Laterality")]
    laterality.ConceptCodeSequence = [_code("G-A100", "SRT", "Right")]
    measurement.ContentSequence = [laterality]

    findings = Dataset()
    findings.RelationshipType = "CONTAINS"
    findings.ValueType = "CONTAINER"
    findings.ContinuityOfContent = "SEPARATE"
    findings.ConceptNameCodeSequence = [_code("121070", "DCM", "Findings")]
    findings.ContentSequence = [measurement]

    ds.ContentSequence = [findings]

    ds.file_meta = FileMetaDataset()
    ds.file_meta.MediaStorageSOPClassUID = ds.SOPClassUID
    ds.file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
    ds.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    return ds


def _store(dataset: Dataset, calling_aet: str = "mindray", **ae_kwargs):
    """Run one real C-STORE association against the storage handler."""
    server_ae = AE(ae_title="DOCDOPPLER-STORE")
    server_ae.add_supported_context(ComprehensiveSRStorage)
    for key, value in ae_kwargs.items():
        setattr(server_ae, key, value)
    server = server_ae.start_server(
        ("127.0.0.1", 0),
        evt_handlers=[(evt.EVT_C_STORE, handle_store)],
        block=False,
    )
    port = server.server_address[1]
    try:
        client_ae = AE(ae_title=calling_aet)
        client_ae.add_requested_context(ComprehensiveSRStorage)
        assoc = client_ae.associate(
            "127.0.0.1", port, ae_title="DOCDOPPLER-STORE"
        )
        if not assoc.is_established:
            return None
        status = assoc.send_c_store(dataset)
        assoc.release()
        return status
    finally:
        server.shutdown()


def test_target_path_nests_sop_instance_under_study(tmp_path):
    path = target_path(build_vascular_sr(), tmp_path)

    assert path == tmp_path / STUDY_UID / f"{SOP_UID}.dcm"


def test_target_path_rejects_uid_containing_path_separators(tmp_path):
    dataset = build_vascular_sr(study_uid="../../etc")

    with pytest.raises(StoreTargetError):
        target_path(dataset, tmp_path)


def test_target_path_rejects_missing_study_uid(tmp_path):
    dataset = build_vascular_sr()
    del dataset.StudyInstanceUID

    with pytest.raises(StoreTargetError):
        target_path(dataset, tmp_path)


def test_target_path_rejects_missing_sop_instance_uid(tmp_path):
    dataset = build_vascular_sr()
    del dataset.SOPInstanceUID

    with pytest.raises(StoreTargetError):
        target_path(dataset, tmp_path)


def test_store_accepts_vascular_sr_over_association(tmp_path):
    with patch("dicom_bridge.store_scp.config.STORE_DIR", tmp_path):
        status = _store(build_vascular_sr())

    assert status is not None
    assert status.Status == 0x0000


def test_store_writes_the_sr_to_disk_unchanged(tmp_path):
    with patch("dicom_bridge.store_scp.config.STORE_DIR", tmp_path):
        _store(build_vascular_sr())

    saved = tmp_path / STUDY_UID / f"{SOP_UID}.dcm"
    assert saved.exists()

    reloaded = pydicom.dcmread(saved)
    assert reloaded.SOPInstanceUID == SOP_UID
    assert reloaded.SOPClassUID == ComprehensiveSRStorage
    assert reloaded.PatientName == "Dupont^Jean"
    findings = reloaded.ContentSequence[0]
    measurement = findings.ContentSequence[0]
    assert measurement.MeasuredValueSequence[0].NumericValue == "85.0"


def test_store_keeps_both_srs_of_one_study(tmp_path):
    second_sop_uid = f"{STUDY_UID}.2"
    with patch("dicom_bridge.store_scp.config.STORE_DIR", tmp_path):
        _store(build_vascular_sr())
        _store(build_vascular_sr(sop_uid=second_sop_uid))

    study_dir = tmp_path / STUDY_UID
    assert sorted(p.name for p in study_dir.iterdir()) == sorted(
        [f"{SOP_UID}.dcm", f"{second_sop_uid}.dcm"]
    )


def test_store_refuses_dataset_it_cannot_file(tmp_path):
    dataset = build_vascular_sr(study_uid="../../etc")
    with patch("dicom_bridge.store_scp.config.STORE_DIR", tmp_path):
        status = _store(dataset)

    assert status.Status == 0xC000
    assert list(tmp_path.iterdir()) == []


def test_store_reports_out_of_resources_when_the_write_fails(tmp_path):
    with (
        patch("dicom_bridge.store_scp.config.STORE_DIR", tmp_path),
        patch(
            "dicom_bridge.store_scp.Path.mkdir",
            side_effect=OSError("disk full"),
        ),
    ):
        status = _store(build_vascular_sr())

    assert status.Status == 0xA700


def test_store_rejects_association_from_disallowed_calling_aet(tmp_path):
    with patch("dicom_bridge.store_scp.config.STORE_DIR", tmp_path):
        status = _store(
            build_vascular_sr(),
            calling_aet="UNKNOWN",
            require_calling_aet=["mindray"],
        )

    assert status is None
    assert list(tmp_path.iterdir()) == []


def test_store_dir_default_lives_under_the_package(tmp_path):
    from dicom_bridge import config

    assert Path(config.STORE_DIR).parts[-2:] == ("data", "received_sr")


def test_successful_store_logs_where_the_file_landed(tmp_path, caplog):
    caplog.set_level(logging.INFO)
    with patch("dicom_bridge.store_scp.config.STORE_DIR", tmp_path):
        _store(build_vascular_sr())

    assert SOP_UID in caplog.text
    assert str(tmp_path / STUDY_UID / f"{SOP_UID}.dcm") in caplog.text


def test_refused_store_logs_why_at_warning(tmp_path, caplog):
    caplog.set_level(logging.INFO)
    with patch("dicom_bridge.store_scp.config.STORE_DIR", tmp_path):
        _store(build_vascular_sr(study_uid="../../etc"))

    warnings = [r for r in caplog.records if r.levelno >= logging.WARNING]
    assert warnings
    assert "StudyInstanceUID" in caplog.text


def test_failed_write_logs_the_error(tmp_path, caplog):
    caplog.set_level(logging.INFO)
    with (
        patch("dicom_bridge.store_scp.config.STORE_DIR", tmp_path),
        patch(
            "dicom_bridge.store_scp.Path.mkdir",
            side_effect=OSError("disk full"),
        ),
    ):
        _store(build_vascular_sr())

    errors = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert errors
    assert "disk full" in caplog.text
