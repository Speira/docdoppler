from pynetdicom import AE, evt
from pynetdicom.sop_class import ModalityWorklistInformationFind, Verification

from . import config
from .scp import handle_echo, handle_find


def main() -> None:
    ae = AE(ae_title=config.AE_TITLE)
    ae.add_supported_context(Verification)
    ae.add_supported_context(ModalityWorklistInformationFind)

    handlers = [
        (evt.EVT_C_ECHO, handle_echo),
        (evt.EVT_C_FIND, handle_find),
    ]

    print(
        f"DICOM Worklist Bridge listening on port {config.PORT}, "
        f"AE title {config.AE_TITLE}"
    )
    ae.start_server(("0.0.0.0", config.PORT), evt_handlers=handlers, block=True)


if __name__ == "__main__":
    main()
