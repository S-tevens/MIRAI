import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text

from agent import GEMINI_API_KEY, SLACK_WEBHOOK_URL, run_cycle
from db import AlertLog, Artist, RenderJob, get_session
from grafana import GRAFANA_API_KEY, GRAFANA_URL

app = FastAPI(title="MIRAI", description="Agentic VFX render pipeline monitor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _hours_until(deadline: datetime) -> float:
    now = datetime.now(timezone.utc)
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    return round((deadline - now).total_seconds() / 3600.0, 1)


@app.get("/jobs")
def get_jobs():
    session = get_session()
    try:
        jobs = session.query(RenderJob).order_by(RenderJob.deadline).all()
        return [
            {
                "id": j.id,
                "shot_name": j.shot_name,
                "sequence": j.sequence,
                "assigned_artist": j.assigned_artist,
                "status": j.status,
                "estimated_hours": j.estimated_hours,
                "actual_hours": j.actual_hours,
                "deadline": j.deadline.isoformat(),
                "hours_until_deadline": _hours_until(j.deadline),
                "render_attempts": j.render_attempts,
                "complexity_score": j.complexity_score,
            }
            for j in jobs
        ]
    finally:
        session.close()


@app.get("/artists")
def get_artists():
    session = get_session()
    try:
        artists = session.query(Artist).order_by(Artist.current_capacity_pct.desc()).all()
        return [
            {
                "id": a.id,
                "name": a.name,
                "current_capacity_pct": a.current_capacity_pct,
                "active_shots": a.active_shots,
            }
            for a in artists
        ]
    finally:
        session.close()


@app.get("/alerts")
def get_alerts():
    session = get_session()
    try:
        alerts = session.query(AlertLog).order_by(AlertLog.sent_at.desc()).limit(50).all()
        return [
            {
                "id": a.id,
                "shot_name": a.shot_name,
                "risk_reason": a.risk_reason,
                "recommended_action": a.recommended_action,
                "severity": a.severity,
                "sent_at": a.sent_at.isoformat() if a.sent_at else None,
            }
            for a in alerts
        ]
    finally:
        session.close()


class JobPatch(BaseModel):
    assigned_artist: Optional[str] = None
    status: Optional[str] = None
    render_attempts: Optional[int] = None


@app.patch("/jobs/{job_id}")
def patch_job(job_id: int, patch: JobPatch):
    session = get_session()
    try:
        job = session.get(RenderJob, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")

        if patch.assigned_artist is not None:
            job.assigned_artist = patch.assigned_artist
        if patch.status is not None:
            job.status = patch.status
        if patch.render_attempts is not None:
            job.render_attempts = patch.render_attempts
        job.updated_at = datetime.now(timezone.utc)

        session.commit()
        return {
            "id": job.id,
            "shot_name": job.shot_name,
            "assigned_artist": job.assigned_artist,
            "status": job.status,
            "render_attempts": job.render_attempts,
        }
    finally:
        session.close()


@app.get("/status")
def get_status():
    db_ok = True
    db_latency_ms = None
    try:
        start = time.perf_counter()
        session = get_session()
        try:
            session.execute(text("SELECT 1"))
        finally:
            session.close()
        db_latency_ms = round((time.perf_counter() - start) * 1000, 1)
    except Exception:
        db_ok = False

    return {
        "postgres": {"configured": True, "ok": db_ok, "latency_ms": db_latency_ms},
        "gemini": {"configured": bool(GEMINI_API_KEY)},
        "slack": {"configured": bool(SLACK_WEBHOOK_URL)},
        "grafana": {"configured": bool(GRAFANA_URL and GRAFANA_API_KEY)},
    }


@app.post("/agent/run")
def agent_run():
    try:
        return run_cycle()
    except Exception as exc:  # surface the real error to the demo/dev, not a generic 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
def health():
    return {"status": "ok"}
