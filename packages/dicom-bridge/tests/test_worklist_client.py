import json
import urllib.error
from unittest.mock import MagicMock, patch

import pytest

from dicom_bridge.worklist_client import WorklistClientError, fetch_worklist


def _fake_response(status: int, body: list) -> MagicMock:
    response = MagicMock()
    response.status = status
    response.read.return_value = json.dumps(body).encode("utf-8")
    response.__enter__.return_value = response
    response.__exit__.return_value = False
    return response


def test_fetch_worklist_returns_parsed_json():
    response = _fake_response(200, [{"id": 1, "last_name": "Dupont"}])
    with patch(
        "dicom_bridge.worklist_client.urllib.request.urlopen",
        return_value=response,
    ) as mock_urlopen:
        result = fetch_worklist("2026-08-12")

    assert result == [{"id": 1, "last_name": "Dupont"}]
    called_url = mock_urlopen.call_args[0][0]
    assert "date=2026-08-12" in called_url


def test_fetch_worklist_raises_on_non_200_status():
    response = _fake_response(500, [])
    with patch(
        "dicom_bridge.worklist_client.urllib.request.urlopen",
        return_value=response,
    ):
        with pytest.raises(WorklistClientError):
            fetch_worklist("2026-08-12")


def test_fetch_worklist_raises_on_network_error():
    with patch(
        "dicom_bridge.worklist_client.urllib.request.urlopen",
        side_effect=urllib.error.URLError("connection refused"),
    ):
        with pytest.raises(WorklistClientError):
            fetch_worklist("2026-08-12")
