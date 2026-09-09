"""MIRAI's agentic reasoning loop: observe -> reason (Gemini) -> decide -> act.

Each call to run_cycle() does one full pass:
  1. observe()  - query Postgres, compute risk signals per in-progress job
  2. reason()   - send the at-risk jobs + artist workload to Gemini, get back
                  structured findings (shot, root cause, recommended action, severity)
  3. decide()   - keep only severity == "high" (avoid alert fatigue)
  4. act()      - log each high-severity finding + push a Slack alert
"""

import json
import os
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from google import genai

from db import AlertLog, Artist, RenderJob, get_session
from grafana import push_annotation
from grafana_mcp import count_prior_flags_by_shot

load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL")

SYSTEM_PROMPT = """You are MIRAI, an AI production supervisor for a VFX render pipeline.
You will be given a JSON list of render jobs and artist workloads.
Each job includes previously_flagged_count, pulled live from Grafana's own
annotation history (via the Grafana MCP server) — how many past cycles have
already flagged this exact shot. Treat a high previously_flagged_count as a
sign that earlier recommendations were not acted on and escalate accordingly.
For each job at meaningful risk of missing its deadline, output:
- shot_name
- risk_reason (one specific, causal sentence - not generic)
- recommended_action (one concrete, specific action)
- severity: "high" | "medium"
Only include jobs that are ACTUALLY at risk, not everything.
Respond in valid JSON only, as a list of objects."""


def _hours_until(deadline: datetime) -> float:
    now = datetime.now(timezone.utc)
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    return (deadline - now).total_seconds() / 3600.0


def observe(session) -> dict:
    """Query current state and compute risk signals for in-progress jobs."""
    artists = session.query(Artist).all()
    artist_by_name = {a.name: a for a in artists}

    jobs = (
        session.query(RenderJob)
        .filter(RenderJob.status.in_(["queued", "rendering", "failed"]))
        .all()
    )

    # Pulled live from Grafana Cloud via its MCP server (get_annotations), not
    # re-derived from our own alerts_log — lets Gemini see "MIRAI already
    # flagged this shot N times and it's still not fixed" as a real signal.
    prior_flags = count_prior_flags_by_shot()

    job_signals = []
    for job in jobs:
        hours_remaining = round(_hours_until(job.deadline), 1)
        hours_spent = job.actual_hours or 0.0
        estimated_remaining = max(job.estimated_hours - hours_spent, 0.0)
        # >1 means the remaining work needs more time than the deadline allows.
        risk_ratio = round(estimated_remaining / hours_remaining, 2) if hours_remaining > 0 else 999

        artist = artist_by_name.get(job.assigned_artist)
        job_signals.append(
            {
                "shot_name": job.shot_name,
                "sequence": job.sequence,
                "assigned_artist": job.assigned_artist,
                "status": job.status,
                "hours_remaining_to_deadline": hours_remaining,
                "estimated_hours": job.estimated_hours,
                "actual_hours_so_far": hours_spent,
                "estimated_hours_remaining": round(estimated_remaining, 1),
                "risk_ratio": risk_ratio,
                "artist_overloaded": bool(artist and artist.current_capacity_pct > 80),
                "artist_capacity_pct": artist.current_capacity_pct if artist else None,
                "render_attempts": job.render_attempts,
                "has_failed_renders": job.render_attempts > 1,
                "complexity_score": job.complexity_score,
                "previously_flagged_count": prior_flags.get(job.shot_name, 0),
            }
        )

    artist_signals = [
        {
            "name": a.name,
            "current_capacity_pct": a.current_capacity_pct,
            "active_shots": a.active_shots,
        }
        for a in artists
    ]

    return {"jobs": job_signals, "artists": artist_signals}


def reason(observation: dict) -> list[dict]:
    """Send observed state to Gemini and parse its structured findings."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set — see .env.example.")

    client = genai.Client(api_key=GEMINI_API_KEY)

    user_content = (
        "Render jobs and artist workloads (JSON):\n\n"
        + json.dumps(observation, indent=2)
    )

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_content,
        config={
            "system_instruction": SYSTEM_PROMPT,
            "response_mime_type": "application/json",
        },
    )

    text = response.text.strip()
    try:
        findings = json.loads(text)
    except json.JSONDecodeError:
        # Gemini occasionally wraps JSON in a code fence despite the mime type request.
        cleaned = text.strip("`").removeprefix("json").strip()
        findings = json.loads(cleaned)

    if not isinstance(findings, list):
        raise ValueError(f"Expected a JSON list from Gemini, got: {type(findings)}")
    return findings


def decide(findings: list[dict]) -> list[dict]:
    """Filter to high-severity findings only, to avoid alert fatigue in the demo."""
    return [f for f in findings if f.get("severity") == "high"]


def _post_slack_alert(finding: dict, hours_remaining: float | None) -> None:
    if not SLACK_WEBHOOK_URL:
        return

    deadline_line = (
        f"Deadline: {hours_remaining}h remaining" if hours_remaining is not None else ""
    )
    text = (
        f":warning: *MIRAI Alert*: {finding['shot_name']} at risk\n"
        f"Reason: {finding['risk_reason']}\n"
        f"Recommendation: {finding['recommended_action']}\n"
        f"{deadline_line}"
    )
    # Best-effort, same reasoning as grafana.push_annotation: a transient
    # Slack failure shouldn't abort alerts_log persistence for this cycle.
    try:
        requests.post(SLACK_WEBHOOK_URL, json={"text": text}, timeout=10).raise_for_status()
    except requests.RequestException as exc:
        print(f"Slack alert failed (non-fatal): {exc}")


def act(session, findings: list[dict], observation: dict) -> list[dict]:
    """Log each high-severity finding to alerts_log and push a Slack alert."""
    jobs_by_name = {j["shot_name"]: j for j in observation["jobs"]}
    acted = []

    for finding in findings:
        job_info = jobs_by_name.get(finding.get("shot_name"))
        hours_remaining = job_info["hours_remaining_to_deadline"] if job_info else None

        alert = AlertLog(
            shot_name=finding["shot_name"],
            risk_reason=finding["risk_reason"],
            recommended_action=finding["recommended_action"],
            severity=finding.get("severity", "high"),
        )
        session.add(alert)

        _post_slack_alert(finding, hours_remaining)
        push_annotation(
            f"MIRAI flagged {finding['shot_name']}: {finding['risk_reason']}",
            tags=["mirai", "alert", finding.get("severity", "high")],
        )
        acted.append(finding)

    session.commit()
    return acted


def run_cycle() -> dict:
    """Run one full observe -> reason -> decide -> act cycle."""
    session = get_session()
    try:
        observation = observe(session)
        findings = reason(observation)
        high_severity = decide(findings)
        alerts_sent = act(session, high_severity, observation)

        return {
            "observed_job_count": len(observation["jobs"]),
            "findings": findings,
            "alerts_sent": alerts_sent,
        }
    finally:
        session.close()


if __name__ == "__main__":
    result = run_cycle()
    print(json.dumps(result, indent=2))
