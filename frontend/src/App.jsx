import { useCallback, useEffect, useState } from "react";
import "./App.css";
import AlertFeed from "./components/AlertFeed";
import GrafanaEmbed from "./components/GrafanaEmbed";
import JobTable from "./components/JobTable";
import RunAgentButton from "./components/RunAgentButton";
import { API_URL } from "./config";

function App() {
  const [jobs, setJobs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [jobsRes, alertsRes] = await Promise.all([
        fetch(`${API_URL}/jobs`),
        fetch(`${API_URL}/alerts`),
      ]);
      if (!jobsRes.ok || !alertsRes.ok) throw new Error("Backend request failed");
      setJobs(await jobsRes.json());
      setAlerts(await alertsRes.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const atRiskCount = jobs.filter((j) => j.status !== "done" && j.hours_until_deadline < 24).length;

  return (
    <div className="app">
      <header className="app-header">
        <h1>MIRAI</h1>
        <p className="tagline">Agentic post-production pipeline monitor</p>
        <div className="header-stats">
          <span>{jobs.length} active jobs</span>
          <span className="stat-warn">{atRiskCount} within 24h of deadline</span>
        </div>
        <RunAgentButton onComplete={refresh} />
      </header>

      {error && <div className="connection-error">Can't reach backend at {API_URL}: {error}</div>}

      <main className="app-grid">
        <JobTable jobs={jobs} />
        <div className="side-column">
          <AlertFeed alerts={alerts} />
          <GrafanaEmbed />
        </div>
      </main>
    </div>
  );
}

export default App;
