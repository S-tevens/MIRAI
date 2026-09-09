import ThemeToggle from "./ThemeToggle";

export default function Header({ query, onQuery, running, onRun, watchLabel, theme, onToggleTheme }) {
  return (
    <div className="header">
      <div className="header-brand">
        <span className="wordmark">MIRAI</span>
        <span className="header-meta">Bay 4 render farm</span>
        <span className="tag tag-outline">demo</span>
      </div>
      <div className="header-controls">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <div className="search-box">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="input search-input"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search shots, artists, sequences"
          />
        </div>
        <div className="watch-pill">
          <span className={`watch-dot${running ? " running" : ""}`} />
          <span className="tnum">{watchLabel}</span>
        </div>
        <button type="button" className="btn btn-primary run-btn" onClick={onRun} disabled={running}>
          {running ? "Running cycle…" : "Run MIRAI now"}
        </button>
      </div>
    </div>
  );
}
