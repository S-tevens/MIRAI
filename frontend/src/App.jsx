import { useCallback, useEffect, useMemo, useState } from "react";
import "./theme.css";
import "./layout.css";
import { fetchAlerts, fetchArtists, fetchJobs, fetchStatus, patchJob, runAgent } from "./api";
import AlertsPanel from "./components/AlertsPanel";
import AuditPanel from "./components/AuditPanel";
import Header from "./components/Header";
import Inspector from "./components/Inspector";
import IntegrationsPanel from "./components/IntegrationsPanel";
import JobsPanel from "./components/JobsPanel";
import Sidebar from "./components/Sidebar";
import WorkloadPanel from "./components/WorkloadPanel";
import { deriveRisk, RISK_ORDER } from "./risk";
import { GRAFANA_PANEL_URL } from "./config";

function stamp() {
  return new Date().toLocaleTimeString([], { hour12: false });
}

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [artists, setArtists] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState("—");

  const [view, setView] = useState("Queue");
  const [tab, setTab] = useState("Inspector");
  const [filter, setFilter] = useState("All");
  const [seq, setSeq] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("risk");
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState([]);
  const [acked, setAcked] = useState([]);
  const [applyState, setApplyState] = useState({});
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);

  const pushLog = useCallback((tag, msg) => {
    setLog((prev) => [{ t: stamp(), tag, msg }, ...prev].slice(0, 40));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [j, a, al, st] = await Promise.all([fetchJobs(), fetchArtists(), fetchAlerts(), fetchStatus()]);
      setJobs(j);
      setArtists(a);
      setAlerts(al);
      setStatus(st);
      setConnectionError(null);
      setRefreshedAt(stamp());
    } catch (err) {
      setConnectionError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const artistByName = useMemo(() => new Map(artists.map((a) => [a.name, a])), [artists]);

  const enrichedJobs = useMemo(
    () =>
      jobs.map((j) => ({
        ...j,
        derived: deriveRisk(j, artistByName),
        artist: artistByName.get(j.assigned_artist) || null,
        selected: j.shot_name === selected,
      })),
    [jobs, artistByName, selected]
  );

  const latestFindingByShot = useMemo(() => {
    const map = new Map();
    for (const a of alerts) {
      if (!map.has(a.shot_name)) map.set(a.shot_name, a);
    }
    return map;
  }, [alerts]);

  const seqOptions = useMemo(() => {
    const unique = [...new Set(jobs.map((j) => j.sequence))];
    return [{ value: "all", label: "All sequences" }, ...unique.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))];
  }, [jobs]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = enrichedJobs.filter((j) => {
      if (filter === "At risk" && j.derived.level !== "High" && j.derived.level !== "Medium") return false;
      if (filter === "Failed" && j.status !== "failed") return false;
      if (filter === "Queued" && j.status !== "queued") return false;
      if (seq !== "all" && j.sequence !== seq) return false;
      if (q && !`${j.shot_name} ${j.assigned_artist} ${j.sequence}`.toLowerCase().includes(q)) return false;
      return true;
    });
    rows = rows.slice().sort((a, b) => {
      if (sort === "risk") return RISK_ORDER[a.derived.level] - RISK_ORDER[b.derived.level] || a.hours_until_deadline - b.hours_until_deadline;
      if (sort === "deadline") return a.hours_until_deadline - b.hours_until_deadline;
      return a.shot_name.localeCompare(b.shot_name);
    });
    return rows;
  }, [enrichedJobs, filter, seq, query, sort]);

  const filterCounts = useMemo(
    () => ({
      All: enrichedJobs.length,
      "At risk": enrichedJobs.filter((j) => j.derived.level === "High" || j.derived.level === "Medium").length,
      Failed: enrichedJobs.filter((j) => j.status === "failed").length,
      Queued: enrichedJobs.filter((j) => j.status === "queued").length,
    }),
    [enrichedJobs]
  );

  const navCounts = useMemo(
    () => ({
      Queue: enrichedJobs.filter((j) => j.status !== "done").length,
      "At risk": filterCounts["At risk"],
      Alerts: alerts.filter((a) => !acked.includes(a.id)).length,
      Artists: artists.length,
      Integrations: 4,
      Audit: alerts.length,
    }),
    [enrichedJobs, filterCounts, alerts, acked, artists]
  );

  const selectedJob = enrichedJobs.find((j) => j.shot_name === selected) || null;

  function onSelectNav(v) {
    setView(v);
    if (v === "At risk") setFilter("At risk");
    if (v === "Queue") setFilter("All");
    if (v === "Alerts") setTab("Alerts");
    if (v === "Artists") setTab("Workload");
    if (v === "Integrations") setTab("Integrations");
    if (v === "Audit") setTab("Audit");
  }

  function onOpen(shotName) {
    setSelected(shotName);
    setTab("Inspector");
  }

  function onToggle(id) {
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.concat(id)));
  }

  function onToggleAll() {
    setChecked((prev) => (prev.length === visibleRows.length ? [] : visibleRows.map((r) => r.id)));
  }

  function onSort() {
    setSort((prev) => (prev === "risk" ? "deadline" : prev === "deadline" ? "shot" : "risk"));
  }

  async function onRun() {
    if (running) return;
    setRunning(true);
    setTab("Alerts");
    pushLog("start", "Cycle triggered manually (POST /agent/run)");
    try {
      const result = await runAgent();
      pushLog("observe", `Observed ${result.observed_job_count} in-progress jobs`);
      pushLog("reason", `Gemini returned ${result.findings.length} finding(s)`);
      pushLog("decide", `${result.alerts_sent.length} finding(s) escalated to high severity`);
      pushLog(
        "act",
        result.alerts_sent.length
          ? `Logged ${result.alerts_sent.length} alert(s), notified Slack, annotated Grafana`
          : "No high-severity findings — no alerts sent"
      );
      await refresh();
    } catch (err) {
      pushLog("error", err.message);
    } finally {
      setRunning(false);
    }
  }

  async function onBulkReassign() {
    if (artists.length === 0 || checked.length === 0) return;
    const target = artists.slice().sort((a, b) => a.current_capacity_pct - b.current_capacity_pct)[0];
    await Promise.all(checked.map((id) => patchJob(id, { assigned_artist: target.name })));
    pushLog("apply", `Reassigned ${checked.length} shot(s) to ${target.name} (${Math.round(target.current_capacity_pct)}% load)`);
    setChecked([]);
    await refresh();
  }

  async function onBulkRequeue() {
    if (checked.length === 0) return;
    await Promise.all(checked.map((id) => patchJob(id, { status: "queued" })));
    pushLog("apply", `Requeued ${checked.length} shot(s)`);
    setChecked([]);
    await refresh();
  }

  async function onApplyFinding() {
    if (!selectedJob) return;
    const finding = latestFindingByShot.get(selectedJob.shot_name);
    if (!finding) return;

    const lower = finding.recommended_action.toLowerCase();
    const mentioned = artists.find((a) => a.name !== selectedJob.assigned_artist && lower.includes(a.name.toLowerCase()));

    try {
      if (mentioned) {
        await patchJob(selectedJob.id, { assigned_artist: mentioned.name });
        pushLog("apply", `Applied recommendation on ${selectedJob.shot_name} — reassigned to ${mentioned.name}`);
        setApplyState((s) => ({ ...s, [selectedJob.shot_name]: { status: "applied", note: `Reassigned to ${mentioned.name}.` } }));
      } else if (/requeue|retry|re-cache|restart/.test(lower)) {
        await patchJob(selectedJob.id, { status: "queued" });
        pushLog("apply", `Applied recommendation on ${selectedJob.shot_name} — requeued`);
        setApplyState((s) => ({ ...s, [selectedJob.shot_name]: { status: "applied", note: "Requeued for another render attempt." } }));
      } else {
        setApplyState((s) => ({
          ...s,
          [selectedJob.shot_name]: { status: "applied", note: "Logged only — recommendation text wasn't machine-actionable." },
        }));
      }
      await refresh();
    } catch (err) {
      pushLog("error", err.message);
    }
  }

  function onDismissFinding() {
    if (!selectedJob) return;
    pushLog("dismiss", `Finding on ${selectedJob.shot_name} dismissed by supervisor`);
    setApplyState((s) => ({ ...s, [selectedJob.shot_name]: { status: "dismissed", note: "Dismissed — MIRAI keeps observing." } }));
  }

  function onAck(id) {
    setAcked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.concat(id)));
  }

  function onAckAll() {
    setAcked(alerts.map((a) => a.id));
  }

  const watchLabel = running ? "Running cycle…" : `Watching · ${jobs.length} jobs tracked`;

  return (
    <div className="app-shell">
      <Header query={query} onQuery={setQuery} running={running} onRun={onRun} watchLabel={watchLabel} />

      {connectionError && (
        <div className="connection-banner">Can't reach the MIRAI backend: {connectionError}</div>
      )}

      <div className="app-body">
        <Sidebar view={view} counts={navCounts} onSelect={onSelectNav} status={status} />

        <JobsPanel
          rows={visibleRows}
          allCount={enrichedJobs.length}
          filterCounts={filterCounts}
          filter={filter}
          onFilter={setFilter}
          seq={seq}
          seqOptions={seqOptions}
          onSeq={setSeq}
          sort={sort}
          onSort={onSort}
          checked={checked}
          onToggle={onToggle}
          onToggleAll={onToggleAll}
          onOpen={onOpen}
          onBulkReassign={onBulkReassign}
          onBulkRequeue={onBulkRequeue}
          onClearSelection={() => setChecked([])}
          log={log}
          refreshedAt={refreshedAt}
        />

        <aside className="inspector-aside">
          <div className="aside-tabs">
            {["Inspector", "Alerts", "Workload", "Integrations", "Audit"].map((t) => (
              <button
                key={t}
                type="button"
                className={`aside-tab${tab === t ? " active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "Alerts" ? `Alerts · ${navCounts.Alerts}` : t}
              </button>
            ))}
          </div>

          {tab === "Inspector" && (
            <Inspector
              job={selectedJob}
              finding={selectedJob ? latestFindingByShot.get(selectedJob.shot_name) : null}
              applyState={selectedJob ? applyState[selectedJob.shot_name] : null}
              onApply={onApplyFinding}
              onDismiss={onDismissFinding}
              grafanaUrl={GRAFANA_PANEL_URL || null}
            />
          )}
          {tab === "Alerts" && <AlertsPanel alerts={alerts} acked={acked} onAck={onAck} onAckAll={onAckAll} onOpen={onOpen} />}
          {tab === "Workload" && <WorkloadPanel artists={artists} jobs={jobs} />}
          {tab === "Integrations" && <IntegrationsPanel status={status} />}
          {tab === "Audit" && <AuditPanel alerts={alerts} />}
        </aside>
      </div>
    </div>
  );
}
