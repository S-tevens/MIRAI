"""Populate render_jobs / artists with synthetic-but-plausible VFX pipeline data.

Deliberately wires up causal stories for the agent to find: some high-complexity
shots are assigned to already-overloaded artists, some jobs have failed renders,
and deadlines range from "urgent" to "safe" so severity naturally varies.

Run with: python seed_data.py
"""

import random
from datetime import datetime, timedelta, timezone

from db import Artist, RenderJob, get_session, init_db

random.seed(7)

ARTIST_NAMES = [
    "Priya Nair",
    "Marcus Obi",
    "Lena Fischer",
    "Diego Solis",
    "Wren Callahan",
    "Yuki Tanaka",
    "Sam Okafor",
    "Alba Reyes",
    "Noah Kim",
    "Ivy Petrov",
]

SEQUENCES = [
    "Sequence_A_Chase",
    "Sequence_B_Finale",
    "Sequence_C_Infiltration",
    "Sequence_D_Aftermath",
]

SHOT_KINDS = [
    "hero_flythrough",
    "wide_establish",
    "creature_closeup",
    "explosion_fx",
    "crowd_sim",
    "vehicle_chase",
    "water_sim",
    "set_extension",
    "matte_paint_comp",
    "facial_capture",
]


def make_artists(session) -> list[Artist]:
    artists = []
    # Deliberate spread: a few overloaded (90%+), a few underused (20-30%).
    capacities = [95, 92, 88, 55, 60, 45, 30, 22, 70, 35]
    random.shuffle(capacities)
    for name, cap in zip(ARTIST_NAMES, capacities):
        artist = Artist(name=name, current_capacity_pct=cap, active_shots=0)
        session.add(artist)
        artists.append(artist)
    session.flush()
    return artists


def pick_deadline(urgency: str) -> datetime:
    now = datetime.now(timezone.utc)
    if urgency == "urgent":
        return now + timedelta(hours=random.uniform(4, 10))
    if urgency == "soon":
        return now + timedelta(hours=random.uniform(18, 36))
    return now + timedelta(days=random.uniform(2, 5))


def make_jobs(session, artists: list[Artist], count: int = 32) -> None:
    overloaded = [a for a in artists if a.current_capacity_pct >= 80]
    underused = [a for a in artists if a.current_capacity_pct <= 40]

    used_shot_numbers = set()

    for i in range(count):
        sequence = random.choice(SEQUENCES)
        kind = random.choice(SHOT_KINDS)
        while True:
            shot_num = random.randint(1, 200)
            if shot_num not in used_shot_numbers:
                used_shot_numbers.add(shot_num)
                break
        shot_name = f"SHOT_{shot_num:03d}_{kind}"

        # Weighted status mix: mostly queued/rendering, a few failed, a few done.
        status = random.choices(
            ["queued", "rendering", "failed", "done"],
            weights=[35, 35, 15, 15],
            k=1,
        )[0]

        complexity = random.randint(1, 10)

        # Deliberately steer high-complexity shots toward overloaded artists
        # about half the time, so there's a causal story to find.
        if complexity >= 7 and overloaded and random.random() < 0.5:
            artist = random.choice(overloaded)
        elif complexity <= 3 and underused and random.random() < 0.5:
            artist = random.choice(underused)
        else:
            artist = random.choice(artists)

        artist.active_shots += 1

        estimated_hours = round(random.uniform(4, 24) + complexity * 1.5, 1)

        urgency = random.choices(["urgent", "soon", "safe"], weights=[20, 30, 50], k=1)[0]
        deadline = pick_deadline(urgency)

        render_attempts = 1
        actual_hours = None

        if status == "failed":
            render_attempts = random.randint(2, 4)
            actual_hours = round(estimated_hours * random.uniform(0.4, 0.9), 1)
        elif status == "rendering":
            # Some rendering jobs are clearly behind their estimate already.
            if random.random() < 0.4:
                actual_hours = round(estimated_hours * random.uniform(1.1, 1.8), 1)
            else:
                actual_hours = round(estimated_hours * random.uniform(0.3, 0.9), 1)
        elif status == "done":
            actual_hours = round(estimated_hours * random.uniform(0.8, 1.3), 1)

        job = RenderJob(
            shot_name=shot_name,
            sequence=sequence,
            assigned_artist=artist.name,
            status=status,
            estimated_hours=estimated_hours,
            actual_hours=actual_hours,
            deadline=deadline,
            render_attempts=render_attempts,
            complexity_score=complexity,
        )
        session.add(job)


def main() -> None:
    init_db()
    session = get_session()
    try:
        session.query(RenderJob).delete()
        session.query(Artist).delete()
        session.commit()

        artists = make_artists(session)
        make_jobs(session, artists, count=random.randint(25, 40))
        session.commit()

        job_count = session.query(RenderJob).count()
        artist_count = session.query(Artist).count()
        print(f"Seeded {artist_count} artists and {job_count} render jobs.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
