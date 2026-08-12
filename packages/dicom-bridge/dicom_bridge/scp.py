import datetime

from .mapping import patient_to_worklist_item
from .worklist_client import WorklistClientError, fetch_worklist


def handle_echo(event) -> int:
    return 0x0000


def _extract_requested_date(identifier) -> str:
    steps = getattr(identifier, "ScheduledProcedureStepSequence", None)
    if steps:
        raw_date = getattr(steps[0], "ScheduledProcedureStepStartDate", "")
        if raw_date:
            return f"{raw_date[0:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
    return datetime.date.today().isoformat()


def handle_find(event):
    date = _extract_requested_date(event.identifier)
    try:
        patients = fetch_worklist(date)
    except WorklistClientError:
        yield 0xC000, None
        return
    for patient in patients:
        yield 0xFF00, patient_to_worklist_item(patient)
