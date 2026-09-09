// Mirrors the risk math in backend/agent.py's observe() step, so the table's
// risk badges match what the agent itself would flag before Gemini even runs.
export function deriveRisk(job, artistByName) {
  const left = Math.max(job.estimated_hours - (job.actual_hours || 0), 0);
  const ratio =
    job.status === "done" ? 0 : left / Math.max(job.hours_until_deadline, 1);
  const artist = artistByName.get(job.assigned_artist) || null;
  const high =
    job.status !== "done" && (ratio >= 0.9 || job.render_attempts > 2);
  const medium = !high && job.status !== "done" && ratio >= 0.55;
  const level = job.status === "done" ? "Delivered" : high ? "High" : medium ? "Medium" : "Clear";
  return { left, ratio, artist, level };
}

export const RISK_ORDER = { High: 0, Medium: 1, Clear: 2, Delivered: 3 };
