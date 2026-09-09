// Pure data-shaping for the two always-visible graphs. No JSX here — these
// functions turn real app state into @xyflow/react node/edge arrays.

// Computes a static, deterministic viewport (no ResizeObserver/measurement
// dependency) that fits every node's known position+size inside a container
// of the given pixel size. Used instead of @xyflow/react's `fitView`, whose
// internal "are nodes measured yet" check never resolved for these nodes.
export function computeFitViewport(nodes, containerWidth, containerHeight, padding = 20) {
  // Returning null (not a placeholder viewport) when there's nothing real to
  // fit yet matters: the caller only mounts <ReactFlow> once this is
  // non-null, and defaultViewport is only honored on that first mount — a
  // fake {x:0,y:0,zoom:1} here would "use up" that one chance before real
  // node data (e.g. artists/jobs still loading) arrives.
  if (!nodes.length || !containerWidth || !containerHeight) return null;

  const left = Math.min(...nodes.map((n) => n.position.x));
  const top = Math.min(...nodes.map((n) => n.position.y));
  const right = Math.max(...nodes.map((n) => n.position.x + (n.width || 100)));
  const bottom = Math.max(...nodes.map((n) => n.position.y + (n.height || 40)));
  const boundsWidth = Math.max(right - left, 1);
  const boundsHeight = Math.max(bottom - top, 1);

  // The 0.85 factor is deliberate slack, not a measurement of anything: our
  // assumed per-node width/height (above) is an estimate of the real CSS box,
  // so this guarantees a safety margin against clipping rather than chasing
  // pixel-perfect numbers that would drift the moment node CSS changes.
  const rawZoom = Math.min((containerWidth - padding * 2) / boundsWidth, (containerHeight - padding * 2) / boundsHeight, 1.2);
  const clampedZoom = Math.max(rawZoom * 0.85, 0.1);

  const x = (containerWidth - boundsWidth * clampedZoom) / 2 - left * clampedZoom;
  const y = (containerHeight - boundsHeight * clampedZoom) / 2 - top * clampedZoom;

  return { x, y, zoom: clampedZoom };
}

export function inferErrorStage(message) {
  const lower = (message || "").toLowerCase();
  if (lower.includes("gemini") || lower.includes("api_key")) return "reason";
  if (lower.includes("postgres") || lower.includes("psycopg") || lower.includes("connect") || lower.includes("database")) return "observe";
  return "reason";
}

const PIPELINE_ORDER = ["observe", "reason", "decide", "act"];

// A node is "ok"/"error" only once its stage has actually resolved this run;
// stages after a thrown error never ran, so they stay idle.
function stageVisual(stageName, run) {
  if (!run) return "idle";
  if (run.phase === "error") {
    const failedIndex = PIPELINE_ORDER.indexOf(run.errorStage);
    const thisIndex = PIPELINE_ORDER.indexOf(stageName);
    if (thisIndex < failedIndex) return "ok";
    if (thisIndex === failedIndex) return "error";
    return "idle";
  }
  const phaseIndex = PIPELINE_ORDER.indexOf(run.phase === "done" ? "act" : run.phase);
  const thisIndex = PIPELINE_ORDER.indexOf(stageName);
  if (run.phase === "done") return "ok";
  if (thisIndex < phaseIndex) return "ok";
  if (thisIndex === phaseIndex) return "active";
  return "idle";
}

export function buildPipelineGraph(status, run, grafanaPanelUrl) {
  const nodes = [
    {
      id: "postgres",
      type: "pipeline",
      position: { x: 0, y: 80 },
      data: {
        label: "Postgres",
        sublabel: status?.postgres?.ok ? `${status.postgres.latency_ms} ms` : "unreachable",
        visual: stageVisual("observe", run),
      },
    },
    {
      id: "gemini",
      type: "pipeline",
      position: { x: 200, y: 80 },
      data: {
        label: "Gemini",
        sublabel: status?.gemini?.configured ? "reasoning" : "not configured",
        visual: stageVisual("reason", run),
        errorText: run?.phase === "error" && run.errorStage === "reason" ? run.errorMessage : null,
      },
    },
    {
      id: "decide",
      type: "pipeline",
      position: { x: 400, y: 80 },
      data: {
        label: "Decide",
        sublabel: run?.findingsCount != null ? `${run.findingsCount} finding(s)` : "filter severity",
        visual: stageVisual("decide", run),
      },
    },
    {
      id: "slack",
      type: "pipeline",
      position: { x: 600, y: 10 },
      data: {
        label: "Slack",
        sublabel: status?.slack?.configured ? "webhook set" : "not configured",
        visual: stageVisual("act", run),
      },
    },
    {
      id: "grafana",
      type: "pipeline",
      position: { x: 600, y: 150 },
      data: {
        label: "Grafana",
        sublabel: status?.grafana?.configured ? "annotating" : "not configured",
        visual: stageVisual("act", run),
        href: grafanaPanelUrl || null,
      },
    },
  ].map((n) => ({ ...n, width: 100, height: 44 }));

  const edges = [
    { id: "e-postgres-gemini", source: "postgres", target: "gemini" },
    { id: "e-gemini-decide", source: "gemini", target: "decide" },
    { id: "e-decide-slack", source: "decide", target: "slack" },
    { id: "e-decide-grafana", source: "decide", target: "grafana" },
  ].map((e) => ({ ...e, animated: run && run.phase !== "done" && run.phase !== "error", type: "smoothstep" }));

  return { nodes, edges };
}

function capacityInk(pct) {
  if (pct > 80) return "var(--color-accent-700)";
  if (pct > 60) return "var(--color-accent-500)";
  return "var(--color-neutral-600)";
}

export function buildTopologyGraph({ artists, enrichedJobs }) {
  const sequences = [...new Set(enrichedJobs.map((j) => j.sequence))];

  const sequenceNodes = sequences.map((seq, i) => {
    const jobsInSeq = enrichedJobs.filter((j) => j.sequence === seq);
    return {
      id: `seq:${seq}`,
      type: "sequence",
      position: { x: 0, y: i * 76 },
      width: 150,
      height: 56,
      data: {
        label: seq.replace(/_/g, " "),
        jobCount: jobsInSeq.length,
        atRiskCount: jobsInSeq.filter((j) => j.derived.level === "High" || j.derived.level === "Medium").length,
      },
    };
  });

  const artistNodes = artists.map((a, i) => ({
    id: `artist:${a.name}`,
    type: "artist",
    position: { x: 320, y: i * 52 },
    width: 130,
    height: 48,
    data: {
      label: a.name,
      capacityPct: a.current_capacity_pct,
      activeShots: a.active_shots,
      ink: capacityInk(a.current_capacity_pct),
    },
  }));

  const pairCounts = new Map();
  for (const j of enrichedJobs) {
    if (!j.assigned_artist || !j.sequence) continue;
    const key = `${j.assigned_artist}::${j.sequence}`;
    const entry = pairCounts.get(key) || { count: 0, atRiskCount: 0 };
    entry.count += 1;
    if (j.derived.level === "High" || j.derived.level === "Medium") entry.atRiskCount += 1;
    pairCounts.set(key, entry);
  }

  // Blocking (at-risk) connections are drawn bold, solid, and animated —
  // everything else recedes to a thin, static, muted line — so the eye goes
  // straight to what's actually blocking work instead of scanning every
  // artist/sequence pairing equally. Non-blocking edges are listed first so
  // blocking ones paint on top when lines cross.
  const edges = [...pairCounts.entries()]
    .map(([key, { count, atRiskCount }]) => {
      const [artist, seq] = key.split("::");
      const blocking = atRiskCount > 0;
      return {
        id: `edge:${key}`,
        source: `seq:${seq}`,
        target: `artist:${artist}`,
        type: "smoothstep",
        pathOptions: { borderRadius: 12 },
        animated: blocking,
        data: { count, atRiskCount, blocking },
        style: {
          strokeWidth: blocking ? Math.min(1.5 + atRiskCount * 0.8, 5) : 1,
          stroke: blocking ? "var(--color-accent-700)" : "var(--color-neutral-400)",
          opacity: blocking ? 1 : 0.45,
        },
        zIndex: blocking ? 1 : 0,
      };
    })
    .sort((a, b) => Number(a.data.blocking) - Number(b.data.blocking));

  return { nodes: [...sequenceNodes, ...artistNodes], edges };
}
