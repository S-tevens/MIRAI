function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function AlertsPanel({ alerts, acked, onAck, onAckAll, onOpen }) {
  const openCount = alerts.filter((a) => !acked.includes(a.id)).length;

  return (
    <div className="alerts-panel">
      <div className="alerts-header">
        <span className="tnum service-meta">
          {openCount} open · {alerts.length} in the last 50
        </span>
        <button type="button" className="btn btn-ghost" onClick={onAckAll} disabled={openCount === 0}>
          Acknowledge all
        </button>
      </div>
      {alerts.map((a) => {
        const isAcked = acked.includes(a.id);
        return (
          <article className="alert-card" key={a.id} style={{ opacity: isAcked ? 0.55 : 1 }}>
            <div className="alert-card-head">
              <span className="alert-shot" onClick={() => onOpen(a.shot_name)}>
                {a.shot_name}
              </span>
              <span className={`tag ${a.severity === "high" ? "tag-accent" : "tag-neutral"}`}>{a.severity}</span>
            </div>
            <p className="finding-text">{a.risk_reason}</p>
            <p className="finding-action">{a.recommended_action}</p>
            <div className="alert-card-foot tnum">
              <span>{timeAgo(a.sent_at)}</span>
              <span>#vfx-supervisors</span>
              <button type="button" className="link-btn" onClick={() => onAck(a.id)}>
                {isAcked ? "Reopen" : "Acknowledge"}
              </button>
            </div>
          </article>
        );
      })}
      {alerts.length === 0 && <p className="service-meta">No alerts yet. Run MIRAI to check for risk.</p>}
    </div>
  );
}
