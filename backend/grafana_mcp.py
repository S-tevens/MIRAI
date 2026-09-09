"""Grafana Cloud MCP server integration.

Unlike grafana.py's direct REST annotation push, this connects to the real
Grafana Cloud MCP server (github.com/grafana/mcp-grafana) over stdio and
calls its `get_annotations` tool, so MIRAI's own reasoning step can see its
past findings — "has this shot been flagged before and still isn't fixed?"
— pulled live from Grafana rather than re-deriving it from our own DB.

The MCP server binary ships as the `mcp-grafana` pip package (installed
alongside this file's Python deps) and is spawned as a subprocess per call.
Best-effort: any failure (unconfigured, binary missing, network) returns an
empty list rather than breaking the agent cycle.
"""

import asyncio
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

GRAFANA_URL = os.environ.get("GRAFANA_URL", "").rstrip("/")
GRAFANA_API_KEY = os.environ.get("GRAFANA_API_KEY")


def _mcp_grafana_binary() -> str:
    scripts_dir = os.path.dirname(sys.executable)
    name = "mcp-grafana.exe" if sys.platform == "win32" else "mcp-grafana"
    return os.path.join(scripts_dir, name)


async def _fetch_mirai_annotations(limit: int) -> list[dict]:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    params = StdioServerParameters(
        command=_mcp_grafana_binary(),
        args=["-t", "stdio"],
        env={
            **os.environ,
            "GRAFANA_URL": GRAFANA_URL,
            "GRAFANA_SERVICE_ACCOUNT_TOKEN": GRAFANA_API_KEY,
        },
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(
                "get_annotations",
                arguments={"tags": ["mirai"], "limit": limit},
            )
            text = result.content[0].text if result.content else "[]"
            parsed = json.loads(text)
            # mcp-grafana wraps the array as {"Payload": [...]}.
            return parsed.get("Payload", []) if isinstance(parsed, dict) else parsed


def get_recent_mirai_annotations(limit: int = 100) -> list[dict]:
    """Best-effort fetch of MIRAI's own past annotations via the Grafana MCP server."""
    if not GRAFANA_URL or not GRAFANA_API_KEY:
        return []
    try:
        return asyncio.run(_fetch_mirai_annotations(limit))
    except Exception as exc:
        print(f"Grafana MCP annotation fetch failed (non-fatal): {exc}")
        return []


def count_prior_flags_by_shot(limit: int = 100) -> dict[str, int]:
    """Shot name -> number of times MIRAI has previously flagged it, per Grafana's own record."""
    annotations = get_recent_mirai_annotations(limit)
    counts: dict[str, int] = {}
    for a in annotations:
        text = a.get("text", "")
        # Annotation text is authored in agent.py's act() as
        # "MIRAI flagged {shot_name}: {risk_reason}" — recover the shot name from it.
        if text.startswith("MIRAI flagged "):
            shot_name = text[len("MIRAI flagged ") :].split(":", 1)[0].strip()
            counts[shot_name] = counts.get(shot_name, 0) + 1
    return counts
