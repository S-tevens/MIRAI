import { API_URL } from "./config";

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `${path} failed (${res.status})`);
  }
  return res.json();
}

export const fetchJobs = () => request("/jobs");
export const fetchArtists = () => request("/artists");
export const fetchAlerts = () => request("/alerts");
export const fetchStatus = () => request("/status");
export const runAgent = () => request("/agent/run", { method: "POST" });

export const patchJob = (id, patch) =>
  request(`/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
