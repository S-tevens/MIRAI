function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function Inspector({ job, finding, applyState, onApply, onDismiss, grafanaUrl }) {
  if (!job) {
    return (
      <div className="inspector-empty service-meta">Select a shot from the queue to inspect it.</div>
    );
  }

  const facts = [
    { label: "Status", value: job.status },
    { label: "Risk", value: job.derived.level, accent: job.derived.level === "High" },
    { label: "Est. remaining", value: `${job.derived.left.toFixed(1)} h` },
    { label: "Deadline in", value: `${job.hours_until_deadline.toFixed(1)} h`, accent: job.hours_until_deadline <= 20 },
    { label: "Artist load", value: job.artist ? `${Math.round(job.artist.current_capacity_pct)}%` : "—", accent: job.artist?.current_capacity_pct > 80 },
    { label: "Risk ratio", value: job.derived.ratio.toFixed(2) },
  ];

  const applied = applyState?.status === "applied";
  const dismissed = applyState?.status === "dismissed";

  return (
    <div className="inspector">
      <div className="inspector-heading">
        <span className="kicker">
          {job.sequence.replace(/_/g, " ")} · complexity {job.complexity_score ?? "—"}
        </span>
        <span className="inspector-shot">{job.shot_name}</span>
        <span className="cell-sub">
          Assigned to {job.assigned_artist}
          {job.render_attempts > 1 ? ` · attempt ${job.render_attempts}` : ""}
        </span>
      </div>

      <div className="fact-grid">
        {facts.map((f) => (
          <div className="fact" key={f.label}>
            <span className="kicker">{f.label}</span>
            <span className="tnum fact-value" style={{ color: f.accent ? "var(--color-accent-700)" : undefined }}>
              {f.value}
            </span>
          </div>
        ))}
      </div>

      <div className="finding-block">
        <span className="kicker">MIRAI finding</span>
        {finding ? (
          <>
            <p className="finding-text">{finding.risk_reason}</p>
            <p className="finding-action">{finding.recommended_action}</p>
            <span className="tnum cell-sub">
              severity {finding.severity} · sent {timeAgo(finding.sent_at)}
            </span>
          </>
        ) : (
          <p className="finding-text">
            No open finding. The last cycle judged this shot on track — estimated hours remaining
            fit inside the deadline and the assigned artist has headroom.
          </p>
        )}
      </div>

      {finding && (
        <div className="inspector-actions">
          <button type="button" className="btn btn-primary" onClick={onApply} disabled={applied || dismissed}>
            {applied ? "Applied" : "Apply recommendation"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onDismiss} disabled={applied || dismissed}>
            Dismiss
          </button>
          {grafanaUrl && (
            <a className="btn btn-ghost" href={grafanaUrl} target="_blank" rel="noreferrer">
              Open in Grafana
            </a>
          )}
        </div>
      )}
      {applyState?.note && <p className="cell-sub apply-note">{applyState.note}</p>}

      <div className="activity-block">
        <span className="kicker">Shot activity</span>
        <div className="activity-row tnum">
          <span className="activity-time">created</span>
          <span>Job created, estimate {job.estimated_hours}h, complexity {job.complexity_score ?? "—"}</span>
        </div>
        {finding && (
          <div className="activity-row tnum">
            <span className="activity-time">{timeAgo(finding.sent_at)}</span>
            <span>MIRAI flagged severity {finding.severity} and logged an alert</span>
          </div>
        )}
      </div>
    </div>
  );
}
