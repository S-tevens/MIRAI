const NAV_ITEMS = ["Queue", "At risk", "Alerts", "Artists", "Integrations", "Audit"];

export default function Sidebar({ view, counts, onSelect, status }) {
  const services = [
    { name: "Postgres", ok: status?.postgres?.ok, meta: status?.postgres?.latency_ms != null ? `${status.postgres.latency_ms} ms` : "—" },
    { name: "Gemini API", ok: status?.gemini?.configured, meta: status?.gemini?.configured ? "connected" : "not configured" },
    { name: "Grafana Cloud", ok: status?.grafana?.configured, meta: status?.grafana?.configured ? "connected" : "not configured" },
    { name: "Slack webhook", ok: status?.slack?.configured, meta: status?.slack?.configured ? "connected" : "not configured" },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-nav">
        {NAV_ITEMS.map((label) => (
          <button
            key={label}
            type="button"
            className={`sidebar-nav-item${view === label ? " active" : ""}`}
            onClick={() => onSelect(label)}
          >
            <span>{label}</span>
            <span className="tnum sidebar-count">{counts[label] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-services">
        <span className="kicker">Services</span>
        {services.map((s) => (
          <div className="service-row" key={s.name}>
            <span className={`service-dot${s.ok ? " ok" : ""}`} />
            <span className="service-name">{s.name}</span>
            <span className="tnum service-meta">{s.meta}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-user">
        <span className="service-meta">Supervisor view</span>
        <span>MIRAI demo session</span>
        <span className="tnum service-meta">Agent runs on demand · alerts logged live</span>
      </div>
    </nav>
  );
}
