import { useState } from "react";
import "@xyflow/react/dist/style.css";
import PipelineGraph from "./graph/PipelineGraph";
import TopologyGraph from "./graph/TopologyGraph";
import GraphModal from "./graph/GraphModal";

function ExpandButton({ onClick, label }) {
  return (
    <button type="button" className="btn btn-ghost btn-icon expand-btn" onClick={onClick} aria-label={label} title={label}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
    </button>
  );
}

export default function GraphBand({ status, run, artists, enrichedJobs, grafanaPanelUrl }) {
  const [expanded, setExpanded] = useState(null); // null | "pipeline" | "topology"

  return (
    <div className="graph-band">
      <div className="graph-panel graph-panel-pipeline">
        <div className="graph-panel-head">
          <span className="kicker">Agent pipeline</span>
          <ExpandButton label="Expand agent pipeline" onClick={() => setExpanded("pipeline")} />
        </div>
        <div className="graph-canvas">
          <PipelineGraph status={status} run={run} grafanaPanelUrl={grafanaPanelUrl} />
        </div>
      </div>
      <div className="graph-panel graph-panel-topology">
        <div className="graph-panel-head">
          <span className="kicker">Sequences &amp; artists</span>
          <div className="graph-legend">
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-blocking" /> blocking
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-clear" /> clear
            </span>
          </div>
          <ExpandButton label="Expand sequences & artists" onClick={() => setExpanded("topology")} />
        </div>
        <div className="graph-canvas">
          <TopologyGraph artists={artists} enrichedJobs={enrichedJobs} />
        </div>
      </div>

      {expanded === "pipeline" && (
        <GraphModal title="Agent pipeline" onClose={() => setExpanded(null)}>
          <PipelineGraph status={status} run={run} grafanaPanelUrl={grafanaPanelUrl} interactive />
        </GraphModal>
      )}
      {expanded === "topology" && (
        <GraphModal title="Sequences & artists" onClose={() => setExpanded(null)}>
          <TopologyGraph artists={artists} enrichedJobs={enrichedJobs} interactive />
        </GraphModal>
      )}
    </div>
  );
}
