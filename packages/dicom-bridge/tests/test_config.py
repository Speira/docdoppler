import importlib
import os
from unittest.mock import patch

from dicom_bridge import config


def test_defaults_are_permissive_when_env_unset():
    try:
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("BRIDGE_BIND_HOST", None)
            os.environ.pop("BRIDGE_REQUIRE_CALLED_AET", None)
            os.environ.pop("BRIDGE_ALLOWED_CALLING_AETS", None)
            importlib.reload(config)

            assert config.BIND_HOST == "0.0.0.0"
            assert config.REQUIRE_CALLED_AET is False
            assert config.ALLOWED_CALLING_AETS == []
    finally:
        importlib.reload(config)


def test_require_called_aet_reads_boolean_flag():
    try:
        with patch.dict(os.environ, {"BRIDGE_REQUIRE_CALLED_AET": "1"}):
            importlib.reload(config)

            assert config.REQUIRE_CALLED_AET is True
    finally:
        importlib.reload(config)


def test_allowed_calling_aets_parses_comma_separated_list():
    try:
        with patch.dict(os.environ, {"BRIDGE_ALLOWED_CALLING_AETS": "mindray, OTHER "}):
            importlib.reload(config)

            assert config.ALLOWED_CALLING_AETS == ["mindray", "OTHER"]
    finally:
        importlib.reload(config)
