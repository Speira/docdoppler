import json
import urllib.error
import urllib.parse
import urllib.request

from . import config


class WorklistClientError(Exception):
    pass


def fetch_worklist(date: str) -> list:
    query = urllib.parse.urlencode({"date": date})
    url = f"{config.WORKLIST_ENDPOINT_URL}?{query}"
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            if response.status != 200:
                raise WorklistClientError(f"unexpected status {response.status}")
            return json.loads(response.read())
    except urllib.error.URLError as exc:
        raise WorklistClientError(str(exc)) from exc
