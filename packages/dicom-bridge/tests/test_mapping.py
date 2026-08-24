from unittest.mock import patch

from dicom_bridge.mapping import patient_to_worklist_item


def _patient(**overrides) -> dict:
    base = {
        "id": 1,
        "first_name": "Jean",
        "last_name": "Dupont",
        "dob": "1958-03-12",
        "sex": "M",
        "exam_date": "2026-08-12",
        "accession_number": "20260812-001",
    }
    base.update(overrides)
    return base


def test_maps_patient_identity_fields():
    ds = patient_to_worklist_item(_patient())
    assert ds.PatientName == "Dupont^Jean"
    assert ds.PatientID == "1"
    assert ds.PatientBirthDate == "19580312"
    assert ds.PatientSex == "M"
    assert ds.AccessionNumber == "20260812-001"


def test_maps_scheduled_procedure_step_fields():
    ds = patient_to_worklist_item(_patient())
    step = ds.ScheduledProcedureStepSequence[0]
    assert step.ScheduledProcedureStepStartDate == "20260812"
    assert step.Modality == "US"
    assert step.ScheduledProcedureStepDescription == "Echo Doppler Vasculaire"


def test_modality_and_description_are_constant_regardless_of_input():
    ds = patient_to_worklist_item(_patient(exam_date="2026-12-25"))
    step = ds.ScheduledProcedureStepSequence[0]
    assert step.ScheduledProcedureStepStartDate == "20261225"
    assert step.Modality == "US"
    assert step.ScheduledProcedureStepDescription == "Echo Doppler Vasculaire"


def test_maps_specific_character_set_for_accented_french_names():
    ds = patient_to_worklist_item(_patient(last_name="Bénédicte", first_name="François"))
    assert ds.SpecificCharacterSet == "ISO_IR 100"
    assert ds.PatientName == "Bénédicte^François"


def test_maps_scheduled_station_aet_from_config():
    with patch("dicom_bridge.mapping.config.STATION_AET", "mindray"):
        ds = patient_to_worklist_item(_patient())
    step = ds.ScheduledProcedureStepSequence[0]
    assert step.ScheduledStationAETitle == "mindray"


def test_maps_procedure_ids_from_accession_number():
    ds = patient_to_worklist_item(_patient(accession_number="20260812-001"))
    step = ds.ScheduledProcedureStepSequence[0]
    assert step.ScheduledProcedureStepID == "20260812-001"
    assert ds.RequestedProcedureID == "20260812-001"
