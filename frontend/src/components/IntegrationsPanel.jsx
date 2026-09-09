import { GRAFANA_PANEL_URL } from "../config";

const ROWS = [
  { key: "postgres", label: "Postgres", detail: (s) => (s?.postgres?.ok ? `${s.postgres.latency_ms} ms round trip` : "unreachable") },
  { key: "gemini", label: "Gemini API", detail: (s) => (s?.gemini?.configured ? "GEMINI_API_KEY set — reasoning calls enabled" : "GEMINI_API_KEY missing") },
  { key: "grafana", label: "Grafana Cloud", detail: (s) => (s?.grafana?.configured ? "annotation API configured" : "GRAFANA_URL / GRAFANA_API_KEY missing") },
  { key: "slack", label: "Slack webhook", detail: (s) => (s?.slack?.configured ? "SLACK_WEBHOOK_URL set" : "SLACK_WEBHOOK_URL missing") },
];

export default function IntegrationsPanel({ status }) {
  return (
    <div className="integrations-panel">
      {ROWS.map((r) => {
        const ok = status?.[r.key]?.ok ?? status?.[r.key]?.configured;
        return (
          <div className="card integration-card" key={r.key}>
            <div className="integration-head">
              <span className={`service-dot${ok ? " ok" : ""}`} />
              <span className="card-title">{r.label}</span>
            </div>
            <span className="cell-sub">{r.detail(status)}</span>
          </div>
        );
      })}

      <div className="card integration-card">
        <span className="kicker">Grafana panel embed</span>
        {GRAFANA_PANEL_URL ? (
          <iframe src={GRAFANA_PANEL_URL} title="MIRAI Grafana Dashboard" frameBorder="0" width="100%" height="300" />
        ) : (
          <p className="cell-sub">Set VITE_GRAFANA_PANEL_URL to your Grafana Cloud public dashboard link to embed it here.</p>
        )}
      </div>
    </div>
  );
}
