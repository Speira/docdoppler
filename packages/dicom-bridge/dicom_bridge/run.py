from pynetdicom import AE, evt
from pynetdicom.sop_class import ModalityWorklistInformationFind, Verification

from . import config
from .scp import handle_echo, handle_find


def build_ae() -> AE:
    ae = AE(ae_title=config.AE_TITLE)
    ae.add_supported_context(Verification)
    ae.add_supported_context(ModalityWorklistInformationFind)
    ae.require_called_aet = config.REQUIRE_CALLED_AET
    ae.require_calling_aet = config.ALLOWED_CALLING_AETS
    return ae


def main() -> None:
    ae = build_ae()

    handlers = [
        (evt.EVT_C_ECHO, handle_echo),
        (evt.EVT_C_FIND, handle_find),
    ]

    print(
        f"DICOM Worklist Bridge listening on {config.BIND_HOST}:{config.PORT}, "
        f"AE title {config.AE_TITLE}, "
        f"require_called_aet={config.REQUIRE_CALLED_AET}, "
        f"allowed_calling_aets={config.ALLOWED_CALLING_AETS or 'any'}"
    )
    ae.start_server(
        (config.BIND_HOST, config.PORT), evt_handlers=handlers, block=True
    )


if __name__ == "__main__":
    main()
