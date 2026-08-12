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
