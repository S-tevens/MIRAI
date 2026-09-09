function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

export default function AuditPanel({ alerts }) {
  return (
    <div className="audit-panel">
      <span className="tnum service-meta">{alerts.length} logged findings (alerts_log, most recent first)</span>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Sent</th>
              <th>Shot</th>
              <th>Severity</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td className="tnum cell-sub">{formatTime(a.sent_at)}</td>
                <td className="tnum">{a.shot_name}</td>
                <td>
                  <span className={`tag ${a.severity === "high" ? "tag-accent" : "tag-neutral"}`}>{a.severity}</span>
                </td>
                <td className="cell-sub">{a.risk_reason}</td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
