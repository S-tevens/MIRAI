function riskLevel(job) {
  if (job.status === "failed") return "high";
  if (job.hours_until_deadline <= 0) return "high";
  const remaining = job.estimated_hours - (job.actual_hours || 0);
  const ratio = job.hours_until_deadline > 0 ? remaining / job.hours_until_deadline : Infinity;
  if (ratio > 1) return "high";
  if (ratio > 0.6) return "medium";
  return "low";
}

function formatDeadline(hours) {
  if (hours < 0) return "overdue";
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default function JobTable({ jobs }) {
  return (
    <div className="panel">
      <h2>Render Queue</h2>
      <table className="job-table">
        <thead>
          <tr>
            <th>Shot</th>
            <th>Sequence</th>
            <th>Artist</th>
            <th>Status</th>
            <th>Deadline</th>
            <th>Attempts</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const risk = riskLevel(job);
            return (
              <tr key={job.id}>
                <td>{job.shot_name}</td>
                <td>{job.sequence}</td>
                <td>{job.assigned_artist}</td>
                <td>
                  <span className={`badge status-${job.status}`}>{job.status}</span>
                </td>
                <td>{formatDeadline(job.hours_until_deadline)}</td>
                <td>{job.render_attempts}</td>
                <td>
                  <span className={`badge risk-${risk}`}>{risk}</span>
                </td>
              </tr>
            );
          })}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={7} className="empty">
                No jobs loaded — check the backend is running and seeded.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
