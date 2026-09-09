import { useState } from "react";
import { API_URL } from "../config";

export default function RunAgentButton({ onComplete }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  async function handleClick() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/agent/run`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Agent run failed (${res.status})`);
      }
      const result = await res.json();
      setLastResult(result);
      onComplete?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="run-agent">
      <button onClick={handleClick} disabled={running}>
        {running ? "MIRAI is reasoning..." : "Run MIRAI Now"}
      </button>
      {error && <div className="run-error">{error}</div>}
      {lastResult && !error && (
        <div className="run-summary">
          Observed {lastResult.observed_job_count} jobs, found {lastResult.findings.length}{" "}
          at-risk, sent {lastResult.alerts_sent.length} high-severity alert
          {lastResult.alerts_sent.length === 1 ? "" : "s"}.
        </div>
      )}
    </div>
  );
}
