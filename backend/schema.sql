-- MIRAI schema — run against your managed Postgres instance (Supabase/Neon/etc.)

CREATE TABLE IF NOT EXISTS render_jobs (
    id SERIAL PRIMARY KEY,
    shot_name TEXT NOT NULL,
    sequence TEXT NOT NULL,
    assigned_artist TEXT NOT NULL,
    status TEXT NOT NULL, -- 'queued', 'rendering', 'failed', 'done'
    estimated_hours FLOAT NOT NULL,
    actual_hours FLOAT,
    deadline TIMESTAMP NOT NULL,
    render_attempts INT DEFAULT 1,
    complexity_score INT, -- 1-10, used to explain why something might be underestimated
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artists (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    current_capacity_pct FLOAT NOT NULL, -- 0-100, how loaded they are
    active_shots INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alerts_log (
    id SERIAL PRIMARY KEY,
    shot_name TEXT NOT NULL,
    risk_reason TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'high',
    sent_at TIMESTAMP DEFAULT NOW()
);
