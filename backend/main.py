from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from agent import run_cycle
from db import AlertLog, Artist, RenderJob, get_session

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


@app.post("/agent/run")
def agent_run():
    try:
        return run_cycle()
    except Exception as exc:  # surface the real error to the demo/dev, not a generic 500
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
def health():
    return {"status": "ok"}
