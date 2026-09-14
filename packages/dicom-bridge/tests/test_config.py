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


def test_store_defaults_are_a_separate_ae_and_port():
    try:
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("BRIDGE_STORE_AE_TITLE", None)
            os.environ.pop("BRIDGE_STORE_PORT", None)
            importlib.reload(config)

            assert config.STORE_AE_TITLE == "DOCDOPPLER-STORE"
            assert config.STORE_PORT == 11113
            assert config.STORE_PORT != config.PORT
    finally:
        importlib.reload(config)


def test_store_ae_title_and_port_are_overridable():
    try:
        with patch.dict(
            os.environ,
            {"BRIDGE_STORE_AE_TITLE": "OTHER_STORE", "BRIDGE_STORE_PORT": "11999"},
        ):
            importlib.reload(config)

            assert config.STORE_AE_TITLE == "OTHER_STORE"
            assert config.STORE_PORT == 11999
    finally:
        importlib.reload(config)


def test_store_dir_is_overridable():
    try:
        with patch.dict(os.environ, {"BRIDGE_STORE_DIR": "/tmp/received"}):
            importlib.reload(config)

            assert str(config.STORE_DIR) == "/tmp/received"
    finally:
        importlib.reload(config)
