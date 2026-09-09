import { GRAFANA_PANEL_URL } from "../config";

export default function GrafanaEmbed() {
  if (!GRAFANA_PANEL_URL) {
    return (
      <div className="panel grafana-panel">
        <h2>Grafana Dashboard</h2>
        <p className="empty">
          Set VITE_GRAFANA_PANEL_URL to your Grafana Cloud public dashboard/panel embed
          link to show it here.
        </p>
      </div>
    );
  }

  return (
    <div className="panel grafana-panel">
      <h2>Grafana Dashboard</h2>
      <iframe
        src={GRAFANA_PANEL_URL}
        title="MIRAI Grafana Dashboard"
        frameBorder="0"
        width="100%"
        height="400"
      />
    </div>
  );
}
