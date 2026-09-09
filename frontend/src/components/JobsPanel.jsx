const FILTERS = ["All", "At risk", "Failed", "Queued"];

function riskInk(level) {
  if (level === "High") return "var(--color-accent-700)";
  if (level === "Medium") return "var(--color-accent-500)";
  return "var(--color-neutral-600)";
}

export default function JobsPanel({
  rows,
  allCount,
  filterCounts,
  filter,
  onFilter,
  seq,
  seqOptions,
  onSeq,
  sort,
  onSort,
  checked,
  onToggle,
  onToggleAll,
  onOpen,
  onBulkReassign,
  onBulkRequeue,
  onClearSelection,
  log,
  refreshedAt,
}) {
  return (
    <section className="jobs-panel">
      <div className="jobs-toolbar">
        <div className="filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`filter-chip tnum${filter === f ? " active" : ""}`}
              onClick={() => onFilter(f)}
            >
              {f} {filterCounts[f]}
            </button>
          ))}
          <span className="divider-v" />
          <select className="input" value={seq} onChange={(e) => onSeq(e.target.value)}>
            {seqOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-right">
          <span className="tnum service-meta">
            {rows.length} of {allCount} jobs · refreshed {refreshedAt}
          </span>
          <button type="button" className="btn btn-secondary sort-btn" onClick={onSort}>
            Sort: {sort}
          </button>
        </div>
      </div>

      {checked.length > 0 && (
        <div className="selection-bar">
          <span className="tnum">{checked.length} shot{checked.length === 1 ? "" : "s"} selected</span>
          <div className="selection-actions">
            <button type="button" className="btn btn-secondary" onClick={onBulkReassign}>
              Reassign to lowest load
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBulkRequeue}>
              Requeue selected
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClearSelection}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="table-scroll">
        <table className="table jobs-table">
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input
                  type="checkbox"
                  checked={checked.length > 0 && checked.length === rows.length}
                  onChange={onToggleAll}
                  aria-label="Select all"
                />
              </th>
              <th>Shot</th>
              <th>Artist</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Left</th>
              <th style={{ textAlign: "right" }}>Due in</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onOpen(r.shot_name)}
                className={r.selected ? "row-selected" : ""}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={checked.includes(r.id)}
                    onChange={() => onToggle(r.id)}
                    aria-label={`Select ${r.shot_name}`}
                  />
                </td>
                <td>
                  <div className="cell-stack">
                    <span className="tnum">{r.shot_name}</span>
                    <span className="cell-sub">
                      {r.sequence.replace(/_/g, " ")} · cx {r.complexity_score ?? "—"}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="cell-stack">
                    <span>{r.assigned_artist}</span>
                    <span className="tnum cell-sub" style={{ color: r.artist?.current_capacity_pct > 80 ? "var(--color-accent-700)" : undefined }}>
                      {r.artist ? `${Math.round(r.artist.current_capacity_pct)}% load` : "—"}
                      {r.render_attempts > 1 ? ` · ${r.render_attempts} attempts` : ""}
                    </span>
                  </div>
                </td>
                <td>
                  <span className="status-label">{r.status}</span>
                </td>
                <td className="tnum" style={{ textAlign: "right" }}>
                  {r.status === "done" ? "—" : `${r.derived.left.toFixed(1)}h`}
                </td>
                <td
                  className="tnum"
                  style={{
                    textAlign: "right",
                    color: r.hours_until_deadline <= 20 && r.status !== "done" ? "var(--color-accent-700)" : undefined,
                  }}
                >
                  {r.hours_until_deadline.toFixed(1)}h
                </td>
                <td>
                  <div className="risk-cell">
                    <span className="risk-bar">
                      <span
                        className="risk-bar-fill"
                        style={{
                          width: `${Math.round((Math.min(r.derived.ratio, 1.2) / 1.2) * 100)}%`,
                          background: riskInk(r.derived.level),
                        }}
                      />
                    </span>
                    <span className="risk-label" style={{ color: riskInk(r.derived.level) }}>
                      {r.derived.level}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No jobs match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="run-log">
        <div className="run-log-header">
          <span className="kicker">Agent run log</span>
          <span className="tnum service-meta">{log.length} entries · POST /agent/run</span>
        </div>
        <div className="run-log-body">
          {log.map((entry, i) => (
            <div className="run-log-row tnum" key={i}>
              <span className="run-log-time">{entry.t}</span>
              <span className={`run-log-tag${entry.tag === "act" ? " accent" : ""}`}>{entry.tag}</span>
              <span>{entry.msg}</span>
            </div>
          ))}
          {log.length === 0 && <span className="service-meta">No cycles run yet this session.</span>}
        </div>
      </div>
    </section>
  );
}
