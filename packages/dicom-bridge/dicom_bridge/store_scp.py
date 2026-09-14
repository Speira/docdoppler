"""C-STORE handler: persist incoming Structured Reports, nothing more.

This deliberately does not read measurement values out of the SR — parsing
is a separate task, gated on having a real ME8 export to validate against
(see docs/dicom-worklist-bridge.md). Everything here treats the dataset as
an opaque file to write to disk.
"""

import re
from pathlib import Path

from . import config
from .logging_setup import logger

# A DICOM UID is digits and dots only, at most 64 characters. Enforcing that
# is what makes it safe to use one as a path component: no separators, no
# "..", nothing that can escape the storage directory.
_UID_PATTERN = re.compile(r"^[0-9]+(\.[0-9]+)*$")
_UID_MAX_LENGTH = 64


class StoreTargetError(ValueError):
    """The dataset carries no UIDs we can safely turn into a file path."""


def _path_component(dataset, keyword: str) -> str:
    value = getattr(dataset, keyword, None)
    if value is None:
        raise StoreTargetError(f"{keyword} is missing")
    value = str(value)
    if len(value) > _UID_MAX_LENGTH or not _UID_PATTERN.match(value):
        raise StoreTargetError(f"{keyword} is not a well-formed UID: {value!r}")
    return value


def target_path(dataset, root: Path) -> Path:
    """`<root>/<StudyInstanceUID>/<SOPInstanceUID>.dcm`.

    Grouping by study keeps an exam's reports together; naming the file by
    SOP instance means a study with several SRs keeps all of them, while a
    re-sent instance overwrites itself instead of piling up duplicates.
    """
    study_uid = _path_component(dataset, "StudyInstanceUID")
    sop_uid = _path_component(dataset, "SOPInstanceUID")
    return Path(root) / study_uid / f"{sop_uid}.dcm"


def handle_store(event) -> int:
    dataset = event.dataset
    sop_class = getattr(event.file_meta, "MediaStorageSOPClassUID", None)
    try:
        path = target_path(dataset, config.STORE_DIR)
    except StoreTargetError as error:
        logger.warning(
            "C-STORE refused (SOP class %s): %s", sop_class, error
        )
        return 0xC000  # Cannot understand
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        dataset.file_meta = event.file_meta
        dataset.save_as(path, enforce_file_format=True)
    except OSError as error:
        logger.error("C-STORE could not write %s: %s", path, error)
        return 0xA700  # Out of resources
    logger.info(
        "Stored SOP instance %s (SOP class %s) to %s",
        dataset.SOPInstanceUID,
        sop_class,
        path,
    )
    return 0x0000
