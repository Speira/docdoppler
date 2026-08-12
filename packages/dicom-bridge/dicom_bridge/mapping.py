from pydicom.dataset import Dataset


def patient_to_worklist_item(patient: dict) -> Dataset:
    dataset = Dataset()
    dataset.PatientName = f"{patient['last_name']}^{patient['first_name']}"
    dataset.PatientID = str(patient["id"])
    dataset.PatientBirthDate = patient["dob"].replace("-", "")
    dataset.PatientSex = patient["sex"]
    dataset.AccessionNumber = patient["accession_number"]

    step = Dataset()
    step.ScheduledProcedureStepStartDate = patient["exam_date"].replace("-", "")
    step.Modality = "US"
    step.ScheduledProcedureStepDescription = "Echo Doppler Vasculaire"
    dataset.ScheduledProcedureStepSequence = [step]

    return dataset
