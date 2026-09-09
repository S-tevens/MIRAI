import { Handle, Position } from "@xyflow/react";

export default function ArtistNode({ data }) {
  const { label, capacityPct, activeShots, ink } = data;
  return (
    <div className="rf-node rf-node-artist" title={`${activeShots} active shot${activeShots === 1 ? "" : "s"}`}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <span className="rf-node-label">{label}</span>
      <span className="capacity-track">
        <span className="capacity-fill" style={{ width: `${capacityPct}%`, background: ink }} />
      </span>
      <span className="tnum capacity-value" style={{ color: ink }}>
        {Math.round(capacityPct)}%
      </span>
    </div>
  );
}
