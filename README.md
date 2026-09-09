# MIRAI

**Live demo:** https://mirai-nine-xi.vercel.app (backend: https://mirai-bmf8.onrender.com)

MIRAI is an agentic post-production pipeline monitor for VFX render farms, built for
the Agentic Cinema hackathon (Grafana partner track).

It is not a passive dashboard. Every cycle, MIRAI:

1. **Observes** the render queue and artist workload from Postgres, enriched with each
   job's own flag history pulled live from Grafana Cloud via its MCP server
2. **Reasons** about which jobs are genuinely at risk of missing their deadline, and why —
   including whether earlier warnings were ignored — using Gemini
3. **Decides** which findings are severe enough to act on
4. **Acts**: logs the finding, posts a Slack alert, and annotates the Grafana dashboard — without a human asking

The full loop lives in [`backend/agent.py`](backend/agent.py).

## Architecture

- **Backend:** FastAPI (`backend/main.py`)
- **Agent loop:** Google Gemini via `google-genai` (`backend/agent.py`)
- **Database:** Postgres (managed — Supabase/Neon), via SQLAlchemy
- **Alerts:** Slack Incoming Webhook
- **Observability:** Grafana Cloud — a REST annotation push (`backend/grafana.py`) writes
  each finding onto the dashboard, and the Grafana Cloud **MCP server**
  (`backend/grafana_mcp.py`, via the `mcp-grafana` package) is queried every cycle so the
  agent's own reasoning can see its past findings, not just write new ones
- **Frontend:** React + Vite (`frontend/`)

## Setup

### 1. Database

Create a free Postgres instance on [Supabase](https://supabase.com) or
[Neon](https://neon.tech), then run the schema:

```bash
psql "$DATABASE_URL" -f backend/schema.sql
```

### 2. Backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate   # or `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env
# fill in DATABASE_URL, GEMINI_API_KEY, SLACK_WEBHOOK_URL (and optionally GRAFANA_URL/GRAFANA_API_KEY)
```

Seed synthetic render jobs and artists:

```bash
python seed_data.py
```

Run the API:

```bash
uvicorn main:app --reload --port 8000
```

Advance the simulated pipeline state at any time (run manually before/during a demo,
or on a schedule) to make the demo feel "live":

```bash
python simulate_tick.py
```

Trigger one full agent reasoning cycle directly:

```bash
python agent.py
# or: curl -X POST http://localhost:8000/agent/run
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# set VITE_API_URL to your backend URL, and VITE_GRAFANA_PANEL_URL once you have a public panel link
npm run dev
```

### 4. Grafana Cloud

1. Sign up for [Grafana Cloud](https://grafana.com/products/cloud/) (free tier)
2. Add a Postgres data source pointing at the same `DATABASE_URL`
3. Build three panels: render queue status (bar chart), deadline risk (heatmap/table
   colored by hours-until-deadline), artist workload (gauge per artist)
4. Create a Grafana Cloud service account token (Editor role) and put the stack URL +
   token in the backend `.env` as `GRAFANA_URL` / `GRAFANA_API_KEY`. This same pair
   powers two things: every high-severity MIRAI alert annotates the dashboard live
   (`backend/grafana.py`), and every cycle's `observe()` step queries those same
   annotations back out through Grafana's own MCP server (`backend/grafana_mcp.py`,
   the `mcp-grafana` package spawned over stdio) so Gemini can see which shots it has
   already flagged before
5. Grab a public dashboard link (Share → Public dashboard) and set it as
   `VITE_GRAFANA_PANEL_URL` in the frontend

### 5. Slack

Create an [Incoming Webhook](https://api.slack.com/messaging/webhooks) for a channel
and set it as `SLACK_WEBHOOK_URL` in the backend `.env`.

## Deployment

The live demo above is deployed on Render (backend) + Vercel (frontend) — no specific
host is required by the hackathon rules, only that Google Cloud (Gemini) and the
partner service (Grafana) are actually used at runtime, which both deployments do.
Render's free tier is kept warm via an external health-check ping every 10 minutes.

Also fully deployable on Google Cloud, matching the original plan:

- **Backend:** `gcloud run deploy --source backend` (Cloud Run, buildpacks — no
  Dockerfile needed; `backend/Procfile` defines the start command)
- **Frontend:** Firebase Hosting or Cloud Storage + Cloud CDN, pointed at
  `frontend/dist` after `npm run build`
- **Secrets:** store `GEMINI_API_KEY`, `SLACK_WEBHOOK_URL`, `DATABASE_URL`, and
  `GRAFANA_API_KEY` in Google Secret Manager and mount them as env vars — never
  hardcode them

## What's not built (scope, by design)

- No auth/login — single supervisor view
- No real render-farm integration (Deadline, Tractor, etc.) — synthetic data via
  `seed_data.py` / `simulate_tick.py`
- No multi-tenant support
- Single Gemini reasoning call per cycle — no multi-agent handoff

## License

MIT — see [LICENSE](LICENSE).
