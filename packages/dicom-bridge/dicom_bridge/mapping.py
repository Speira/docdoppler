from pydicom.dataset import Dataset

from . import config


def patient_to_worklist_item(patient: dict) -> Dataset:
    dataset = Dataset()
    dataset.SpecificCharacterSet = "ISO_IR 100"
    dataset.PatientName = f"{patient['last_name']}^{patient['first_name']}"
    dataset.PatientID = str(patient["id"])
    dataset.PatientBirthDate = patient["dob"].replace("-", "")
    dataset.PatientSex = patient["sex"]
    dataset.AccessionNumber = patient["accession_number"]
    dataset.RequestedProcedureID = patient["accession_number"]

    step = Dataset()
    step.ScheduledStationAETitle = config.STATION_AET
    step.ScheduledProcedureStepStartDate = patient["exam_date"].replace("-", "")
    step.ScheduledProcedureStepID = patient["accession_number"]
    step.Modality = "US"
    step.ScheduledProcedureStepDescription = "Echo Doppler Vasculaire"
    dataset.ScheduledProcedureStepSequence = [step]

    return dataset
