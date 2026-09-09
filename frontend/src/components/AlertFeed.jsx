function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export default function AlertFeed({ alerts }) {
  return (
    <div className="panel">
      <h2>MIRAI Alert Feed</h2>
      <ul className="alert-feed">
        {alerts.map((alert) => (
          <li key={alert.id} className={`alert-item severity-${alert.severity}`}>
            <div className="alert-header">
              <span className="alert-shot">{alert.shot_name}</span>
              <span className="alert-time">{timeAgo(alert.sent_at)}</span>
            </div>
            <div className="alert-reason">{alert.risk_reason}</div>
            <div className="alert-action">→ {alert.recommended_action}</div>
          </li>
        ))}
        {alerts.length === 0 && <li className="empty">No alerts yet. Run MIRAI to check for risk.</li>}
      </ul>
    </div>
  );
}
