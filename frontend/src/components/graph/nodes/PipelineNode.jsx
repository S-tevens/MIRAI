import { Handle, Position } from "@xyflow/react";

export default function PipelineNode({ data }) {
  const { label, sublabel, visual, errorText, href } = data;

  const content = (
    <>
      <div className="rf-node-head">
        <span className={`service-dot${visual === "ok" || visual === "active" ? " ok" : ""}`} />
        <span className="rf-node-label">{label}</span>
      </div>
      <span className="rf-node-sub">{errorText ? errorText : sublabel}</span>
    </>
  );

  return (
    <div className={`rf-node${visual === "active" ? " is-active" : ""}${visual === "error" ? " is-error" : ""}`}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="rf-node-link">
          {content}
        </a>
      ) : (
        content
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
