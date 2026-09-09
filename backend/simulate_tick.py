"""Advance the render farm state by one 'tick' so the demo shows live data.

Each run randomly does a mix of:
  - advancing actual_hours on in-progress jobs (sometimes past the estimate)
  - failing a render (bumping render_attempts, status -> 'failed')
  - completing a job (status -> 'done')
  - adding a brand new queued job
  - nudging an artist's capacity up/down

Run manually before/during a demo: python simulate_tick.py
Or on a schedule (cron / Cloud Scheduler hitting a wrapper endpoint).
"""

import random
from datetime import datetime, timedelta, timezone

from db import Artist, RenderJob, get_session
from seed_data import SEQUENCES, SHOT_KINDS


def advance_in_progress(session) -> list[str]:
    events = []
    jobs = session.query(RenderJob).filter(RenderJob.status == "rendering").all()
    for job in random.sample(jobs, k=min(len(jobs), max(1, len(jobs) // 3))):
        bump = round(job.estimated_hours * random.uniform(0.1, 0.35), 1)
        job.actual_hours = round((job.actual_hours or 0) + bump, 1)
        job.updated_at = datetime.now(timezone.utc)

        roll = random.random()
        if roll < 0.12:
            job.status = "failed"
            job.render_attempts = (job.render_attempts or 1) + 1
            events.append(f"FAILED: {job.shot_name} (attempt {job.render_attempts})")
        elif roll < 0.30 and job.actual_hours >= job.estimated_hours * 0.9:
            job.status = "done"
            events.append(f"DONE: {job.shot_name}")
        else:
            events.append(f"PROGRESS: {job.shot_name} -> {job.actual_hours}h")
    return events


def requeue_failed(session) -> list[str]:
    events = []
    failed = session.query(RenderJob).filter(RenderJob.status == "failed").all()
    for job in random.sample(failed, k=min(len(failed), 1)):
        if random.random() < 0.5:
            job.status = "rendering"
            job.updated_at = datetime.now(timezone.utc)
            events.append(f"RETRY: {job.shot_name} back to rendering")
    return events


def add_new_job(session) -> list[str]:
    artists = session.query(Artist).all()
    if not artists:
        return []
    artist = random.choice(artists)
    complexity = random.randint(1, 10)
    shot_num = random.randint(201, 999)
    kind = random.choice(SHOT_KINDS)
    job = RenderJob(
        shot_name=f"SHOT_{shot_num:03d}_{kind}",
        sequence=random.choice(SEQUENCES),
        assigned_artist=artist.name,
        status="queued",
        estimated_hours=round(random.uniform(4, 24) + complexity * 1.5, 1),
        deadline=datetime.now(timezone.utc) + timedelta(hours=random.uniform(6, 48)),
        render_attempts=1,
        complexity_score=complexity,
    )
    artist.active_shots = (artist.active_shots or 0) + 1
    session.add(job)
    return [f"NEW JOB: {job.shot_name} -> {artist.name}"]


def jitter_capacity(session) -> list[str]:
    events = []
    for artist in session.query(Artist).all():
        if random.random() < 0.3:
            delta = random.uniform(-8, 8)
            artist.current_capacity_pct = max(5, min(100, artist.current_capacity_pct + delta))
            events.append(f"CAPACITY: {artist.name} -> {artist.current_capacity_pct:.0f}%")
    return events


def main() -> None:
    session = get_session()
    events = []
    try:
        events += advance_in_progress(session)
        events += requeue_failed(session)
        if random.random() < 0.4:
            events += add_new_job(session)
        events += jitter_capacity(session)
        session.commit()
    finally:
        session.close()

    print(f"Tick complete — {len(events)} events:")
    for e in events:
        print(f"  {e}")


if __name__ == "__main__":
    main()
