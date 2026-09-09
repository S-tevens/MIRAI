"""Grafana Cloud HTTP API integration — pushes an annotation each time MIRAI
fires an alert, so the dashboard visibly marks the moment the agent acted.

Set GRAFANA_URL (e.g. https://yourstack.grafana.net) and GRAFANA_API_KEY
(a Grafana Cloud service account token with annotation:write) to enable.
Silently no-ops if either is missing, so local dev without Grafana still works.
"""

import os

import requests
from dotenv import load_dotenv

load_dotenv()

GRAFANA_URL = os.environ.get("GRAFANA_URL", "").rstrip("/")
GRAFANA_API_KEY = os.environ.get("GRAFANA_API_KEY")


def push_annotation(text: str, tags: list[str] | None = None) -> bool:
    if not GRAFANA_URL or not GRAFANA_API_KEY:
        return False

    resp = requests.post(
        f"{GRAFANA_URL}/api/annotations",
        headers={"Authorization": f"Bearer {GRAFANA_API_KEY}"},
        json={"text": text, "tags": tags or ["mirai"]},
        timeout=10,
    )
    resp.raise_for_status()
    return True
