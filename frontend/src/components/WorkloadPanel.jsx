function bucketize(jobs) {
  const buckets = [
    { label: "0-12h", min: -Infinity, max: 12, count: 0 },
    { label: "12-24h", min: 12, max: 24, count: 0 },
    { label: "24-36h", min: 24, max: 36, count: 0 },
    { label: "36-48h", min: 36, max: 48, count: 0 },
    { label: "48h+", min: 48, max: Infinity, count: 0 },
  ];
  jobs
    .filter((j) => j.status !== "done")
    .forEach((j) => {
      const b = buckets.find((b) => j.hours_until_deadline > b.min && j.hours_until_deadline <= b.max) || buckets[buckets.length - 1];
      b.count += 1;
    });
  return buckets;
}

export default function WorkloadPanel({ artists, jobs }) {
  const buckets = bucketize(jobs);
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="workload-panel">
      <div className="artist-list">
        {artists.map((a) => (
          <div className="artist-row" key={a.id}>
            <div className="cell-stack">
              <span>{a.name}</span>
              <span className="tnum cell-sub">{a.active_shots} active shot{a.active_shots === 1 ? "" : "s"}</span>
            </div>
            <span className="capacity-track">
              <span
                className="capacity-fill"
                style={{
                  width: `${a.current_capacity_pct}%`,
                  background: a.current_capacity_pct > 80 ? "var(--color-accent-700)" : a.current_capacity_pct > 60 ? "var(--color-accent-500)" : "var(--color-neutral-600)",
                }}
              />
            </span>
            <span className="tnum capacity-value" style={{ color: a.current_capacity_pct > 80 ? "var(--color-accent-700)" : undefined }}>
              {Math.round(a.current_capacity_pct)}%
            </span>
          </div>
        ))}
      </div>

      <div className="card histogram-card">
        <span className="kicker">Deadline risk · hours remaining (live)</span>
        <div className="histogram">
          {buckets.map((b) => (
            <div className="histogram-bar" key={b.label}>
              <span
                className="histogram-fill"
                style={{
                  height: `${Math.round((b.count / maxCount) * 100)}%`,
                  borderColor: b.label === "0-12h" || b.label === "12-24h" ? "var(--color-accent-600)" : "var(--color-neutral-500)",
                  background: b.label === "0-12h" || b.label === "12-24h" ? "var(--color-accent-200)" : "transparent",
                }}
              />
              <span className="tnum histogram-label">{b.label}</span>
            </div>
          ))}
        </div>
        <p className="cell-sub">This shape is what a Grafana deadline-risk panel over the same table would show; annotated by MIRAI on every high-severity finding.</p>
      </div>
    </div>
  );
}
