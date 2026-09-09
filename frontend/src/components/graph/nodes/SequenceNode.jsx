import { Handle, Position } from "@xyflow/react";

export default function SequenceNode({ data }) {
  const { label, jobCount, atRiskCount } = data;
  return (
    <div className={`rf-node rf-node-sequence${atRiskCount > 0 ? " has-risk" : ""}`}>
      <span className="rf-node-label">{label}</span>
      <span className="rf-node-sub">
        {jobCount} job{jobCount === 1 ? "" : "s"}
        {atRiskCount > 0 ? ` · ${atRiskCount} at risk` : ""}
      </span>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
